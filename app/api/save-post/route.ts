import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function normalize(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
}

function findProfileFile(personName: string): string | null {
  const dir = path.join(process.cwd(), "tone_profiles");
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir).filter(
    (f) => f.endsWith(".md") && f !== "README.md" && f !== "TEMPLATE.md"
  );

  const nameParts = normalize(personName)
    .split(/\s+/)
    .filter((p) => p.length > 2);

  for (const file of files) {
    const fileNorm = normalize(file);
    if (nameParts.every((part) => fileNorm.includes(part))) {
      return path.join(dir, file);
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const { personName, content, topic, date } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ ok: false, error: "No content" }, { status: 400 });
    }

    const filePath = personName ? findProfileFile(personName) : null;

    if (filePath) {
      // Append the post to the "Posts guardados" section of the profile file
      let md = fs.readFileSync(filePath, "utf8");

      const savedSection = "\n\n---\n\n## Posts guardados\n\n";
      const entryHeader = `### ${date ?? new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}${topic ? ` — ${topic}` : ""}\n\n`;
      const entryBody = "```\n" + content.trim() + "\n```\n";
      const entry = entryHeader + entryBody;

      if (md.includes("## Posts guardados")) {
        // Append after the last entry in the section
        md = md + "\n---\n\n" + entry;
      } else {
        md = md + savedSection + entry;
      }

      fs.writeFileSync(filePath, md, "utf8");

      return NextResponse.json({
        ok: true,
        savedTo: path.basename(filePath),
        personName,
      });
    } else {
      // No person or file not found — just acknowledge without saving to file
      return NextResponse.json({
        ok: true,
        savedTo: null,
        personName: personName ?? null,
        note: "No matching tone profile file found",
      });
    }
  } catch (err) {
    console.error("save-post error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
