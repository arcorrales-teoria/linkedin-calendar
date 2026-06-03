import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  "https://kbtbqsglagdurlqtlnww.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("publications")
      .select("*")
      .order("start_date", { ascending: true });

    if (error) throw error;

    const pubs = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      startDate: row.start_date,
      endDate: row.end_date,
      country: row.country,
      people: row.people ?? [],
    }));

    return NextResponse.json(pubs);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const pub = await request.json();

    const row = {
      id: pub.id,
      title: pub.title,
      content: pub.content ?? "",
      start_date: pub.startDate,
      end_date: pub.endDate,
      country: pub.country,
      people: pub.people ?? [],
    };

    const { error } = await supabase
      .from("publications")
      .upsert(row, { onConflict: "id" });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    const { error } = await supabase.from("publications").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
