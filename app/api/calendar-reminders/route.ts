import { NextResponse } from "next/server";
import { findContact } from "@/app/data/contacts";

// POST /api/calendar-reminders
//   Crea 2 eventos en Google Calendar (9:00 y 16:00, hora local del país de la tarjeta)
//   el día de la publicación, e invita por correo a cada persona asignada.
//   Lo dispara la app al crear una publicación nueva (ver savePub en app/page.tsx).
//
//   Auth: OAuth de una cuenta organizadora (un service account NO puede invitar
//   asistentes sin delegación de Workspace). Variables de entorno necesarias:
//     GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//     GOOGLE_CALENDAR_ID (opcional, por defecto "primary")
//   Cómo obtenerlas: ver RECORDATORIOS_CALENDAR.md

const COUNTRY_TZ: Record<string, string> = {
  CO: "America/Bogota",
  PE: "America/Lima",
  CL: "America/Santiago",
  MX: "America/Mexico_City",
  AR: "America/Argentina/Buenos_Aires",
  LATAM: "America/Bogota",
};

const REMINDER_HOURS = [9, 16]; // 9 am y 4 pm

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
  const data = await res.json();
  return data.access_token ?? null;
}

export async function POST(request: Request) {
  try {
    const pub = await request.json();
    const startDate: string = pub?.startDate;
    const people: string[] = pub?.people ?? [];

    if (!startDate) {
      return NextResponse.json({ ok: false, error: "Falta startDate" }, { status: 400 });
    }

    // Resolver correos desde contacts.ts (las personas sin correo se reportan, no se invitan)
    const emails: string[] = [];
    const missing: string[] = [];
    for (const p of people) {
      const email = findContact(p)?.email?.trim();
      if (email) emails.push(email);
      else missing.push(p);
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, reason: "not_configured", error: "Faltan credenciales de Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)." },
        { status: 200 }
      );
    }
    if (emails.length === 0) {
      return NextResponse.json(
        { ok: false, reason: "no_emails", error: "Ninguna de las personas tiene correo cargado en contacts.ts.", missing },
        { status: 200 }
      );
    }

    const tz = COUNTRY_TZ[pub.country] ?? "America/Bogota";
    const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
    const attendees = emails.map((email) => ({ email }));

    const created: string[] = [];
    for (const hour of REMINDER_HOURS) {
      const hh = String(hour).padStart(2, "0");
      const event = {
        summary: `📣 Publicar en LinkedIn: ${pub.title ?? ""}`.trim(),
        description:
          "Recordatorio para publicar en LinkedIn.\n\n" +
          (pub.category ? `Tema: ${pub.category}\n` : "") +
          (pub.country ? `País: ${pub.country}\n` : "") +
          (pub.content ? `\nIdea base:\n${pub.content}\n` : ""),
        start: { dateTime: `${startDate}T${hh}:00:00`, timeZone: tz },
        end: { dateTime: `${startDate}T${hh}:30:00`, timeZone: tz },
        attendees,
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
      };

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(event),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        console.error("calendar event error:", err);
        return NextResponse.json({ ok: false, error: err, created }, { status: res.status });
      }
      const data = await res.json();
      created.push(data.id);
    }

    return NextResponse.json({ ok: true, created, invited: emails, missing });
  } catch (err) {
    console.error("calendar-reminders error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
