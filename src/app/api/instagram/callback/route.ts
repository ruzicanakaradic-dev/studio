import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getLongLivedToken, getMe, saveConnection } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
}

/** Meta vraća korisnika ovde sa `code` — razmenimo ga za token i sačuvamo nalog. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const cookieState = req.cookies.get("ig_oauth_state")?.value;
  const appBase = baseUrl(req);
  const back = (status: string) => NextResponse.redirect(`${appBase}/studio?ig=${status}`);

  if (oauthError) return back("error");
  if (!code || !state || !cookieState || state !== cookieState) return back("error");

  try {
    const redirectUri = `${appBase}/api/instagram/callback`;
    const short = await exchangeCode(code, redirectUri);
    const long = await getLongLivedToken(short.accessToken);
    const me = await getMe(long.accessToken);
    const ok = await saveConnection({
      igUserId: me.id,
      username: me.username,
      accessToken: long.accessToken,
      expiresIn: long.expiresIn,
    });
    const res = back(ok ? "connected" : "error");
    res.cookies.delete("ig_oauth_state");
    return res;
  } catch {
    return back("error");
  }
}
