# Ružini domaći kolači — Studio

Studio za kreiranje Instagram sadržaja (Objava / Story / Reels / Carousel) za brend
**Ružini domaći kolači**. Ružica pravi projekat, dodaje sliku/video, stavlja naslov,
podnaslov i CTA preko slike i izvozi objavu.

Stack: **Next.js 16 (App Router, TypeScript)** · **Tailwind v4** · **Supabase** (Postgres + Auth + Storage) · deploy na **Vercel**.

## Pokretanje lokalno

```bash
npm install
cp .env.example .env.local   # popuni Supabase ključeve (opciono za demo)
npm run dev                  # http://localhost:3000
```

Bez Supabase ključeva app radi u **demo režimu** (lokalni sample kolači + in-memory
čuvanje), pa možeš odmah da vidiš UI. Kad dodaš ključeve, projekti i mediji idu u Supabase.

## Povezivanje sa Supabase

1. Napravi projekat na [supabase.com](https://supabase.com) (region: EU npr. `eu-central`).
2. **SQL Editor → New query** → nalepi `supabase/migrations/0001_init.sql` → **Run**
   (kreira tabelu `projects`, RLS politike i `media` storage bucket).
3. **Project Settings → API** → kopiraj `Project URL` i `anon public` ključ u `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. Iste dve promenljive dodaj i u Vercel (Project → Settings → Environment Variables).

## Deploy na Vercel

Poveži GitHub repo na [vercel.com/new](https://vercel.com/new) (Next.js se detektuje
automatski), dodaj env promenljive iz koraka iznad i deploy-uj.

## Struktura

```
src/
  app/
    layout.tsx            # fontovi (Fraunces + Inter), meta
    page.tsx              # → /studio
    studio/page.tsx       # render Studio
    globals.css           # dizajn sistem (paleta, komponente)
  components/
    Studio.tsx            # ceo studio (dashboard + editor)
    icons.tsx             # SVG ikonice
  lib/
    types.ts              # tipovi + format/paleta konstante
    samples.ts            # sample kolači mediji + seed projekti
    store.ts              # data sloj (Supabase ili demo fallback)
    supabase/             # browser + server klijenti, config
supabase/migrations/      # SQL šema
public/samples/           # sample slike kolača
```

## Sledeći koraci (roadmap)

- [ ] Auth (Supabase magic-link / email) — data sloj je auth-ready, treba login ekran
- [ ] Pravi export platna u PNG/MP4 (html-to-canvas / server render)
- [ ] Upload i korišćenje pravog logotipa i brend fontova
- [ ] Deljenje i planiranje objava
