import { NextResponse } from "next/server";
import { clearConnection } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Prekini vezu sa Instagram nalogom (obriši token). */
export async function POST() {
  const ok = await clearConnection();
  return NextResponse.json({ ok });
}
