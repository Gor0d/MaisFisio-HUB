#!/usr/bin/env bash
# Backup lógico diário (schemas public e auth) em deploy/backups/. Rode no host da VPS via cron:
#   0 2 * * * cd /opt/maisfisio && ./deploy/scripts/backup.sh >> /var/log/maisfisio-backup.log 2>&1
# Depois envie deploy/backups/ para storage externo (rclone/S3) e mantenha retenção (ex.: 30 dias).
set -euo pipefail
export MSYS_NO_PATHCONV=1  # evita reescrita de /backups no Git Bash (Windows)
cd "$(dirname "$0")/.."
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="/backups/maisfisio-$STAMP.dump"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"
$COMPOSE exec -T db pg_dump -U supabase_admin -d postgres -Fc --no-owner --no-privileges \
  -n public -n auth \
  --exclude-table-data=auth.schema_migrations --exclude-table-data=public._migrations -f "$OUT"
# verifica que o arquivo é legível e não está vazio
$COMPOSE exec -T db pg_restore -l "$OUT" > /dev/null
sha256sum "backups/maisfisio-$STAMP.dump" > "backups/maisfisio-$STAMP.dump.sha256" 2>/dev/null || true
find backups -name 'maisfisio-*.dump*' -mtime +30 -delete
echo "backup ok: backups/maisfisio-$STAMP.dump"
