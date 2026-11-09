---
name: maisfisio-hub-direcao
description: "Direção do MaisFisio HUB — Supabase mantido, app em VPS própria com domínio, multi-hospital, produto comercial e integração com Interact Suite (qualidade)"
metadata:
  node_type: memory
  type: project
  originSessionId: ab7660f6-8360-479b-9eb8-8acf55c0f15e
  modified: 2026-11-07T14:30:07.386Z
---

MaisFisio HUB (repo Gor0d/MaisFisio-HUB, clonado em Projetos/MaisFisio/MaisFisio-HUB). Decisões do Emerson em 07/11/2026:
- MVP mantém o banco no Supabase; o app Next.js vai rodar em VPS própria + domínio.
- Será multi-hospital (não só Galileu) e deve virar produto/case comercial ("sistema parrudo").
- Precisa integrar cálculos dos indicadores de qualidade do **Interact Suite 26** (usado no HPEG/Galileu, modelo "Mapa Estratégico - HPEG", indicadores mensais, nomes tipo "PSI - Taxa de Elegibilidade...", "FON - Índice de broncoaspiração - UTI", "SS - Número de atendimentos..."). Ainda não se sabe se o Interact tem API/importação — perguntar à qualidade do hospital/fornecedor.

Ambiente local de avaliação: Supabase local (`npx supabase start -x edge-runtime,logflare,vector,imgproxy,supavisor`) + `docker compose up -d` na porta 3010; contas *@maisfisio.local (senha local definida no ambiente; não registrada).

**Why:** orienta orçamento, arquitetura e priorização futura.
**How to apply:** ao propor infra/features, assumir multi-tenant, hospedagem no Brasil (LGPD) e que dados de produção real nunca vão para testes.
