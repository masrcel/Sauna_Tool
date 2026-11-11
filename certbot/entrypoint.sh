#!/bin/sh
# Holt das Let's-Encrypt-Zertifikat (Webroot) und erneuert es alle 12h.

DOMAIN="${DOMAIN:-localhost}"
WEBROOT=/var/www/certbot

trap exit TERM

case "$DOMAIN" in
  localhost|127.*|"")
    echo "certbot: DOMAIN=$DOMAIN – kein Let's Encrypt möglich, nutze selbstsigniertes Zertifikat."
    while :; do sleep 1d & wait $!; done
    ;;
esac

if [ -z "$LETSENCRYPT_EMAIL" ]; then
  echo "certbot: LETSENCRYPT_EMAIL fehlt in .env – breche ab."
  while :; do sleep 1d & wait $!; done
fi

STAGING=""
[ "$LETSENCRYPT_STAGING" = "1" ] && STAGING="--staging"

# Erstes Zertifikat holen (nginx muss dafür auf Port 80 laufen)
while [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; do
  sleep 10
  echo "certbot: fordere Zertifikat für $DOMAIN an ..."
  if certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" \
       --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email \
       --non-interactive $STAGING; then
    break
  fi
  echo "certbot: fehlgeschlagen – neuer Versuch in 1h (DNS / Port 80 prüfen)"
  sleep 1h & wait $!
done

# Erneuerung
while :; do
  certbot renew --webroot -w "$WEBROOT" --quiet
  sleep 12h & wait $!
done
