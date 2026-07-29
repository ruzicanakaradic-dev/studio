"use client";

/**
 * Dnevnik (Log) — beleži šta se dešavalo u Studiju, jezikom koji svako razume.
 * Čuva se lokalno na uređaju (poslednjih ~150 događaja).
 */

export type LogKind = "ok" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  t: number; // ms timestamp
  kind: LogKind;
  title: string; // kratko, ljudski
  detail?: string; // dodatno objašnjenje (i dalje ljudski)
}

const KEY = "ruzini_log";
const MAX = 150;
let mem: LogEntry[] | null = null;
const subs = new Set<() => void>();
let seq = 0;

function load(): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    return [];
  }
}
function persist() {
  if (typeof window === "undefined" || !mem) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(mem.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function getLog(): LogEntry[] {
  if (mem === null) mem = load();
  return mem;
}

export function logEvent(kind: LogKind, title: string, detail?: string): void {
  if (mem === null) mem = load();
  seq += 1;
  const e: LogEntry = {
    id: `${Date.now()}_${seq}`,
    t: Date.now(),
    kind,
    title,
    detail,
  };
  mem = [e, ...mem].slice(0, MAX);
  persist();
  subs.forEach((f) => f());
}

export function clearLog(): void {
  mem = [];
  persist();
  subs.forEach((f) => f());
}

export function subscribeLog(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** „pre 2 min", „danas 18:05", „juče 09:12" … */
export function formatWhen(t: number): string {
  const now = Date.now();
  const diff = Math.round((now - t) / 1000);
  if (diff < 60) return "upravo sada";
  if (diff < 3600) return `pre ${Math.floor(diff / 60)} min`;
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const y = new Date(now - 864e5);
  const isYesterday = d.toDateString() === y.toDateString();
  if (isToday) return `danas u ${hh}:${mm}`;
  if (isYesterday) return `juče u ${hh}:${mm}`;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}. u ${hh}:${mm}`;
}
