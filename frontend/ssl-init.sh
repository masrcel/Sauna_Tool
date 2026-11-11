#!/bin/sh
# Läuft über /docker-entrypoint.d/ vor dem Start von nginx.
# - Ist schon ein Let's-Encrypt-Zertifikat da, wird es verlinkt.
# - Sonst wird ein temporäres selbstsigniertes Zertifikat erzeugt, damit nginx
#   starten und certbot die HTTP-Challenge beantworten kann.
# - Ein Hintergrund-Loop übernimmt das echte Zertifikat, sobald es da ist,
#   und lädt nginx alle 12h neu (damit erneuerte Zertifikate greifen).
set -e

DOMAIN="${DOMAIN:-localhost}"
LIVE="/etc/letsencrypt/live/$DOMAIN"
SSL="/etc/nginx/ssl"
mkdir -p "$SSL" /var/www/certbot

link_live() {
  ln -sf "$LIVE/fullchain.pem" "$SSL/fullchain.pem"
  ln -sf "$LIVE/privkey.pem"   "$SSL/privkey.pem"
}

if [ -f "$LIVE/fullchain.pem" ]; then
  echo "ssl-init: nutze Let's-Encrypt-Zertifikat für $DOMAIN"
  link_live
else
  echo "ssl-init: noch kein Zertifikat für $DOMAIN – erzeuge temporäres selbstsigniertes"
  openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
    -keyout "$SSL/privkey.pem" -out "$SSL/fullchain.pem" \
    -subj "/CN=$DOMAIN" >/dev/null 2>&1
fi

(
  i=0
  while :; do
    sleep 60
    i=$((i + 1))
    if [ -f "$LIVE/fullchain.pem" ] && [ ! -L "$SSL/fullchain.pem" ]; then
      echo "ssl-init: Let's-Encrypt-Zertifikat gefunden – lade nginx neu"
      link_live
      nginx -s reload
    elif [ "$i" -ge 720 ]; then
      i=0
      nginx -s reload
    fi
  done
) &
