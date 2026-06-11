import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabase = createClient(
  "https://kbtbqsglagdurlqtlnww.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROFILE_DIR = () => path.join(process.cwd(), "tone_profiles");

function normalize(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
}

function listProfileFiles(): string[] {
  const dir = PROFILE_DIR();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "TEMPLATE.md");
}

function findProfileFile(personName: string): string | null {
  const nameParts = normalize(personName)
    .split(/\s+/)
    .filter((p) => p.length > 2);
  if (nameParts.length === 0) return null;

  for (const file of listProfileFiles()) {
    const fileNorm = normalize(file);
    if (nameParts.every((part) => fileNorm.includes(part))) {
      return path.join(PROFILE_DIR(), file);
    }
  }
  return null;
}

// GET /api/tone-profile            → archivos + personas con perfil disponible
// GET /api/tone-profile?person=X   → perfil de tono de esa persona (si existe)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const person = searchParams.get("person");

    if (!person) {
      const files = listProfileFiles();
      const people = files
        .map((f) => {
          try {
            const md = fs.readFileSync(path.join(PROFILE_DIR(), f), "utf8");
            const m = md.match(/\*\*Nombre\*\*\s*\|\s*([^|\n]+)/);
            return { fileName: f, name: m?.[1]?.trim() ?? "" };
          } catch {
            return { fileName: f, name: "" };
          }
        })
        .filter((p) => p.name);
      return NextResponse.json({ ok: true, files, people });
    }

    const filePath = findProfileFile(person);
    if (!filePath) {
      return NextResponse.json({ ok: true, found: false });
    }

    const md = fs.readFileSync(filePath, "utf8");
    const styleMatch = md.match(/\*\*Estilo detectado\*\*\s*\|\s*([^|\n]+)/);

    return NextResponse.json({
      ok: true,
      found: true,
      fileName: path.basename(filePath),
      style: styleMatch?.[1]?.trim() ?? null,
    });
  } catch (err) {
    console.error("tone-profile GET error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// POST /api/tone-profile → crea/actualiza el tono de una persona:
//  1. fila en Supabase (tabla tone_profiles)
//  2. archivo markdown en tone_profiles/ (lo usa el generador)
export async function POST(request: Request) {
  try {
    const profile = await request.json();
    const name: string = (profile?.personName ?? "").trim();
    const sample: string = (profile?.sampleText ?? "").trim();

    if (!name || sample.length < 30) {
      return NextResponse.json(
        { ok: false, error: "Falta el nombre o el texto de muestra" },
        { status: 400 }
      );
    }

    // 1 ── Supabase (base general del proyecto, una fila por persona)
    let supabaseSaved = false;
    let supabaseError: string | null = null;
    try {
      const { error } = await supabase.from("tone_profiles").upsert(
        {
          person_name: name,
          linkedin_url: profile.linkedinUrl ?? "",
          sample_text: sample,
          writing_style: profile.writingStyle ?? "profesional",
          uses_emojis: !!profile.usesEmojis,
          uses_hashtags: !!profile.usesHashtags,
          uses_questions: !!profile.usesQuestions,
          uses_lists: !!profile.usesLists,
          avg_words_per_post: profile.avgWordsPerPost ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "person_name" }
      );
      if (error) supabaseError = error.message;
      else supabaseSaved = true;
    } catch (e) {
      supabaseError = String(e);
    }

    // 2 ── Archivo de perfil (no se sobreescriben los perfiles hechos a mano)
    const styleLabel =
      (profile.writingStyle ?? "profesional").charAt(0).toUpperCase() +
      (profile.writingStyle ?? "profesional").slice(1);
    const dateLabel = new Date().toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let filePath = findProfileFile(name);
    if (filePath) {
      let md = fs.readFileSync(filePath, "utf8");
      md +=
        `\n\n---\n\n## Actualización desde la app — ${dateLabel}\n\n` +
        `Estilo detectado: ${styleLabel} · ~${profile.avgWordsPerPost ?? "?"} palabras/post\n\n` +
        "```\n" + sample + "\n```\n";
      fs.writeFileSync(filePath, md, "utf8");
    } else {
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      filePath = path.join(PROFILE_DIR(), `perfil-tono-${slug}.md`);
      const md = `# Perfil de Tono — ${name}

| Campo | Valor |
|-------|-------|
| **Nombre** | ${name} |
| **LinkedIn** | ${profile.linkedinUrl || "—"} |
| **Estilo detectado** | ${styleLabel} |

---

## Configuración sugerida en el generador

\`\`\`json
${JSON.stringify(
  {
    personName: name,
    linkedinUrl: profile.linkedinUrl ?? "",
    writingStyle: profile.writingStyle ?? "profesional",
    usesEmojis: !!profile.usesEmojis,
    usesHashtags: !!profile.usesHashtags,
    usesQuestions: !!profile.usesQuestions,
    usesLists: !!profile.usesLists,
    avgWordsPerPost: profile.avgWordsPerPost ?? null,
  },
  null,
  2
)}
\`\`\`

---

## Posts de referencia (para cargar en la app)

\`\`\`
${sample}
\`\`\`

---

_Creado desde la app el ${dateLabel}._
`;
      fs.writeFileSync(filePath, md, "utf8");
    }

    return NextResponse.json({
      ok: true,
      supabase: supabaseSaved,
      supabaseError,
      fileName: path.basename(filePath),
    });
  } catch (err) {
    console.error("tone-profile POST error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
