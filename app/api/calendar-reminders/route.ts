import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findContact } from "@/app/data/contacts";

const supabase = createClient(
  "https://kbtbqsglagdurlqtlnww.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normaliza un nombre para comparar sin tildes ni mayúsculas (mismo criterio que la app).
function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// ¿Son la misma persona? Tolerante a tildes/orden/subconjunto (ej. "Maria" ⊆ "Maria Juliana").
function samePerson(a: string, b: string): boolean {
  const pa = normName(a).split(/\s+/).filter((w) => w.length > 1);
  const pb = normName(b).split(/\s+/).filter((w) => w.length > 1);
  if (pa.length === 0 || pb.length === 0) return false;
  return pa.every((w) => pb.includes(w)) || pb.every((w) => pa.includes(w));
}

// Correos que las personas cargaron al adaptar su tono (tabla tone_profiles de Supabase).
// Es la fuente self-service: la persona pone su correo en la app y no hay que editar contacts.ts.
async function loadSupabaseEmails(): Promise<{ name: string; email: string }[]> {
  try {
    const { data } = await supabase
      .from("tone_profiles")
      .select("person_name, email");
    return (data ?? [])
      .map((r) => ({ name: (r.person_name ?? "").trim(), email: (r.email ?? "").trim() }))
      .filter((r) => r.name && r.email);
  } catch (e) {
    console.error("calendar-reminders (supabase emails) error:", e);
    return [];
  }
}

// Resuelve el correo de una persona: primero contacts.ts (hardcode), luego Supabase (self-service).
function emailFor(person: string, supaEmails: { name: string; email: string }[]): string | null {
  const fromContacts = findContact(person)?.email?.trim();
  if (fromContacts) return fromContacts;
  const fromSupabase = supaEmails.find((r) => samePerson(r.name, person));
  return fromSupabase?.email ?? null;
}

// /api/calendar-reminders — recordatorios 9am/4pm en Google Calendar por publicación.
//
//   POST   { ...publication }   crea o ACTUALIZA los 2 eventos e invita por correo.
//   DELETE { id }               borra los 2 eventos de esa publicación.
//
//   No guarda IDs en la base: el id de cada evento se deriva del id de la publicación
//   (hex) + la hora, así que actualizar/borrar es idempotente sin almacenar nada.
//
//   Auth: OAuth de una cuenta organizadora (refresh token). Ver RECORDATORIOS_CALENDAR.md.
//     GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID (opc.)

const COUNTRY_TZ: Record<string, string> = {
  CO: "America/Bogota",
  PE: "America/Lima",
  CL: "America/Santiago",
  MX: "America/Mexico_City",
  AR: "America/Argentina/Buenos_Aires",
  LATAM: "America/Bogota",
};

const REMINDER_HOURS = [9, 16]; // 9 am y 4 pm

const calendarId = () => process.env.GOOGLE_CALENDAR_ID ?? "primary";

// Id de evento determinista y válido para Google Calendar (base32hex: solo [a-v0-9]).
// hex(pubId) usa 0-9a-f; el sufijo de hora son dígitos. Estable entre ediciones.
function eventId(pubId: string, hour: number): string {
  const hex = Buffer.from(String(pubId)).toString("hex");
  return `lcr${hex}${String(hour).padStart(2, "0")}`;
}

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("google token error:", await res.text());
    return null;
  }
  return (await res.json()).access_token ?? null;
}

const calUrl = (suffix = "") =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events${suffix}`;

// Borra un evento por id; ignora 404/410 (ya no existe).
async function deleteEvent(at: string, id: string): Promise<void> {
  const res = await fetch(`${calUrl("/" + id)}?sendUpdates=all`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${at}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    console.error("calendar delete error:", res.status, await res.text());
  }
}

// Crea o actualiza el evento con id fijo: PATCH; si no existe (404/410), INSERT con ese id.
async function upsertEvent(at: string, id: string, event: Record<string, unknown>): Promise<boolean> {
  const patch = await fetch(`${calUrl("/" + id)}?sendUpdates=all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (patch.ok) return true;
  if (patch.status !== 404 && patch.status !== 410) {
    console.error("calendar patch error:", patch.status, await patch.text());
    return false;
  }
  const insert = await fetch(`${calUrl()}?sendUpdates=all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...event }),
  });
  if (!insert.ok) {
    console.error("calendar insert error:", insert.status, await insert.text());
    return false;
  }
  return true;
}

function buildEvent(pub: Record<string, unknown>, hour: number, tz: string, attendees: { email: string }[]) {
  const hh = String(hour).padStart(2, "0");
  return {
    summary: `📣 Publicar en LinkedIn: ${pub.title ?? ""}`.trim(),
    description:
      "Recordatorio para publicar en LinkedIn.\n\n" +
      (pub.category ? `Tema: ${pub.category}\n` : "") +
      (pub.country ? `País: ${pub.country}\n` : "") +
      (pub.content ? `\nIdea base:\n${pub.content}\n` : ""),
    start: { dateTime: `${pub.startDate}T${hh}:00:00`, timeZone: tz },
    end: { dateTime: `${pub.startDate}T${hh}:30:00`, timeZone: tz },
    attendees,
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
  };
}

export async function POST(request: Request) {
  try {
    const pub = await request.json();
    const startDate: string = pub?.startDate;
    const people: string[] = pub?.people ?? [];
    if (!pub?.id || !startDate) {
      return NextResponse.json({ ok: false, error: "Falta id o startDate" }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, reason: "not_configured", error: "Faltan credenciales de Google." },
        { status: 200 }
      );
    }

    // Correos de las personas asignadas (contacts.ts + correos cargados en su perfil de tono)
    const supaEmails = await loadSupabaseEmails();
    const emails: string[] = [];
    const missing: string[] = [];
    for (const p of people) {
      const email = emailFor(p, supaEmails);
      if (email) emails.push(email);
      else missing.push(p);
    }

    // Sin destinatarios → asegurarse de que no queden eventos viejos (p. ej. se quitaron todas
    // las personas al editar) y salir.
    if (emails.length === 0) {
      for (const hour of REMINDER_HOURS) await deleteEvent(accessToken, eventId(pub.id, hour));
      return NextResponse.json(
        { ok: false, reason: "no_emails", error: "Ninguna de las personas tiene correo cargado (ni en contacts.ts ni en su perfil de tono).", missing },
        { status: 200 }
      );
    }

    const tz = COUNTRY_TZ[pub.country] ?? "America/Bogota";
    const attendees = emails.map((email) => ({ email }));

    const ids: string[] = [];
    for (const hour of REMINDER_HOURS) {
      const id = eventId(pub.id, hour);
      const ok = await upsertEvent(accessToken, id, buildEvent(pub, hour, tz, attendees));
      if (!ok) return NextResponse.json({ ok: false, error: "Falló la creación/actualización del evento" }, { status: 502 });
      ids.push(id);
    }

    return NextResponse.json({ ok: true, ids, invited: emails, missing });
  } catch (err) {
    console.error("calendar-reminders POST error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 });

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 200 });
    }

    for (const hour of REMINDER_HOURS) await deleteEvent(accessToken, eventId(id, hour));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("calendar-reminders DELETE error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
