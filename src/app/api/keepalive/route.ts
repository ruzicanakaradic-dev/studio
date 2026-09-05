import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keep-alive: lagano „pipne" Supabase bazu da se ne uspava.
 * Besplatni Supabase plan pauzira projekat posle ~7 dana neaktivnosti,
 * pa ovaj zadatak (Vercel Cron, jednom dnevno) drži bazu budnom.
 *
 * Sam upit je trivijalan (count nad `projects`) — čita se preko admin
 * klijenta ako postoji service_role, inače preko anon klijenta; bilo koji
 * put dodiruje bazu, što je dovoljno da se broji kao aktivnost.
 *
 * Ako je postavljen CRON_SECRET, Vercel Cron šalje Authorization: Bearer <secret>
 * i tada je pristup zaštićen; bez CRON_SECRET-a ruta radi otvoreno (upit ništa
 * ne otkriva zbog RLS-a).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const supabase = createAdminClient() ?? (await createServerClient());
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "supabase_not_configured" });
  }

  try {
    const { error } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "keepalive_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
