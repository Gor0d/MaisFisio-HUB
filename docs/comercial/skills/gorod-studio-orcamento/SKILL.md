---
name: gorod-studio-orcamento
description: Marca, logo e modelos de slides da Gorod Studio (identidade "Slash": lima sobre pretos esverdeados, Inter) para criar orçamentos, propostas comerciais e apresentações com a cor e a logo da Gorod, personalizadas para cada cliente (logo e nome do cliente). Use sempre que o usuário pedir orçamento, proposta ou apresentação comercial "da Gorod", "com a nossa marca/cor/logo", ou qualquer material temático Gorod Studio.
---

# Gorod Studio — marca e propostas

Gorod Studio: "Sistemas, dados e IA para a operação funcionar." Tecnologia / Design / Dados / IA. Não pergunte onde estão a logo e as cores: estão mapeadas aqui.

Pasta da skill: `C:\Users\emersonguimaraes\.claude\skills\gorod-studio-orcamento\`

## Arquivos

| Arquivo | Uso |
|---|---|
| `assets/gorod-logo-fundo-escuro.svg/.png` | **Principal.** Símbolo lima+verde e "Gorod **Studio**" em marfim. Sobre fundo escuro (`#0B0F0B`, `#131B15`). |
| `assets/gorod-logo-fundo-claro.svg/.png` | Versão monocromática escura. Sobre marfim, branco ou lima. |
| `assets/gorod-logo-marfim.svg/.png` | Tudo marfim. Sobre fotos ou fundos coloridos escuros. |
| `assets/gorod-simbolo.svg/.png` | Só o símbolo (duas barras), colorido, para fundo escuro. |
| `assets/gorod-simbolo-mono-escuro.svg/.png`, `...-mono-marfim.svg/.png` | Símbolo monocromático. |
| `assets/gorod-avatar-512.png` | Ícone/avatar quadrado (símbolo sobre `#0B0F0B`). |
| `assets/tokens.css` | Variáveis CSS da marca. |
| `templates/01..06-*.html` | Modelos de slides (formato do tipo Slides do Artifact) com marcadores `{{...}}`. |
| `references/brand.md` | Manual resumido: cores, tipografia, regras de uso, geometria do logo. |
| `references/proposta-estrutura.md` | Roteiro de uma proposta, regras de honestidade comercial e como personalizar para o cliente. |

Os logos foram redesenhados em vetor a partir do manual (v1.0, 2026), com o texto convertido em curvas (Inter 400 e 700), portanto não dependem de fonte instalada. Se existir o SVG oficial do manual, substitua os arquivos mantendo os nomes.

## Marca em 10 linhas

- Paleta: Lima `#B8FF67` (principal/CTA), Verde `#79A84A` (contraponto), Base `#0B0F0B` (fundo), Superfície `#131B15` (cards), Marfim `#F5F7F2` (texto). Texto secundário sobre escuro: `#AEB8AE`. Filetes: `#26302A`.
- Regra 80/15/5: 80% base escura, 15% superfícies, 5% acentos em lima. Lima é para ação e destaque, nunca para blocos grandes de texto.
- Tipografia: **Inter**. Títulos 700, texto 400. Tom: clareza, precisão, objetividade; falar de problemas reais e resultados, sem jargão vazio.
- Use fundo escuro e contraste forte; mantenha o respiro entre símbolo e nome.
- Evite trocar o verde por degradês, e esticar, girar ou sombrear o logo.
- Estrutura visual dos slides do manual: cabeçalho fino "GOROD / ..." com versão à direita, rodapé "SEÇÃO / GOROD STUDIO" com paginação "01 / 07", filetes `#26302A`, rótulos em caixa-alta com `/` como separador, números "01 / 02" em lima.

## Como montar um orçamento ou proposta

1. **Ler** `references/proposta-estrutura.md` (roteiro, regras de honestidade, personalização do cliente).
2. **Coletar do cliente** (pergunte só o que faltar): nome, logo (PNG/SVG, de preferência transparente), escopo, prazos, pacotes e valores, condições de pagamento, contato e validade. Sem dado: use marcador `[...]`, nunca invente.
3. **Criar o deck** com o tipo Slides: chame `Artifact` com `action: "quickstart"`, `intent: "slides"`, depois publique com `type_url` e `auto_open: "after_first_write"`. Siga as instruções que o resultado trouxer (índice `project/deck.json`, um `project/slides/<id>.html` por slide, três slides por rodada). Declare a fonte em `faces`: `"inter": {"family":"Inter","href":"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"}`.
4. **Subir os logos como ativos** do deck (`asset: true`): `gorod-logo-fundo-escuro.png` e a logo do cliente. Se a ferramenta recusar o caminho da pasta da skill, copie os PNGs para a pasta de trabalho do projeto e suba de lá. Use o `url` devolvido (`/_blob/<id>`) nos marcadores `{{LOGO_GOROD_FUNDO_ESCURO_URL}}` e `{{LOGO_CLIENTE_URL}}`.
5. **Preencher os modelos** em `templates/` (copie para a pasta do deck, troque os `{{...}}`, ajuste o `id` e a numeração `{{N}} / {{TOTAL}}`). Acrescente slides do roteiro que o caso exigir (problema, solução, segurança, números, etc.), reaproveitando os mesmos blocos de estilo.
6. **Entregar**: link do deck, a lista de marcadores que ficaram para o usuário preencher, e a linha "Written for: <público>" no início da mensagem. Avise que o link é privado até ser compartilhado pelo menu Share.

## Personalização do cliente

A marca Gorod conduz o deck; o cliente aparece de forma clara e discreta:

- **Capa e fechamento:** logo e nome do cliente ao lado de "Preparado para", e a assinatura Gorod no fechamento.
- **Cabeçalho de cada slide:** `GOROD STUDIO / PROPOSTA · NOME DO CLIENTE`.
- **Cor do cliente (opcional):** no máximo 5% da área, só em rótulos, filetes ou um cartão de destaque, mantendo o lima como cor de ação. Nunca recolorir o logo da Gorod nem o do cliente.
- **Modo co-branded claro** (quando o cliente pedir ou a marca dele for forte): fundo marfim `#F5F7F2`, cor do cliente nos títulos e cartões, logo do cliente no rodapé à esquerda e a logo Gorod `fundo-claro` à direita. Exemplo pronto: a proposta MaisFisio HUB em `C:\Users\emersonguimaraes\Projetos\MaisFisio\MaisFisio-HUB\docs\apresentacao\`.

## Regras de honestidade comercial

- Não inventar números, depoimentos, certificações nem ganhos de produtividade. Fatos só com fonte; o resto fica como `[A MEDIR NO PILOTO]`.
- Separar claramente o que **já existe** do que **será entregue** na implantação.
- Citar nome de cliente anterior só com autorização.
- Preços são proposta: marcar para validação antes do envio, conferir a conta de parcelamento e informar impostos/validade.
