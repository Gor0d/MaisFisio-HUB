# Prompts para o Codex (09/11/2026)

Dois prompts independentes. Cole cada um em uma sessão do Codex aberta na raiz do repositório. Ambos seguem a convenção de `docs/todo-go-live.md` (marcar `[~] (Codex)` antes de começar, `git pull` primeiro, nunca force push, commits pequenos e só com os arquivos do item) e de `docs/handoff-agentes.md` (registrar resultado ao final).

---

## Prompt A — Material comercial

```
Você é o responsável comercial-técnico do MaisFisio HUB (sistema multi-hospital de indicadores assistenciais, Next.js + Supabase). Leia primeiro: AGENTS.md, docs/checklist-comercial.md, docs/todo-go-live.md, docs/plano-arquitetura.md e a apresentação em docs/apresentacao/ (arquivos project/deck.json e project/slides/*.html: 15 slides de proposta comercial).

OBJETIVO: transformar o produto em uma proposta comercial vendável a outros hospitais, com valor de implantação alto parcelado junto à manutenção mensal (que custeia VPS dedicada no Brasil, domínio, backups, monitoramento e suporte), com foco em alta segurança.

ENTREGAS (nesta ordem, cada uma em um commit pequeno, arquivos em docs/comercial/):
1. proposta-comercial.md — proposta narrativa completa (escopo, cronograma de 6 semanas, pacotes Essencial/Profissional/Rede, condições de pagamento, o que a manutenção cobre, responsabilidades do cliente, premissas e exclusões).
2. resumo-executivo.md — uma página para diretoria (problema, solução, segurança, investimento, próximo passo).
3. ficha-seguranca.md — ficha técnica de segurança que separe EXATAMENTE "já no produto" de "entregue na implantação" (use a seção 2 do docs/checklist-comercial.md como fonte da verdade).
4. minuta-contrato-sla.md — minuta para revisão jurídica: SLA (disponibilidade, tempo de resposta por severidade), manutenção, LGPD (operador/controlador), propriedade dos dados, cláusula de saída com exportação em formato aberto, reajuste anual, limites de responsabilidade. Marque claramente o que precisa de advogado.
5. faq-objecoes.md — 12 objeções prováveis de diretores/gestores de qualidade (preço, segurança, LGPD, "já temos planilha", dependência do fornecedor, integração com o Interact) com resposta objetiva.

REGRAS INVIOLÁVEIS:
- NÃO invente números, estatísticas, depoimentos, certificações (ISO, SOC etc.) nem ganhos de produtividade. Onde faltar dado medido, use marcador [A MEDIR NO PILOTO]. Fatos permitidos: 5 serviços, 101 indicadores, 3 escalas, ~70 mil registros históricos analisados, ~120 MB/ano por hospital (simulação), 44 testes automatizados, isolamento por unidade (RLS) validado em PostgreSQL real.
- NÃO prometa recurso de segurança que não esteja no produto: MFA, PITR, pentest, TLS/HSTS, monitoramento 24x7 são ESCOPO DA IMPLANTAÇÃO (ainda não entregues). Diga isso com clareza.
- A integração com o Interact hoje é conferência + exportação CSV/Excel; envio automático depende de API/importação do fornecedor (desconhecido). Não afirme integração direta.
- Não cite o nome do hospital do caso de origem sem autorização (use "caso de origem").
- Preços do checklist são sugestão a validar; mantenha-os como tabela editável e destaque as premissas.
- Não toque em código da aplicação, migrações, .env* nem em docs/apresentacao/ (a apresentação é mantida à parte).
- Português do Brasil, tom profissional e direto, sem jargão desnecessário.

AO FINAL: acrescente uma entrada em docs/handoff-agentes.md (o que entregou, o que ficou como [PREENCHER] para o Emerson, riscos jurídicos que viu) e, no checklist, marque os itens de "Comercial" que concluiu com o hash do commit.
```

---

## Prompt B — Checagem independente e ideias novas

```
Você é revisor independente do MaisFisio HUB. Seu trabalho é tentar QUEBRAR o que foi feito e propor melhorias, sem confiar nas afirmações de documentos anteriores. Leia: AGENTS.md, docs/checklist-comercial.md, docs/todo-go-live.md, docs/handoff-agentes.md.

AMBIENTE LOCAL (NUNCA use o Supabase de produção nem o service_role de produção):
- Banco: `npx supabase start -x edge-runtime,logflare,vector,imgproxy,supavisor` (Docker; aplica as migrações e o seed). URL http://127.0.0.1:54321.
- App: `docker compose up -d --build` (http://localhost:3010). Crie um .env.local apontando para o Supabase local (já está no .gitignore).
- Usuários de teste locais: criar via API admin do Supabase local e promover em public.profiles (matriz, admin da unidade Galileu, coordenador, colaborador).
- Testes: `npm run lint && npm run typecheck && npm test`; E2E: `E2E_BASE_URL=http://localhost:3010 npm run test:e2e`.

ESCOPO DA REVISÃO (priorize nesta ordem):
1. Módulo Qualidade/Interact: supabase/migrations/202611070018_quality_indicators.sql, lib/quality.ts, components/quality-view.tsx, app/(protected)/qualidade/page.tsx, tests/quality*.test.ts. Verifique: correção do cálculo (soma/soma, nunca média de razões), tratamento de nulo vs zero, filtro de setores, vazamento entre unidades, o que um admin consegue fazer via API direta (PostgREST) que a tela não permite, injeção/escape no CSV, arredondamento, fuso de datas nos limites do mês, concorrência (dois admins editando), e o que acontece se um indicador do catálogo for desativado depois de usado numa fórmula.
2. RLS e papéis: tente escalonar privilégio e ler dados de outra unidade com cada papel, chamando as funções e tabelas diretamente. Amplie tests/rls.integration.test.ts com cada falha que encontrar (teste que falha primeiro, depois correção).
3. Segurança da aplicação: cabeçalhos HTTP, cookies, redirecionamentos (open redirect em /auth/callback e ?redirect=), rotas /api/admin/*, uso do service_role, rate limit, mensagens de erro que vazam detalhes internos, dependências (npm audit).
4. Prontidão para multi-hospital e VPS: o que quebra ao subir um segundo hospital? Variáveis de ambiente, NEXT_PUBLIC_* embutidas no build (uma imagem por cliente?), domínio por cliente, e-mails de convite, backup/restore.
5. Afirmações comerciais: compare cada afirmação de segurança em docs/apresentacao/project/slides/seguranca.html e camadas.html com o código real. Liste qualquer exagero.

REGRAS:
- Reproduza cada achado antes de relatar (comando, payload ou teste). Classifique P0/P1/P2/P3 com impacto concreto. Não relate suspeitas sem evidência.
- Corrija apenas o que for pequeno e claramente certo, em commit separado com teste. O resto vira item no docs/todo-go-live.md (marcador [ ]) com a evidência.
- Não altere migrações já aplicadas em produção (crie migração nova), não use --no-verify, não faça force push.
- Remova do ambiente local qualquer usuário/dado de teste que criar.

ENTREGA: seção nova em docs/handoff-agentes.md (data, achados com severidade e evidência, o que corrigiu, o que não conseguiu quebrar) e uma lista de IDEIAS NOVAS (produto, segurança, comercial) com esforço estimado (P/M/G) e valor esperado. Seja específico; ideias genéricas não ajudam.
```
