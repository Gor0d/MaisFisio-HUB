#!/usr/bin/env bash
# Aplica as migrações de supabase/migrations em ordem, uma vez cada (tabela public._migrations).
set -euo pipefail
until pg_isready -q; do sleep 2; done
# espera o GoTrue criar o schema auth (as migrações usam auth.uid()/auth.users)
for i in $(seq 1 60); do
  psql -Atc "select 1 from information_schema.tables where table_schema='auth' and table_name='users'" | grep -q 1 && break
  sleep 2
done
psql -v ON_ERROR_STOP=1 -c "create table if not exists public._migrations(name text primary key, applied_at timestamptz default now())"
for f in $(ls /migrations/*.sql | sort); do
  n=$(basename "$f")
  if [ "$(psql -Atc "select 1 from public._migrations where name='$n'")" = "1" ]; then continue; fi
  echo "aplicando $n"
  psql -v ON_ERROR_STOP=1 --single-transaction -f "$f" -c "insert into public._migrations(name) values ('$n')"
done
echo "migrações ok"
