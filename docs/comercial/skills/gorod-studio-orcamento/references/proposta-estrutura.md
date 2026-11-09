# Estrutura de uma proposta Gorod Studio

Público padrão: diretoria e gestores do cliente (decidem preço, risco e prazo). Linguagem direta, sem jargão. Um assunto por slide.

## Roteiro (12 a 15 slides)

1. **Capa** — título da proposta, subtítulo, "Preparado para" + logo/nome do cliente (`templates/01-capa.html`).
2. **O desafio** — 3 problemas reais do cliente, em cartões. Só afirmações que o cliente reconheça; números só com fonte.
3. **A solução** — o que a Gorod entrega, em 3 a 4 frentes.
4. **Como funciona** — fluxo em 3 a 4 etapas numeradas.
5. **Escopo** — quatro entregas (`02-escopo.html`).
6. **Diferenciais / prova** — números verificáveis do produto ou de casos anteriores (com autorização). Sem número medido, omita o slide.
7. **Segurança e conformidade** (quando houver dados sensíveis) — separe "já existe" de "será entregue".
8. **Infraestrutura** — onde roda, quem opera, custo recorrente incluso.
9. **Cronograma** — 4 fases com prazos-alvo e premissas (`03-cronograma.html`).
10. **Investimento** — pacotes, um recomendado (`04-investimento.html`).
11. **Condições de pagamento** — implantação parcelada + manutenção mensal (`05-pagamento.html`).
12. **O que a manutenção cobre** — lista objetiva (hospedagem, domínio, backups, monitoramento, atualizações, suporte, horas de evolução).
13. **Próximos passos** — 3 passos, contato e validade (`06-proximos.html`).

## Modelo de precificação usado nas propostas Gorod

- **Implantação** (única, parcelável em até 12x sem juros): escopo fechado, ambiente, migração de dados, treinamento, período de garantia.
- **Manutenção mensal**: infraestrutura (VPS, domínio, TLS), backups, monitoramento, atualizações de segurança, suporte com SLA e horas de evolução por mês. Deixe claro que VPS e domínio estão incluídos.
- Pacotes em escada (ex.: Essencial / Profissional / Rede), com um recomendado.
- Parcela mensal do primeiro ano = implantação ÷ parcelas + manutenção. Depois, só a manutenção. Mostre a conta e o total do primeiro ano.
- Conferir custo real: infraestrutura por cliente + suporte + horas de evolução, para garantir margem. Valores são proposta: o usuário valida antes do envio.

## Regras de honestidade

- Nunca inventar estatística, depoimento, certificação (ISO, SOC etc.) ou ganho. Sem dado: `[A MEDIR NO PILOTO]`.
- Segurança: "já no produto" só o que existe no código e pode ser demonstrado; MFA, backup com restauração, monitoramento, pentest e similares são "entregues na implantação" se ainda não existem.
- Integrações: dizer exatamente o que é feito (conferência/exportação) e o que depende de terceiros (API do fornecedor).
- Citar cliente anterior só com autorização; no slide use "caso de origem" e guarde o nome nas notas.
- Dados de demonstração devem estar rotulados como fictícios.

## Personalização por cliente

Troque somente: nome, logo, cores de acento (até 5%), escopo, números, prazos, preços, contato. Mantenha a estrutura visual Gorod (cabeçalho/rodapé, tipografia Inter, lima como ação). Veja a seção "Personalização do cliente" em `SKILL.md` e a proposta MaisFisio HUB como exemplo no modo co-branded claro.

## Checklist antes de enviar

- [ ] Nenhum `{{...}}` ou `[...]` esquecido (exceto os deliberados, listados ao usuário).
- [ ] Conta do parcelamento conferida.
- [ ] Logo do cliente nítida, proporção preservada, sem recolorir.
- [ ] Contraste ≥ 4,5:1 no texto; fonte ≥ 24 px; nada passa da margem inferior (y 920).
- [ ] Notas do apresentador sem dado sensível indevido (qualquer pessoa com acesso ao deck as lê).
- [ ] Avisar o usuário que o deck é privado até ele compartilhar.
