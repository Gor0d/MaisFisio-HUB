# Checklist comercial e de go-live seguro (09/11/2026)

> Publicado em repositório público por decisão do Emerson (09/11/2026). Contém preços, margens e lacunas de segurança.

Complementa `docs/todo-go-live.md` (técnico) com o que falta para **vender** o HUB a outros hospitais com VPS e domínio próprios. Convenção de marcação: `[x]` pronto e verificado, `[~] (Nome)` em andamento, `[ ]` pendente. Responsáveis: **Claude**, **Codex**, **Emerson**.

## 1. Produto — verificado em 09/11/2026 (ambiente local, não produção)

- [x] `npm run lint` e `npm run typecheck` limpos.
- [x] 44 testes passando (28 anteriores + 16 do módulo de qualidade), incluindo 24 em PostgreSQL real (PGlite).
- [x] E2E do fluxo principal (login → lançamento → Barthel entrada/saída → melhora no dashboard) em Desktop Chrome e Mobile Chrome contra o Supabase **local**: 2/2.
- [x] Módulo **Qualidade (Interact)**: migração `202611070018`, tela `/qualidade`, cálculo mensal, exportação CSV/Excel, acesso só admin/matriz.
- [x] Logos e ícones refeitos (o `icon.png` antigo era um recorte com a cruz cortada): `logo-symbol.png`, `icon.png`, `icon-192.png`, `icon-maskable.png`, `apple-icon.png`, `logo-maisfisio-white.png`. Cache do service worker em `v4`.
- [x] Docker: `Dockerfile`, `docker-compose.yml`, `.dockerignore` (app em contêiner) + Supabase local pela CLI.
- [ ] **Emerson** — aplicar a migração `202611070018` no Supabase de produção (só depois de revisar; não foi aplicada fora do ambiente local).
- [ ] **Emerson** — enviar as fichas técnicas dos 38 indicadores do Interact (fórmula, numerador, denominador, meta). As 5 fórmulas cadastradas no ambiente local são **provisórias**.
- [ ] **Emerson** — perguntar ao fornecedor/administrador do Interact se há **importação ou API**. Sem isso a entrega é conferência + exportação.
- [ ] **Claude** — mapear os 38 indicadores reais (quais já saem dos dados coletados, quais exigem novo campo de lançamento) quando as fichas chegarem.
- [ ] **Emerson** — mensagem do console do erro "client-side exception" visto em 07/11 (não reproduzido em Chromium, nem com locale pt-BR, fusos, celular ou cliques em todas as telas).

## 2. Segurança para a venda (o deck só promete o que está aqui)

Já no produto: convite sem cadastro público, RLS por unidade testada, auditoria com retenção de 12 meses, validação no banco, minimização de dados do paciente, páginas autenticadas fora do cache do service worker.

Falta entregar (escopo da implantação, vendido no slide 9):

- [ ] **MFA (TOTP)** obrigatório para `admin` e `super_admin` (suporte nativo do Supabase Auth; falta tela de cadastro do fator e política).
- [ ] **Cabeçalhos de segurança** no app/proxy: CSP, HSTS, X-Frame-Options/`frame-ancestors`, Referrer-Policy, Permissions-Policy (`next.config.ts` só desliga `X-Powered-By` hoje).
- [ ] **Proxy reverso com TLS** na VPS (Caddy ou Nginx), redirecionamento HTTP→HTTPS, firewall (só 80/443/SSH por chave), `fail2ban`, SSH sem senha.
- [ ] **Limite de tentativas de login** (rate limit do Supabase Auth + proxy) e bloqueio progressivo.
- [ ] **Backup com PITR** no Supabase e **teste de restauração documentado** (um backup nunca restaurado não conta).
- [ ] **Monitoramento**: `/api/health` no UptimeRobot (ou similar) e Sentry para erros; alertas por e-mail.
- [ ] **Ambiente de homologação separado** (o E2E agora roda local, mas falta um staging na nuvem para validar migrações antes de produção).
- [ ] **CI/CD** (GitHub Actions): lint + typecheck + testes + build + E2E contra Supabase local; deploy controlado na VPS.
- [ ] **Gestão de segredos**: `SUPABASE_SERVICE_ROLE_KEY` só no servidor, fora do repositório e rotacionável; `npm audit` periódico.
- [ ] **Teste de invasão externo** (opcional no pacote, cobrado à parte).
- [ ] **LGPD**: contrato de operador, RIPD, política de incidentes, definição de encarregado (DPO). Com o jurídico.

## 3. Comercial

- [x] Apresentação de 15 slides com logos corrigidas e assinatura **Gorod Studio** na capa, no fechamento e no rodapé (fonte em `docs/apresentacao/`).
- [x] Skill pessoal `gorod-studio-orcamento` (`~/.claude/skills/`): logos vetoriais da Gorod, paleta, tipografia, 6 modelos de slides e roteiro de proposta, para os próximos orçamentos.
- [ ] **Emerson** — preencher os marcadores `[Nome da instituição]`, `[Nome do responsável]`, `[telefone]`, `[e-mail]`, `[30 dias]` (slides 1 e 15) e `[com acréscimo a definir]` (slide 13).
- [ ] **Emerson** — autorização formal para citar o hospital do caso de origem (o deck diz só "caso de origem"; o nome aparece apenas nas notas do slide 2).
- [ ] **Emerson** — validar os preços (tabela abaixo) e a modalidade de contratação do cliente (dispensa/licitação, se público).
- [ ] **Codex** — minuta de contrato/SLA (disponibilidade, tempo de resposta, cláusula de saída com exportação dos dados, LGPD) para revisão jurídica.
- [ ] **Codex** — versões do material: proposta em PDF/DOCX, resumo executivo de 1 página e ficha técnica de segurança.
- [ ] **Claude/Codex** — ambiente de **demonstração** com dados fictícios (script de seed) para apresentar sem expor dado real.
- [ ] Medir no piloto: horas poupadas por mês no fechamento do portal e erros de digitação evitados. **Só publicar números medidos** (o deck não traz nenhum ganho inventado).

## 4. Preço e infraestrutura (decisões de 09/11/2026)

**Cliente da proposta: MaisFisio (preço único, sem escada de pacotes).**

| Item | Valor |
|---|---|
| Implantação | **R$ 30.000**, parcelável em 12x de R$ 2.500 |
| Manutenção mensal (recomendada) | **R$ 2.500/mês** (piso R$ 1.900 · teto R$ 3.200) |
| Parcela no 1º ano | R$ 2.500 + R$ 2.500 = **R$ 5.000/mês** · total do 1º ano R$ 60.000 |
| Depois do 1º ano | R$ 2.500/mês (R$ 30.000/ano), com reajuste anual por IPCA ou IGP-M |

A manutenção cobre VPS e domínio, backups, monitoramento, atualizações de segurança, suporte e ~4 h/mês de evolução. Custo recorrente estimado por cliente: R$ 1.000–1.400/mês (VPS BR 150–400 + Supabase Pro ~150 + PITR ~550 + monitoramento/e-mail 100–250 + domínio), logo sobram ~R$ 1.100–1.500/mês para suporte e evolução. Valores de Supabase/PITR são estimativa e precisam de cotação.

Cuidados: (1) R$ 30 mil é baixo para o escopo antigo do deck — manter só o essencial e deixar pentest externo à parte; (2) definir no contrato se é **licença de uso** (código continua da Gorod) ou cessão; (3) reajuste anual.

**Banco: Supabase gerenciado (São Paulo) agora; auto-hospedado é opção futura.** O app depende do stack Supabase (GoTrue/PostgREST/RLS com `auth.uid()`), não de Postgres puro. Auto-hospedar exige só 4 serviços (Postgres, GoTrue, PostgREST, Kong) ≈ 1 GB de RAM, mas traz backup/restauração, CVEs e plantão para a Gorod. Vira pacote premium "ambiente dedicado" para cliente que exigir dados só na própria VPS.

**VPS (preços lidos em páginas de terceiros; confirmar na contratação):**

| Provedor | Plano | Preço lido | Nota |
|---|---|---|---|
| Hostinger | KVM 2 · 2 vCPU/8 GB/100 GB NVMe, São Paulo | R$ 35–43/mês em promoção; renovação ~R$ 70–90 | Melhor custo-benefício; promoção exige contrato longo |
| Magalu Cloud | BV2-4-40 · 2 vCPU/4 GB/40 GB NVMe | ~R$ 103/mês (R$ 0,1411/h) | Brasileira, cobra em reais; página de preços com ~10 meses e tabela conflitante |
| HostGator Brasil | VPS / VPS Cloud | a partir de ~R$ 82/mês (comparativo) | Sem tabela oficial; linha cPanel — confirmar root e Docker |
| Locaweb | VPS 4 GB | não confirmado | Pedir cotação |
| Vultr | 2 vCPU/4 GB, São Paulo | US$ 24–36/mês | Cobra em dólar |

Escolha provisória: **produção na Magalu Cloud (BV2-4-40 ou BV2-4-100)** e **homologação na Hostinger KVM 2**. Se for uma só VPS e menor custo: Hostinger KVM 2. Perguntas a qualquer provedor: root e Docker liberados? datacenter em SP? snapshot automático? SLA por escrito e suporte? preço de renovação? nota fiscal em reais?

Dimensionamento: ~350 MB para 3 anos de um hospital (~120 MB/ano); VPS 2 vCPU/4 GB/80 GB NVMe basta com banco gerenciado; 4 vCPU/8 GB/160 GB se tudo na VPS. Build da imagem fora da VPS (CI).

**Pendente no deck:** os slides 12 (pacotes), 13 (pagamento) e 14 (horas por pacote) ainda mostram a escada Essencial/Profissional/Rede; precisam virar preço único (R$ 30.000 + R$ 2.500/mês). Os slides 12 a 14 são os de `investimento`, `pagamento` e `mensalidade` em `apresentacao-maisfisio/project/slides/`.

## 5. Ideias para avaliar (abertas)

- Self-service de onboarding de unidade e cobrança recorrente (Pix/boleto) quando passar de ~5 clientes.
- Benchmark anonimizado entre hospitais (exige base legal e anonimização rigorosa).
- White-label (logo e cores por cliente), já simples porque os ativos de marca são arquivos em `public/`.
- Integração direta com o Interact se houver API; caso contrário, rotina de conferência assistida.
- Alertas de meta (e-mail quando um indicador sai da meta no mês).
