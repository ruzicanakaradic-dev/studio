#!/usr/bin/env bash
# Instagram Business Login — ručno vađenje dugotrajnog tokena.
# Ništa se ne šalje nikuda osim ka Instagram/Meta API-ju. Secret i token
# ostaju u tvom terminalu (ne prikazuju se u chatu).
set -euo pipefail

CLIENT_ID_DEFAULT="4989929081234133"
REDIRECT_DEFAULT="https://studio-green-rho-18.vercel.app/ig-token-capture"

echo "=== Instagram token helper ==="
read -r -p "Instagram App ID [${CLIENT_ID_DEFAULT}]: " CLIENT_ID
CLIENT_ID="${CLIENT_ID:-$CLIENT_ID_DEFAULT}"

read -r -s -p "Instagram App Secret (neće se videti dok kucaš): " CLIENT_SECRET
echo
read -r -p "Redirect URI [${REDIRECT_DEFAULT}]: " REDIRECT_URI
REDIRECT_URI="${REDIRECT_URI:-$REDIRECT_DEFAULT}"

read -r -p "Code (iz adresne trake, bez '#_' na kraju): " CODE

echo
echo "--> 1/3 Razmena koda za kratkotrajni token..."
SHORT_JSON=$(curl -sS -X POST "https://api.instagram.com/oauth/access_token" \
  -F "client_id=${CLIENT_ID}" \
  -F "client_secret=${CLIENT_SECRET}" \
  -F "grant_type=authorization_code" \
  -F "redirect_uri=${REDIRECT_URI}" \
  -F "code=${CODE}")

SHORT_TOKEN=$(python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("access_token") or (d.get("data") or [{}])[0].get("access_token",""))' <<<"$SHORT_JSON")
USER_ID=$(python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("user_id") or (d.get("data") or [{}])[0].get("user_id",""))' <<<"$SHORT_JSON")

if [ -z "$SHORT_TOKEN" ]; then
  echo "GREŠKA pri razmeni koda. Odgovor Instagram-a:"; echo "$SHORT_JSON"; exit 1
fi
echo "    OK (user_id=${USER_ID})"

echo "--> 2/3 Kratkotrajni -> dugotrajni token (~60 dana)..."
LONG_JSON=$(curl -sS "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${CLIENT_SECRET}&access_token=${SHORT_TOKEN}")
LONG_TOKEN=$(python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))' <<<"$LONG_JSON")
EXPIRES=$(python3 -c 'import sys,json;print(json.load(sys.stdin).get("expires_in",""))' <<<"$LONG_JSON")

if [ -z "$LONG_TOKEN" ]; then
  echo "GREŠKA pri dugotrajnom tokenu. Odgovor:"; echo "$LONG_JSON"; exit 1
fi
echo "    OK (istice za ~$(( ${EXPIRES:-0} / 86400 )) dana)"

echo "--> 3/3 Provera naloga (/me)..."
ME_JSON=$(curl -sS "https://graph.instagram.com/me?fields=id,username&access_token=${LONG_TOKEN}")
IG_ID=$(python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' <<<"$ME_JSON")
IG_USER=$(python3 -c 'import sys,json;print(json.load(sys.stdin).get("username",""))' <<<"$ME_JSON")
echo "    Nalog: @${IG_USER} (id=${IG_ID})"

echo
echo "=================== UNESI OVO U VERCEL ==================="
echo "IG_USER_ID      = ${IG_ID:-$USER_ID}"
echo "IG_ACCESS_TOKEN = ${LONG_TOKEN}"
echo "========================================================="
echo "Napomena: token istice za ~60 dana. Cuvaj ga; ne deli u chatu."
