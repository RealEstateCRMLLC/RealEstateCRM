#!/usr/bin/env bash
set -euo pipefail

EXPECTED_MD5="${1:-}"
cd /var/www/excellegacyrealtygroup
echo "BEFORE_VERSION: $(cat VERSION.md 2>/dev/null || echo none)"

ACTUAL_MD5=$(md5sum /tmp/deploy-v3.tar.gz | awk '{print $1}')
echo "TARBALL_MD5: $ACTUAL_MD5"
if [ -n "$EXPECTED_MD5" ] && [ "$ACTUAL_MD5" != "$EXPECTED_MD5" ]; then
  echo "ERROR: MD5 mismatch (expected $EXPECTED_MD5, got $ACTUAL_MD5)! Aborting swap."
  exit 1
fi

BK="/tmp/ercm-backup-$(date +%s)"
mkdir -p "$BK"
echo "BACKUP_DIR: $BK"

for item in .next node_modules server.js middleware.ts package.json static public post-deploy.sh VERSION.md; do
  if [ -e "$item" ] || [ -L "$item" ]; then
    mv "$item" "$BK/"
  fi
done

nice -n 10 tar xzf /tmp/deploy-v3.tar.gz
ln -sfn client node_modules/@prisma/client-2c3a283f134fdcb6
pm2 restart excellegacyrealtygroup --update-env

sleep 7
echo "AFTER_VERSION: $(cat VERSION.md)"
echo "DEV_DB_BYTES: $(stat -c%s prisma/dev.db)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3210/api/auth/session)
echo "AUTH_SESSION_HTTP: $CODE"
pm2 logs excellegacyrealtygroup --lines 10 --nostream
