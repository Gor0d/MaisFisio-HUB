#!/usr/bin/env bash
# Restaura um backup em um stack JÁ criado e migrado (db, auth e migrate rodaram ao menos uma vez),
# com o MESMO conjunto de migrações do backup. Uso:
#   ./deploy/scripts/restore.sh backups/maisfisio-AAAAMMDDTHHMMSSZ.dump
# ATENÇÃO: apaga e substitui todos os dados de public e auth. Roda numa transação: se falhar, nada muda.
set -euo pipefail
export MSYS_NO_PATHCONV=1  # evita reescrita de /backups no Git Bash (Windows)
cd "$(dirname "$0")/.."
FILE=$(basename "${1:?informe o arquivo de backup}")
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"
$COMPOSE exec -T db pg_restore -l "/backups/$FILE" > /dev/null   # falha cedo se o arquivo estiver ruim
$COMPOSE stop web auth rest
# esvazia public e auth (menos o controle de migrações) e restaura tudo numa transação só
$COMPOSE exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare t text;
begin
  for t in select format('%I.%I', schemaname, tablename) from pg_tables
           where (schemaname = 'public' and tablename <> '_migrations')
              or (schemaname = 'auth' and tablename <> 'schema_migrations')
  loop execute 'truncate table ' || t || ' cascade'; end loop;
end $$;
SQL
$COMPOSE exec -T db pg_restore -U supabase_admin -d postgres --data-only --disable-triggers   --no-owner --no-privileges -n public -n auth --single-transaction --exit-on-error "/backups/$FILE"
$COMPOSE start auth rest web
echo "restore ok: $FILE"
