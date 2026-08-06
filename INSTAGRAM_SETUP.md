# Povezivanje Studija sa Instagramom — „Poveži Instagram" dugme (OAuth)

Za Ružicu je ovo najlakše: u aplikaciji tapne **„Poveži Instagram"**, uloguje se na
Instagram, klikne „Dozvoli" — i gotovo. Nikad ne dira token ni dashboard. Ispod je
jednokratno podešavanje (radi ga Igor); Ružičin deo je samo taj jedan tap.

> **Stalna adresa** (produkcioni domen): `https://studio-green-rho-18.vercel.app`.
> NE koristi link sa nasumičnim delom (npr. `...-d9lo7stvz-...`) — to je jedan deploy
> i menja se.

---

## Korak 1 — Instagram na Professional
Instagram app → Podešavanja → „Account type and tools" → **Switch to professional
account** → *Creator* ili *Business*. (Facebook stranica NIJE potrebna.)

## Korak 2 — Meta aplikacija
1. **developers.facebook.com** → **My Apps** → **Create App**.
2. Izaberi use case sa **Instagram** („Access the Instagram API with Instagram Login").
3. Otvori **Instagram → API setup with Instagram login**.
4. U **Business login settings / OAuth**, u polje **Valid OAuth Redirect URIs** nalepi:
   ```
   https://studio-green-rho-18.vercel.app/api/instagram/callback
   ```
5. Zapamti **Instagram App ID** i **Instagram App Secret** (App settings → Basic).

## Korak 3 — Dodaj Ružičin nalog kao tester
App → **App roles → Roles** (ili Instagram → Roles) → dodaj Ružičin Instagram →
ona prihvati poziv u Instagramu (Settings → Apps and websites → Tester invites).
Za sopstveni nalog **ne treba App Review**.

## Korak 4 — Supabase (čuva token da se sam obnavlja)
Supabase → **SQL Editor** → nalepi sadržaj `supabase/migrations/0002_instagram.sql`
→ **Run**. Zatim iz **Settings → API** kopiraj `service_role` ključ (za sledeći korak).

## Korak 5 — Vercel env varijable
Vercel → projekat → **Settings → Environment Variables** (Production + Preview):

| Ime | Vrednost |
|---|---|
| `META_APP_ID` | Instagram App ID (korak 2.5) |
| `META_APP_SECRET` | Instagram App Secret (korak 2.5) |
| `NEXT_PUBLIC_APP_URL` | `https://studio-green-rho-18.vercel.app` (bez `/` na kraju, bez `/studio`) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ključ (korak 4) |
| `CRON_SECRET` | izmišljen dug string (za automatsko obnavljanje tokena) |

Sačuvaj → **Redeploy** (da varijable uđu u pogon).

## Korak 6 — Poveži i objavi
Otvori aplikaciju → napravi/otvori objavu → korak **„Sačuvaj"** → **„Poveži
Instagram"** → uloguj se Ružičinim nalogom → „Dozvoli". Vraća te nazad i od tada u
tom koraku stoji **„Objavi na Instagram (@nalog)"**. Napišeš opis + hashtagove u
koraku „Tekst" i tapneš objavu. Po završetku dobiješ link „Otvori na Instagramu".

---

## Napomene
- Token se **sam obnavlja** (Vercel Cron u `vercel.json`, koristi `CRON_SECRET`).
- Slike idu kao **JPEG** (automatski). **Reels/video** Instagram prvo obradi, pa
  objava traje par sekundi duže.
- Limit: **100 objava / 24h** (carousel = 1).
- Ako objava padne, razlog piše u **Dnevniku** jasnim jezikom.
- Najčešća greška: redirect adresa se ne poklapa. Mora **tačno** ista u Meta app-u i u
  `NEXT_PUBLIC_APP_URL` (ista stalna adresa, `https://`, bez `/` na kraju).

## Gde je šta u kodu
- `src/lib/instagram.ts` — OAuth, token (baza ili env), obnavljanje, objava.
- `src/app/api/instagram/*` — `connect`, `callback`, `status`, `publish`, `disconnect`, `refresh`.
- UI: korak „Sačuvaj" u `src/components/Studio.tsx` + `renderSlideJpeg` u `src/lib/exporter.ts`.
