# Rodar o HUB localmente com Docker (outro PC, ambiente de testes)

Sobe um Supabase **local e isolado** (nunca o de produção) e o app em contêiner. Útil para avaliar, testar e continuar o desenvolvimento em qualquer máquina.

## Pré-requisitos
Docker Desktop ligado, Node 22+ e Git. Portas livres: 3010 (app), 54321–54324 (Supabase).

## Passo a passo

```bash
git clone https://github.com/Gor0d/MaisFisio-HUB && cd MaisFisio-HUB
git checkout feat/qualidade-interact-docker      # até virar main
npm ci

# 1) Supabase local (aplica as migrações e o seed sozinho)
npx supabase start -x edge-runtime,logflare,vector,imgproxy,supavisor
npx supabase status                               # mostra ANON_KEY e SERVICE_ROLE_KEY locais

# 2) Variáveis para o contêiner do app
cp .env.docker.example .env                       # preencha as duas chaves
# 3) Variáveis para os testes E2E (Playwright lê .env.local)
printf 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>\nSUPABASE_SERVICE_ROLE_KEY=<service_role>\nNEXT_PUBLIC_APP_URL=http://localhost:3010\n' > .env.local

# 4) App
docker compose up -d --build                      # http://localhost:3010
```

Chaves e URLs do Supabase local mudam se você recriar o stack; atualize o `.env` e rode `docker compose up -d --build` de novo (as `NEXT_PUBLIC_*` são embutidas no build).

## Usuários de teste (somente local)

```bash
SK=<service_role local>; PW='<escolha uma senha local>'
for u in matriz admin coord colab; do
  curl -s -X POST http://127.0.0.1:54321/auth/v1/admin/users -H "apikey: $SK" -H "Authorization: Bearer $SK" \
    -H "Content-Type: application/json" -d "{\"email\":\"$u@maisfisio.local\",\"password\":\"$PW\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$u teste\"}}" -o /dev/null -w "$u %{http_code}\n"
done
```

Depois promova os papéis (psql do contêiner `supabase_db_MaisFisio-HUB`, usuário `postgres`):

```sql
update public.profiles p set
  role = case u.email when 'matriz@maisfisio.local' then 'super_admin'::app_role when 'admin@maisfisio.local' then 'admin'::app_role
                      when 'coord@maisfisio.local' then 'coordenador'::app_role else 'colaborador'::app_role end,
  service_id = case when u.email in ('coord@maisfisio.local','colab@maisfisio.local') then (select id from public.services where code='fisioterapia') end
from auth.users u where u.id = p.user_id;
insert into public.profile_units(user_id, unit_id)
select u.id, (select id from public.units where code='galileu') from auth.users u
where u.email in ('admin@maisfisio.local','coord@maisfisio.local','colab@maisfisio.local') on conflict do nothing;
-- colaboradores do coordenador/colaborador (necessários para lançar produção)
insert into public.collaborators(canonical_name, service_id, user_id)
select p.full_name, p.service_id, p.user_id from public.profiles p where p.role in ('coordenador','colaborador') on conflict do nothing;
insert into public.collaborator_units(collaborator_id, unit_id)
select c.id, (select id from units where code='galileu') from collaborators c on conflict do nothing;
```

## Verificação

```bash
npm run lint && npm run typecheck && npm test
E2E_BASE_URL=http://localhost:3010 npm run test:e2e   # login → lançamento → Barthel → dashboard (desktop e celular)
```

Estado verificado em 09/11/2026: lint e typecheck limpos, 44 testes passando, E2E 2/2.

## Observações

- A migração `202611070018_quality_indicators.sql` está aplicada **só no ambiente local**; não foi aplicada em produção.
- O E2E cria e remove um usuário descartável via `service_role`; rode-o somente contra o Supabase local.
- Para parar: `docker compose down` e `npx supabase stop`.
