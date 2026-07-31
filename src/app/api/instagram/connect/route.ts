import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, isInstagramConfigured } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
}

/** Pokreće Instagram prijavu — preusmerava na Meta OAuth. */
export async function GET(req: NextRequest) {
  if (!isInstagramConfigured) {
    return NextResponse.redirect(`${baseUrl(req)}/studio?ig=notconfigured`);
  }
  const redirectUri = `${baseUrl(req)}/api/instagram/callback`;
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
  res.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
