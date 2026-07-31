import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Serverski Supabase klijent sa service_role ključem.
 * Koristi se ISKLJUČIVO u API rutama (nikad na klijentu) — zaobilazi RLS,
 * pa se preko njega bezbedno čuva Instagram token u tabeli ig_connection.
 */
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isAdminConfigured = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

export function createAdminClient() {
  if (!isAdminConfigured) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
