# RDK Studio (Ružini domaći kolači)

## Ko je ko
- **Ružica** — vlasnica brenda, krajnji korisnik app-a. Nije tehnička osoba — svaka
  UI promena mora ostati jednostavna (jedan tap, jasan jezik, bez žargona).
- **Igor** — jedini developer/deployer. Sve tehničke odluke i Meta/Vercel podešavanja su na njemu.

## Stack (ne Vite — Next.js!)
Next.js 16 App Router + TypeScript + Tailwind v4 + Supabase (Postgres/Auth/Storage) + Vercel.
Detalji setupa/strukture: `README.md`. UI i copy su na srpskom — piši ih tako.

## Ključni gotcha: demo vs. Supabase režim
`src/lib/store.ts` je data-sloj koji radi u DVA režima: sa Supabase env promenljivama
(prava baza) ili bez njih (in-memory demo, `SAMPLE_PROJECTS`/`SAMPLE_MEDIA`). Kod izgleda
kao da uvek čita/piše u bazu — proveri koji je režim aktivan pre nego što pretpostaviš
da se nešto trajno čuva. Ne mešaj demo podatke u realnu šemu bez odobrenja.

## Instagram objavljivanje — trenutno ručno
„Objavi na Instagram" dugme u koraku Sačuvaj je isključeno (Instagram API greška na
strani Meta-e). Ružica trenutno ručno skida sliku/tekst i objavljuje (vidi
`UPUTSTVO-RUZICA.md`). Ne uključuj automatski publish flow dok Igor eksplicitno ne
potvrdi da je Meta strana rešena — vidi `INSTAGRAM_SETUP.md` za OAuth/token detalje.

## Produkcioni domen je fiksan
Jedina stalna adresa je `studio-green-rho-18.vercel.app` — koristi se u Meta OAuth
redirect URI-ju i `NEXT_PUBLIC_APP_URL`. Nikad ne referenciraj privremeni
per-deploy URL (`...-xxxxx-...vercel.app`) u kodu, docs ili env primerima.

## Supabase migracije
`supabase/migrations/*.sql` se primenjuju ručno kroz SQL Editor (nema `supabase db push`
workflow ovde). Nova migracija = novi numerisan fajl, nikad izmena postojećeg.

## Style
- Komentari u kodu su na engleskom, UI stringovi na srpskom — ne mešaj.
- Ne dodavaj auth/login ekran dok Igor to eksplicitno ne zatraži (store.ts je
  "auth-ready" ali anonymous-only za sada — vidi roadmap u README.md).
- App je instalabilna na home screen (manifest, `display: standalone`) — Ružica je
  koristi primarno na iPhone-u, vodi računa o tap target-ima. Nema service worker-a,
  pa nema offline keširanja o kom treba brinuti.

## Accounts & access
- Island: RDK — GitHub `ruzicanakaradic-dev`, Vercel nalog "Ruzica's projects".
- Supabase projekat: `studio` (ref `nzaqciwlqjdlyxifmsot`, West EU/Ireland).
- Ne gađaj personal (`igorpesic`) ni WMG naloge odavde. Ako konektor/CLI ne vidi resurs koji očekuješ, stani i pitaj — verovatno je autentikovan na drugi nalog.
