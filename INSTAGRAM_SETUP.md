# Povezivanje Studija sa Instagramom (direktna objava)

Ovaj vodič je za jednokratno podešavanje. Kad se završi, u aplikaciji (korak
„Sačuvaj") postoji dugme **„Objavi na Instagram"** — jednim tapom šalje sliku/carousel/
reels sa opisom i hashtagovima direktno na Ružičin nalog.

Sve što aplikaciji treba je već napravljeno u kodu. Ostaje samo da se poveže
Ružičin Instagram i unesu ključevi. Koraci idu redom.

---

## 1. Instagram nalog → Professional

Objavljivanje preko API-ja radi samo sa *Professional* nalogom (Business ili Creator).
Besplatno je i prebacuje se u Instagram aplikaciji:

Podešavanja → Za profesionalce / „Account type and tools" → **Switch to professional
account** → izaberi *Creator* ili *Business*. (Ne mora Facebook stranica — koristimo
noviju „Instagram Login" vezu koja je ne traži.)

## 2. Meta Developer aplikacija

1. Idi na **developers.facebook.com** → prijavi se → **My Apps** → **Create App**.
2. Za tip aplikacije izaberi ono što nudi **Instagram** (use case: *Instagram* /
   „Access the Instagram API with Instagram Login").
3. U aplikaciji otvori **Instagram** proizvod → **API setup with Instagram login**.
4. Zapamti **Instagram app ID** i **Instagram app secret** (ili App ID/Secret iz
   App settings → Basic) — trebaće u koraku 4.

### Redirect URI (važno da se poklopi tačno)

U istom Instagram podešavanju, u polje **Valid OAuth Redirect URIs** dodaj:

```
https://TVOJ-DOMEN/api/instagram/callback
```

Zameni `TVOJ-DOMEN` pravim domenom aplikacije na Vercelu (npr.
`ruzini-studio.vercel.app`). Ako imaš i custom domen, dodaj oba reda.

### Dozvole (permissions)

Aplikaciji trebaju: `instagram_business_basic` i `instagram_business_content_publish`.
Dok je Meta app u *Development* modu, dovoljno je da Ružičin nalog bude dodat kao
**Instagram tester** (App roles → Roles → dodaj njen IG nalog → ona prihvati poziv u
Instagram podešavanjima: Settings → Website permissions / Apps and websites → Tester
invites). Za sopstveni nalog **ne treba App Review**. (App Review je potreban tek ako
bi aplikaciju koristili tuđi nalozi.)

## 3. Supabase — tabela za token

U Supabase Dashboard → **SQL Editor** → New query → nalepi sadržaj fajla
`supabase/migrations/0002_instagram.sql` iz repoa → **Run**. Ovo pravi tabelu u kojoj
se token čuva **samo na serveru** (nije čitljiv iz browsera).

## 4. Env varijable na Vercelu

Vercel → projekat → **Settings → Environment Variables**. Dodaj (Production i Preview):

| Ime | Vrednost | Odakle |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ključ | Supabase → Settings → API → `service_role` |
| `META_APP_ID` | Instagram/App ID | Meta app |
| `META_APP_SECRET` | Instagram/App secret | Meta app |
| `NEXT_PUBLIC_APP_URL` | `https://TVOJ-DOMEN` | domen aplikacije (bez `/` na kraju) |
| `IG_REFRESH_SECRET` | izmišljen dug string | ti biraš (za ručno osvežavanje tokena) |
| `CRON_SECRET` | izmišljen dug string | ti biraš (Vercel automatsko osvežavanje) |

Sačuvaj i **Redeploy** projekat da varijable uđu u pogon.

> Bezbednost: `SUPABASE_SERVICE_ROLE_KEY` i `META_APP_SECRET` su tajne — nikad ih ne
> stavljaj sa prefiksom `NEXT_PUBLIC_` i ne deli ih. Token pristupa Instagramu stoji
> samo na serveru; u browser nikad ne ide.

## 5. Poveži nalog iz aplikacije

Otvori aplikaciju → napravi/otvori objavu → korak **„Sačuvaj"** → **„Poveži
Instagram"** → prijavi se Ružičinim nalogom i potvrdi dozvole. Aplikacija te vraća
nazad i od tada u tom koraku stoji **„Objavi na Instagram (@nalog)"**.

## 6. Objava

Napiši opis i hashtagove u koraku „Tekst" (AI predlog je tu), pa u koraku „Sačuvaj"
tapni **„Objavi na Instagram"**. Aplikacija pripremi slike kao JPEG, otpremi ih i
objavi sa tvojim opisom. Po završetku dobiješ link „Otvori na Instagramu".

---

## Automatsko osvežavanje tokena

Token traje ~60 dana. `vercel.json` već sadrži **Vercel Cron** koji svakog 1. u mesecu
zove `/api/instagram/refresh` i produžava token (koristi `CRON_SECRET`). Ništa ne
moraš ručno. Ako želiš da osvežiš ručno, otvori:
`https://TVOJ-DOMEN/api/instagram/refresh?secret=IG_REFRESH_SECRET`.

## Ograničenja (dobro je znati)

- Slike se šalju kao **JPEG** (aplikacija to radi automatski).
- **Reels/video**: Instagram prvo obrađuje video, pa objava traje malo duže (nekoliko
  sekundi do minut). Aplikacija sačeka da bude spreman.
- Limit je **100 objava za 24h** (carousel se broji kao 1) — više nego dovoljno.
- Ako objava padne, u **Dnevniku** piše razlog na jasnom jeziku.

## Šta je gde u kodu (za razvoj)

- `src/lib/instagram.ts` — OAuth, čuvanje/osvežavanje tokena, kreiranje kontejnera i objava.
- `src/app/api/instagram/*` — rute: `connect`, `callback`, `status`, `publish`, `disconnect`, `refresh`.
- `src/lib/supabase/admin.ts` — serverski Supabase klijent (service_role).
- `supabase/migrations/0002_instagram.sql` — tabela `ig_connection`.
- UI: korak „Sačuvaj" u `src/components/Studio.tsx` (dugmad Poveži/Objavi) + `renderSlideJpeg` u `src/lib/exporter.ts`.
