import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const KEY = "publications";

export async function GET() {
  try {
    const data = await kv.get<unknown[]>(KEY);
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const pubs = await request.json();
    await kv.set(KEY, pubs);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
