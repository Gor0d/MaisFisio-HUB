# Implantação e operação

## 1. Criar o projeto Supabase

Crie um projeto na região adequada à política da instituição e copie URL, chave anônima e chave `service_role` para as variáveis descritas em `.env.example`. A chave `service_role` é exclusiva do servidor/Vercel e nunca deve usar o prefixo `NEXT_PUBLIC_`.

As migrações devem ser aplicadas na ordem presente em `supabase/migrations/`; depois, execute `supabase/seed.sql`. O seed é idempotente para os catálogos principais.

## 2. Primeiro administrador

Crie o primeiro usuário no painel Authentication do Supabase. O gatilho criará um perfil como colaborador por segurança. No SQL Editor, promova somente esse usuário à matriz (super_admin — enxerga e administra todas as unidades):

```sql
update public.profiles
set role = 'super_admin', active = true
where user_id = '<UUID DO USUÁRIO>';
```

Administradores de unidade (papel `admin`) precisam também do vínculo de unidade em `profile_units`; o convite pela tela Administração já cria esse vínculo automaticamente.

Depois disso, novos usuários devem ser convidados pela tela Administração. Papel e serviço são gravados pelo servidor com `service_role`; metadados enviados pelo cliente nunca concedem privilégios.

## 3. Importação histórica

Primeiro gere o diagnóstico sem escrever no banco:

```bash
npm run import:xlsx:dry
```

O comando cria `reports/import-report.json` e `reports/import-issues.csv`. O campo `physicalRows` registra o limite físico de cada aba. Essas contagens incluem linhas que contêm somente fórmulas copiadas, sem avaliação ou produção de origem. O relatório diferencia registros aceitos, corrigidos, em revisão e rejeitados; por isso a contagem válida pode ser menor que o limite físico da aba.

Decisão para nomes compostos como `EVELYN/ NATALIA` e `Izana/Shirlene`: preservar como um registro canônico de equipe e marcar para revisão. Separar automaticamente atribuiria a produção a pessoas sem evidência suficiente.

Para importar de fato, configure `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e, opcionalmente, `IMPORT_USER_ID`. Sem `IMPORT_USER_ID`, o script usa o primeiro perfil administrador. Execute:

```bash
npm run import:xlsx
```

O importador usa lotes, ignora abas ocultas duplicadas, recalcula as pontuações a partir das opções e nunca importa totais, flags de melhora ou o índice quebrado da Fono. Todo o histórico é vinculado à unidade **Hospital Galileu** (`galileu`); os colaboradores importados recebem o vínculo de unidade correspondente.

## 4. Vercel

Importe o repositório na Vercel, cadastre as quatro variáveis de `.env.example` (incluindo a chave de serviço apenas no servidor) e faça o deploy. Em Supabase Auth, inclua o domínio de produção nas URLs permitidas de redirecionamento.

### Domínio: hub.maisfisio.com.br

O DNS de `maisfisio.com.br` fica na Locaweb (ns1/ns2/ns3.locaweb.com.br), onde também está hospedado o site institucional. Para colocar o sistema em `hub.maisfisio.com.br` sem tocar no site atual:

1. Quem administra o painel Locaweb da MaisFisio cria um registro **CNAME** com nome `hub` apontando para `cname.vercel-dns.com`.
2. No projeto da Vercel: Settings → Domains → adicionar `hub.maisfisio.com.br` (SSL é emitido automaticamente).
3. Definir `NEXT_PUBLIC_APP_URL=https://hub.maisfisio.com.br` na Vercel e incluir essa URL nos redirects permitidos do Supabase Auth.

Atenção: o registro do domínio `maisfisio.com.br` expira em 04/09/2026 — lembrar o titular de renovar. Alternativa com domínio próprio: `maisfisiohub.com.br` está disponível no Registro.br (R$ 40/ano).

## 5. Verificação antes de liberar

- Fluxo desktop e celular: login → produção → Barthel entrada e saída → dashboard.
- Conferir manualmente três pacientes das escalas contra a planilha.
- Rodar os testes e o build.
- Validar com usuários de teste: anônimo sem leitura, colaborador sem `/admin`, coordenador limitado ao serviço e administrador com acesso completo.
- Revisar o relatório de importação com a MaisFisio antes da carga definitiva.
- Executar Lighthouse no domínio de produção e confirmar PWA ≥ 90 em viewport mobile.
