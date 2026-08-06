import { NextResponse } from "next/server";
import { getStatus, isInstagramConfigured } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status veze — bez tokena (token nikad ne ide na klijent). */
export async function GET() {
  if (!isInstagramConfigured) {
    return NextResponse.json({ configured: false, connected: false, username: null, expiresAt: null });
  }
  const s = await getStatus();
  return NextResponse.json({ configured: true, ...s });
}
