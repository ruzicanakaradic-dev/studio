import { createAdminClient, isAdminConfigured } from "./supabase/admin";

/**
 * Instagram Platform API — "Instagram API with Instagram Login" (bez Facebook stranice).
 * Tok objave: napravi kontejner (POST /{ig-id}/media) → objavi (POST /{ig-id}/media_publish).
 * Token se čuva serverski (Supabase ig_connection) i osvežava pre isteka.
 *
 * Sve funkcije su serverske (server-only) — token nikada ne napušta backend.
 */

export const IG_SCOPES = "instagram_business_basic,instagram_business_content_publish";
const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH = "https://graph.instagram.com";

export const IG_APP_ID = process.env.META_APP_ID ?? process.env.INSTAGRAM_APP_ID ?? "";
const IG_APP_SECRET = process.env.META_APP_SECRET ?? process.env.INSTAGRAM_APP_SECRET ?? "";

// Najprostiji put: token se nalepi kao env varijabla (bez OAuth-a).
const ENV_IG_TOKEN = process.env.IG_ACCESS_TOKEN ?? "";
const ENV_IG_USER_ID = process.env.IG_USER_ID ?? "";

export const hasEnvToken = Boolean(ENV_IG_TOKEN && ENV_IG_USER_ID);
// Aplikacija je „spremna za Instagram" ako imamo ILI nalepljen token ILI OAuth ključeve.
export const isInstagramConfigured = Boolean(hasEnvToken || (IG_APP_ID && IG_APP_SECRET));

// ————————————————————————————— OAuth ——————————————————————————————

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: IG_APP_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: IG_SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${p.toString()}`;
}

/** Kod → kratkotrajni token (i ig user id). */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; userId: string }> {
  const body = new URLSearchParams({
    client_id: IG_APP_ID,
    client_secret: IG_APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(igErr("Razmena koda nije uspela", data));
  // odgovor može biti { access_token, user_id } ili { data: [{...}] }
  const token = data.access_token ?? data.data?.[0]?.access_token;
  const userId = String(data.user_id ?? data.data?.[0]?.user_id ?? "");
  if (!token) throw new Error("Instagram nije vratio token.");
  return { accessToken: token, userId };
}

/** Kratkotrajni → dugotrajni token (~60 dana). */
export async function getLongLivedToken(
  shortToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const p = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: IG_APP_SECRET,
    access_token: shortToken,
  });
  const res = await fetch(`${GRAPH}/access_token?${p.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(igErr("Dobavljanje dugotrajnog tokena nije uspelo", data));
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in ?? 5184000) };
}

/** Produži dugotrajni token (poziva se pre isteka). */
export async function refreshLongLivedToken(
  token: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const p = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token });
  const res = await fetch(`${GRAPH}/refresh_access_token?${p.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(igErr("Osvežavanje tokena nije uspelo", data));
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in ?? 5184000) };
}

export async function getMe(token: string): Promise<{ id: string; username: string }> {
  const p = new URLSearchParams({ fields: "id,username", access_token: token });
  const res = await fetch(`${GRAPH}/me?${p.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(igErr("Čitanje naloga nije uspelo", data));
  return { id: String(data.id), username: String(data.username ?? "") };
}

// ————————————————————————————— Baza (token) ——————————————————————————————

export interface IgConnection {
  ig_user_id: string | null;
  username: string | null;
  access_token: string | null;
  expires_at: string | null;
  connected_at: string | null;
}

export async function getConnection(): Promise<IgConnection | null> {
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db.from("ig_connection").select("*").eq("id", "default").maybeSingle();
  return (data as IgConnection) ?? null;
}

export async function saveConnection(v: {
  igUserId: string;
  username: string;
  accessToken: string;
  expiresIn: number;
}): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const expiresAt = new Date(Date.now() + v.expiresIn * 1000).toISOString();
  const { error } = await db.from("ig_connection").upsert({
    id: "default",
    ig_user_id: v.igUserId,
    username: v.username,
    access_token: v.accessToken,
    token_type: "long_lived",
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  return !error;
}

export async function clearConnection(): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { error } = await db.from("ig_connection").delete().eq("id", "default");
  return !error;
}

/**
 * Vrati važeći token; ako ističe za <7 dana, osveži ga i sačuvaj.
 * Vraća null ako nalog nije povezan.
 */
export async function getValidToken(): Promise<{ token: string; igUserId: string } | null> {
  const conn = await getConnection();
  if (conn?.access_token && conn.ig_user_id) {
    let token = conn.access_token;
    const expMs = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    if (expMs && expMs - Date.now() < weekMs) {
      try {
        const r = await refreshLongLivedToken(token); // ne traži app secret — dovoljan je token
        token = r.accessToken;
        await saveConnection({
          igUserId: conn.ig_user_id,
          username: conn.username ?? "",
          accessToken: r.accessToken,
          expiresIn: r.expiresIn,
        });
      } catch {
        // ako osvežavanje padne, probaj sa postojećim tokenom
      }
    }
    return { token, igUserId: conn.ig_user_id };
  }

  // Nema reda u bazi — „nalepi token" put (env varijable).
  if (hasEnvToken) {
    // ako je Supabase dostupan, poseji bazu da bi kasnije radilo auto-osvežavanje
    if (isAdminConfigured) {
      try {
        const me = await getMe(ENV_IG_TOKEN);
        await saveConnection({
          igUserId: me.id || ENV_IG_USER_ID,
          username: me.username,
          accessToken: ENV_IG_TOKEN,
          expiresIn: 60 * 24 * 60 * 60,
        });
        return { token: ENV_IG_TOKEN, igUserId: me.id || ENV_IG_USER_ID };
      } catch {
        /* i dalje koristi env token direktno */
      }
    }
    return { token: ENV_IG_TOKEN, igUserId: ENV_IG_USER_ID };
  }

  return null;
}

/** Status veze za UI — pokriva i „nalepi token" i OAuth put. */
export async function getStatus(): Promise<{ connected: boolean; username: string | null; expiresAt: string | null }> {
  const conn = await getConnection();
  if (conn?.access_token && conn.ig_user_id) {
    return { connected: true, username: conn.username ?? null, expiresAt: conn.expires_at ?? null };
  }
  if (hasEnvToken) {
    let username: string | null = null;
    try {
      username = (await getMe(ENV_IG_TOKEN)).username;
    } catch {
      /* nalog povezan ali ime nije dostupno */
    }
    return { connected: true, username, expiresAt: null };
  }
  return { connected: false, username: null, expiresAt: null };
}

// ————————————————————————————— Objavljivanje ——————————————————————————————

export type PublishFormat = "post" | "story" | "reels" | "carousel";
export interface PublishItem {
  imageUrl?: string; // javni JPEG
  videoUrl?: string; // javni MP4
}

async function graphPost(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params);
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(igErr("Instagram zahtev nije uspeo", data));
  return data;
}

async function createImageContainer(
  igId: string,
  token: string,
  imageUrl: string,
  caption: string,
  isCarouselItem = false,
): Promise<string> {
  const params: Record<string, string> = { image_url: imageUrl, access_token: token };
  if (isCarouselItem) params.is_carousel_item = "true";
  else if (caption) params.caption = caption;
  const d = await graphPost(`${igId}/media`, params);
  return String(d.id);
}

async function createVideoContainer(
  igId: string,
  token: string,
  videoUrl: string,
  caption: string,
  mediaType: "REELS" | "STORIES",
  isCarouselItem = false,
): Promise<string> {
  const params: Record<string, string> = {
    media_type: mediaType,
    video_url: videoUrl,
    access_token: token,
  };
  if (isCarouselItem) params.is_carousel_item = "true";
  else if (caption) params.caption = caption;
  const d = await graphPost(`${igId}/media`, params);
  return String(d.id);
}

/** Sačekaj da video/reels kontejner bude spreman (status FINISHED). */
async function waitForContainer(containerId: string, token: string): Promise<void> {
  const p = new URLSearchParams({ fields: "status_code", access_token: token });
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${GRAPH}/${containerId}?${p.toString()}`);
    const data = await res.json();
    const status = data.status_code as string | undefined;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") throw new Error("Instagram nije uspeo da obradi video.");
    await sleep(4000);
  }
  throw new Error("Obrada videa predugo traje — pokušaj ponovo za koji minut.");
}

async function publishContainer(igId: string, token: string, creationId: string): Promise<string> {
  const d = await graphPost(`${igId}/media_publish`, { creation_id: creationId, access_token: token });
  return String(d.id);
}

async function getPermalink(mediaId: string, token: string): Promise<string | null> {
  const p = new URLSearchParams({ fields: "permalink", access_token: token });
  const res = await fetch(`${GRAPH}/${mediaId}?${p.toString()}`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.permalink as string) ?? null;
}

/**
 * Objavi kompletan post na Instagram. Bira tip po formatu i mediji.
 * Vraća { mediaId, permalink }.
 */
export async function publishToInstagram(opts: {
  igId: string;
  token: string;
  format: PublishFormat;
  items: PublishItem[];
  caption: string;
}): Promise<{ mediaId: string; permalink: string | null }> {
  const { igId, token, format, items, caption } = opts;
  const clean = items.filter((it) => it.imageUrl || it.videoUrl);
  if (clean.length === 0) throw new Error("Nema medija za objavu.");

  let creationId: string;

  if (format === "carousel" || (clean.length > 1 && format !== "reels")) {
    // Carousel: napravi decu, pa roditelja
    const children: string[] = [];
    for (const it of clean.slice(0, 10)) {
      if (it.videoUrl) {
        const c = await createVideoContainer(igId, token, it.videoUrl, "", "REELS", true);
        await waitForContainer(c, token);
        children.push(c);
      } else if (it.imageUrl) {
        children.push(await createImageContainer(igId, token, it.imageUrl, "", true));
      }
    }
    const parent = await graphPost(`${igId}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: token,
    });
    creationId = String(parent.id);
  } else {
    const it = clean[0];
    if (format === "reels" || it.videoUrl) {
      const mediaType = format === "story" ? "STORIES" : "REELS";
      creationId = await createVideoContainer(igId, token, it.videoUrl!, caption, mediaType);
      await waitForContainer(creationId, token);
    } else if (format === "story") {
      creationId = await graphPost(`${igId}/media`, {
        media_type: "STORIES",
        image_url: it.imageUrl!,
        access_token: token,
      }).then((d) => String(d.id));
    } else {
      creationId = await createImageContainer(igId, token, it.imageUrl!, caption);
    }
  }

  const mediaId = await publishContainer(igId, token, creationId);
  const permalink = await getPermalink(mediaId, token);
  return { mediaId, permalink };
}

// ————————————————————————————— pomoćne ——————————————————————————————

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function igErr(prefix: string, data: unknown): string {
  const msg = (data as { error?: { message?: string } })?.error?.message;
  return msg ? `${prefix}: ${msg}` : prefix;
}
