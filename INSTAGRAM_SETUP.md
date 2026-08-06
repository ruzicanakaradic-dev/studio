# Povezivanje Studija sa Instagramom (najprostiji način — „nalepi token")

Cilj: u aplikaciji (korak „Sačuvaj") postoji dugme **„Objavi na Instagram"** koje
jednim tapom šalje sliku/carousel/reels sa opisom i hashtagovima direktno na Ružičin
nalog.

Ovaj način **ne koristi OAuth** — nema „Poveži" dugmeta, nema redirect adrese, nema
callback-a. Napraviš token jednom i nalepiš ga u Vercel. To je sve.

---

## Korak 1 — Instagram na Professional

U Instagram aplikaciji: Podešavanja → „Account type and tools" → **Switch to
professional account** → *Creator* ili *Business*. (Facebook stranica NIJE potrebna.)

## Korak 2 — Meta aplikacija + token

1. **developers.facebook.com** → prijava → **My Apps** → **Create App** → izaberi
   use case sa **Instagram** („Access the Instagram API with Instagram Login").
2. U aplikaciji: **Instagram** → **API setup with Instagram login**.
3. U delu „**Generate access tokens**" dodaj Ružičin Instagram nalog (ona potvrdi
   prijavu) i klikni **Generate token**. Kopiraj taj token (to je pristupni token).
4. Da token traje 60 dana (a ne 1 sat), otvori ovaj link u browseru — zameni
   `APP_SECRET` (Meta app → App settings → Basic → App secret) i `KRATAK_TOKEN`:

   ```
   https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=APP_SECRET&access_token=KRATAK_TOKEN
   ```

   Iz odgovora kopiraj `access_token` — to je **dugotrajni token** (IG_ACCESS_TOKEN).

5. Uzmi **IG_USER_ID** — otvori u browseru (zameni token):

   ```
   https://graph.instagram.com/me?fields=id,username&access_token=DUGOTRAJNI_TOKEN
   ```

   Kopiraj vrednost `id`.

## Korak 3 — Nalepi u Vercel

Vercel → projekat → **Settings → Environment Variables** (Production i Preview):

| Ime | Vrednost |
|---|---|
| `IG_ACCESS_TOKEN` | dugotrajni token iz koraka 2.4 |
| `IG_USER_ID` | id iz koraka 2.5 |

Sačuvaj → **Redeploy**. Gotovo — u koraku „Sačuvaj" sada stoji **„Objavi na
Instagram (@nalog)"**. Napišeš opis + hashtagove u koraku „Tekst" i tapneš objavu.

> Bezbednost: ove varijable su **serverske** (bez `NEXT_PUBLIC_`). Token nikad ne ide
> u browser.

---

## (Opciono) Da se token sam produžava — bez ručnog ponavljanja

Token traje ~60 dana. Ako želiš da se sam obnavlja (da ne moraš da ga menjaš svaka
dva meseca), dodaj još:

1. Pokreni `supabase/migrations/0002_instagram.sql` u Supabase SQL Editoru.
2. U Vercel env dodaj:
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API → `service_role`
   - `CRON_SECRET` — izmišljen dug string
3. Redeploy. `vercel.json` već sadrži cron koji svakog 1. u mesecu produži token.

Ako ovo preskočiš, sve radi — samo ćeš na ~2 meseca ponoviti korak 2 (nov token).

## Ograničenja (dobro je znati)

- Slike se šalju kao **JPEG** (aplikacija to radi automatski).
- **Reels/video** Instagram prvo obradi, pa objava traje malo duže (par sekundi do
  minut). Aplikacija sačeka da bude spreman.
- Limit je **100 objava za 24h** (carousel = 1) — više nego dovoljno.
- Ako objava padne, u **Dnevniku** piše razlog na jasnom jeziku.

## Napredno (ako ipak želiš „Poveži Instagram" dugme / OAuth)

Kod podržava i OAuth put. Tada umesto `IG_ACCESS_TOKEN`/`IG_USER_ID` postaviš
`META_APP_ID`, `META_APP_SECRET`, `NEXT_PUBLIC_APP_URL` i u Meta app-u dodaš redirect
`https://TVOJ-DOMEN/api/instagram/callback`. Ali „nalepi token" je jednostavniji i
preporučen za jedan nalog.

## Gde je šta u kodu

- `src/lib/instagram.ts` — token (env ili baza), osvežavanje, kreiranje kontejnera, objava.
- `src/app/api/instagram/*` — `status`, `publish`, `refresh` (+ `connect`/`callback` za OAuth put).
- UI: korak „Sačuvaj" u `src/components/Studio.tsx` + `renderSlideJpeg` u `src/lib/exporter.ts`.
