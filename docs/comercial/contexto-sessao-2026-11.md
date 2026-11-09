# Contexto da sessão — 07 a 09/11/2026 (MaisFisio HUB × Gorod Studio)

Resumo do que foi conversado, decidido e feito, para retomar em outro computador. **Contém preços e margens; publicado neste repositório público por decisão do Emerson.**

## 1. Ponto de partida
- Repositório: `https://github.com/Gor0d/MaisFisio-HUB` (público). Next.js 15 + Supabase (RLS por unidade), PWA, indicadores assistenciais multi-unidade (hospital estadual Galileu e outras). Sem Dockerfile nem credenciais no clone.
- Decisão de execução: Supabase **local** em Docker (CLI) + app em contêiner (porta 3010); nunca tocar a produção.

## 2. O que foi feito
1. **Ambiente local:** Supabase local (17 migrações + seed), `Dockerfile` e `docker-compose.yml`, contas de teste (matriz, admin, coordenador, colaborador) criadas só no banco local.
2. **Avaliação do sistema:** lint, typecheck e testes passando; telas por papel; E2E (login → lançamento → Barthel → dashboard) em desktop e celular contra o Supabase local.
3. **Erro "client-side exception"** relatado em 07/11: não reproduzido (Chromium, locale pt-BR, fusos, celular, cliques em todas as telas, Supabase inacessível). **Falta a mensagem do console do navegador** do usuário.
4. **Interact Suite** (portal de qualidade do HPEG, indicadores mensais, vistos em foto): construído o módulo **Qualidade (Interact)**: cadastro de fórmulas, cálculo mensal automático, exportação CSV/Excel, acesso só admin/matriz. 44 testes no total (16 novos). Detalhes em `docs/interact-qualidade.md` do repositório. Fórmulas dos 5 indicadores de teste são **provisórias**.
5. **Armazenamento:** simulação com o volume documentado (~70 mil linhas de planilha): ≈ **350 MB** para 3 anos de um hospital (≈ 120 MB/ano). Tabelas maiores: `production_values` 111 MB, `scale_scores` 108 MB, `audit_logs` 60 MB.
6. **Logos/ícones MaisFisio refeitos:** o `icon.png` era um recorte com a cruz cortada; símbolo extraído da logo completa; novos ícones, versão branca e maskable; cache do service worker em `v4`.
7. **Apresentação comercial** (15 slides, tipo Slides do Artifact claude.ai) para a MaisFisio, com logo/assinatura **Gorod Studio** (capa, fechamento e rodapé). Fonte em `apresentacao-maisfisio/`. O link do deck é privado da conta claude.ai: `https://claude.ai/artifact/L1f77ziSMTwNTEu4dUiYQd` (pode não abrir em outra conta; recrie a partir do fonte e da skill).
8. **Skill `gorod-studio-orcamento`** (logos vetoriais da Gorod redesenhados a partir do manual, paleta, Inter, 6 modelos de slides, roteiro de proposta, regras de honestidade). Cópia em `skills/gorod-studio-orcamento/`; instalar em `~/.claude/skills/`.
9. **Prompts para o Codex** (material comercial e revisão independente): `prompts-codex.md`.

## 3. Decisões e números
- **Preço para a MaisFisio (cliente único):** implantação **R$ 30.000** (12x de R$ 2.500) + manutenção recomendada **R$ 2.500/mês** → **R$ 5.000/mês no 1º ano**, total do ano R$ 60.000; depois R$ 2.500/mês. Piso R$ 1.900, teto R$ 3.200. Reajuste anual (IPCA/IGP-M). Definir no contrato licença de uso × cessão do código.
- **Custo recorrente estimado por cliente:** R$ 1.000–1.400/mês (VPS BR, Supabase Pro, PITR, monitoramento, e-mail, domínio). Estimativas a cotar.
- **Banco:** manter Supabase gerenciado em São Paulo por ora; auto-hospedar (4 serviços, ≈ 1 GB de RAM) só como pacote premium ou com pessoa dedicada à operação. O app depende do stack Supabase, não de Postgres puro.
- **VPS:** produção na **Magalu Cloud** (BV2-4-40, ~R$ 103/mês lido) e homologação na **Hostinger KVM 2** (R$ 35–43 em promoção). HostGator só se confirmar root e Docker. Detalhes e perguntas em `checklist-comercial.md` §4.
- **Segurança na venda:** o deck separa "já no produto" de "entregue na implantação" (MFA, PITR, TLS/HSTS, monitoramento, pentest ainda **não** existem). Não prometer o que não está no produto.

## 4. Em aberto
- Aplicar a migração `202611070018` em produção (só após revisão).
- Fichas técnicas dos 38 indicadores do Interact e resposta se há API/importação.
- Mensagem do console do erro "client-side exception".
- Atualizar o deck para **preço único** (slides `investimento`, `pagamento`, `mensalidade`) e preencher marcadores `[...]`.
- Itens de segurança, CI/CD, homologação e LGPD do checklist §2.
- Autorização para citar o hospital do caso de origem.

## 5. Como retomar em outro PC
1. **Código:** `git clone https://github.com/Gor0d/MaisFisio-HUB` e `git checkout feat/qualidade-interact-docker`. Siga `docs/execucao-local-docker.md` (Supabase local, `.env`, usuários de teste, testes).
2. **Material comercial:** está em `docs/comercial/` do mesmo clone (esta pasta).
3. **Skill:** copie `skills/gorod-studio-orcamento/` para `~/.claude/skills/`.
4. **Memória do Claude:** `memory/` é cópia de `~/.claude/projects/<pasta do projeto>/memory/`; o nome da pasta muda por máquina, então apenas leia o conteúdo ou recrie-o.
5. **Codex:** os prompts de `prompts-codex.md` citam arquivos `docs/...`; os arquivos já estão em `docs/comercial/` (ajuste os caminhos citados nos prompts para `docs/comercial/...`).

## 6. Fontes de preço de VPS (conferir na contratação)
- Hostinger KVM 2: https://www.vpsbenchmarks.com/hosters/hostinger/plans/kvm-2 · https://horadecodar.com.br/valor-vps/
- Magalu Cloud: https://magalu.cloud/precos/virtual-machines/ · https://docs.magalu.cloud/docs/computing/virtual-machine/instance-types-and-pricing/pricing
- Vultr (São Paulo): https://pcr.cloud-mercato.com/providers/vultr/flavors/vc2-2c-4gb/pricing
- HostGator Brasil: https://hostgator.com.br/blog/vps-cloud-hostgator-brasil/
- Locaweb: https://www.locaweb.com.br/vps/
