-- Impressão digital dos dados: contagem por tabela de public + hash das contas de auth.
select 'public.'||relname||' '||n_live_tup from (select relname, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', relname), false, true, '')))[1]::text::bigint as n_live_tup from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and relname<>'_migrations') t order by 1;
select 'auth.users '||count(*)||' '||md5(string_agg(id::text||email||coalesce(encrypted_password,''), ',' order by id)) from auth.users;
