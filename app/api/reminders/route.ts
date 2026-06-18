import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { findContact } from "@/app/data/contacts";

// GET /api/reminders
//   Devuelve, ya expandido por persona, QUIÉN debe publicar QUÉ en una fecha dada.
//   Lo consume el workflow de n8n "LinkedIn Reminder" (ver n8n/README.md).
//
//   Query params:
//     ?date=YYYY-MM-DD   → fecha objetivo (por defecto: hoy en America/Bogota)
//     ?match=start|window→ "start" (default): la tarjeta arranca ese día.
//                           "window": la fecha cae dentro del rango [inicio, fin].
//
//   Seguridad (opcional): si existe la env REMINDERS_TOKEN, hay que mandar el header
//     Authorization: Bearer <REMINDERS_TOKEN>

const supabase = createClient(
  "https://kbtbqsglagdurlqtlnww.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COUNTRIES: Record<string, { label: string; flag: string }> = {
  LATAM: { label: "LATAM",     flag: "🌎" },
  CO:    { label: "Colombia",  flag: "🇨🇴" },
  AR:    { label: "Argentina", flag: "🇦🇷" },
  PE:    { label: "Peru",      flag: "🇵🇪" },
  CL:    { label: "Chile",     flag: "🇨🇱" },
  MX:    { label: "Mexico",    flag: "🇲🇽" },
};

const PROFILE_DIR = () => path.join(process.cwd(), "tone_profiles");

function normalize(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
}

// Lee el estilo de tono de la persona desde su archivo .md (si existe).
function toneFor(personName: string): { hasProfile: boolean; style: string | null; fileName: string | null } {
  try {
    const dir = PROFILE_DIR();
    if (!fs.existsSync(dir)) return { hasProfile: false, style: null, fileName: null };
    const parts = normalize(personName).split(/\s+/).filter((p) => p.length > 2);
    if (parts.length === 0) return { hasProfile: false, style: null, fileName: null };

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "TEMPLATE.md");

    for (const f of files) {
      if (parts.every((p) => normalize(f).includes(p))) {
        const md = fs.readFileSync(path.join(dir, f), "utf8");
        const m = md.match(/\*\*Estilo detectado\*\*\s*\|\s*([^|\n]+)/);
        return { hasProfile: true, style: m?.[1]?.trim() ?? null, fileName: f };
      }
    }
  } catch {
    /* noop */
  }
  return { hasProfile: false, style: null, fileName: null };
}

// Fecha de "hoy" en America/Bogota (UTC-5, sin DST) → YYYY-MM-DD.
function todayBogota(): string {
  const now = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return now.toISOString().split("T")[0];
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export async function GET(request: Request) {
  // ── Auth opcional ──
  const token = process.env.REMINDERS_TOKEN;
  if (token) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = (searchParams.get("date") || todayBogota()).trim();
    const match = searchParams.get("match") === "window" ? "window" : "start";

    let query = supabase.from("publications").select("*");
    if (match === "window") {
      query = query.lte("start_date", date).gte("end_date", date);
    } else {
      query = query.eq("start_date", date);
    }

    const { data, error } = await query.order("country", { ascending: true });
    if (error) throw error;

    const reminders = [];
    for (const row of data ?? []) {
      const country = COUNTRIES[row.country] ?? { label: row.country, flag: "" };
      const category: string = row.category ?? "—";
      const people: string[] = row.people ?? [];

      for (const person of people) {
        const contact = findContact(person);
        const chatId = contact?.telegram?.trim() || null;
        const tone = toneFor(person);

        const defaultMessage =
          `¡Hola ${firstName(person)}! 👋 Recordatorio de tu publicación de hoy en LinkedIn.\n\n` +
          `📌 ${row.title}\n` +
          `🌎 País: ${country.label} ${country.flag}\n` +
          `🏷️ Tema: ${category}\n` +
          `📅 Fecha: ${row.start_date}\n\n` +
          (row.content ? `Idea base:\n${row.content}\n\n` : "") +
          `Recuerda publicarlo en tu tono${tone.style ? ` (${tone.style})` : ""}. ¡Éxitos! 🚀`;

        reminders.push({
          person,
          role: contact?.role || null,
          chatId,
          channelReady: Boolean(chatId),
          email: contact?.email || null,
          country: { key: row.country, label: country.label, flag: country.flag },
          category,
          publication: {
            id: row.id,
            title: row.title,
            content: row.content ?? "",
            startDate: row.start_date,
            endDate: row.end_date,
          },
          tone,
          defaultMessage,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      date,
      match,
      count: reminders.length,
      reminders,
    });
  } catch (err) {
    console.error("reminders GET error:", err);
    return NextResponse.json({ ok: false, error: String(err), reminders: [] }, { status: 500 });
  }
}
