import { NextResponse } from "next/server";
import { getConnection, isInstagramConfigured } from "@/lib/instagram";
import { isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status veze — bez tokena (token nikad ne ide na klijent). */
export async function GET() {
  const configured = isInstagramConfigured && isAdminConfigured;
  let connected = false;
  let username: string | null = null;
  let expiresAt: string | null = null;
  if (configured) {
    const conn = await getConnection();
    connected = Boolean(conn?.access_token && conn?.ig_user_id);
    username = conn?.username ?? null;
    expiresAt = conn?.expires_at ?? null;
  }
  return NextResponse.json({ configured, connected, username, expiresAt });
}
