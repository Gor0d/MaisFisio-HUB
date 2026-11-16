# Plano: MVP provisório agora, migração para VPS em dezembro/2026

Decisão do Emerson em 15/11/2026: não há VPS ainda. O MVP entra em uso **agora** na estrutura que já está no ar (Vercel + Supabase gerenciado), para a equipe da MaisFisio começar a migrar os serviços para o HUB. A mudança para a VPS própria acontece em **dezembro/2026**, usando o stack de `deploy/` (branch `feat/qualidade-interact-docker`, guia em `docs/deploy-vps.md`).

## Fase A — MVP provisório (a partir de 15/11)

| Item | Situação |
|---|---|
| App | `https://mais-fisio-hub.vercel.app` (Vercel Hobby, região `gru1`) |
| Banco/Auth | Supabase gerenciado, com os dados históricos importados |
| Segurança | Next.js 15.5.29 publicado em 15/11 (corrige avisos críticos, ver `docs/todo-go-live.md`) |

Regras enquanto durar a fase A, para a migração não ter surpresa:

1. **Toda mudança de banco entra como arquivo em `supabase/migrations/`.** Nada de criar tabela, função ou política direto no painel do Supabase: a VPS é montada só a partir dessas migrações, e o que existir apenas no painel se perde.
2. **Os dados lançados agora são os dados reais** e vão para a VPS. Não usar produção para testes manuais com paciente fictício; usar o E2E (que cria e apaga o próprio usuário) ou o ambiente local em Docker.
3. **Fazer o domínio apontar para a Vercel já na fase A** (ver abaixo). Assim a equipe salva o endereço e instala o app no celular uma vez só; na migração muda apenas o DNS.

### Acesso da equipe: senha provisória, sem depender de e-mail

O e-mail padrão do Supabase só entrega para membros da equipe do projeto no Supabase e tem limite de 2 mensagens por hora, então não serve para convidar a equipe da MaisFisio. Para não travar o início, o cadastro de usuário ganhou o modo **senha provisória** (padrão):

1. O gestor cadastra a pessoa em Administração → Colaboradores → "Novo usuário", com "Senha provisória".
2. O sistema mostra a senha **uma única vez**, com um botão para copiar a mensagem de acesso. O gestor envia por mensagem privada.
3. No primeiro acesso, a pessoa só consegue usar o sistema depois de criar a própria senha. A partir daí, quem repassou a senha não a conhece mais.
4. Esqueceu a senha? O gestor abre "Gerenciar" e usa "Gerar nova senha provisória" (substitui o "Esqueci minha senha" por e-mail).

O convite por e-mail continua disponível no mesmo formulário e passa a valer quando o SMTP estiver configurado.

### E-mail institucional (Resend) — quando houver domínio

Avaliado em 15/11/2026: o Resend é a opção indicada e tem integração documentada com o Supabase.

- **Plano gratuito:** 3.000 e-mails/mês, 100/dia, até 3 domínios. Sobra para convites e recuperação de senha de uma equipe. Plano pago: US$ 20/mês (50 mil e-mails) se um dia for preciso.
- **Exige domínio próprio verificado** (registros DNS SPF/DKIM). Sem domínio, o Resend não envia para a equipe. Recomendado usar um subdomínio de envio, ex.: `mail.<domínio>`.
- **Configuração no Supabase** (Authentication → Email → SMTP): host `smtp.resend.com`, porta `465`, usuário `resend`, senha = chave de API do Resend, remetente ex.: `nao-responda@mail.<domínio>`.
- Com SMTP próprio, o limite do Supabase sobe para 30 e-mails/hora (ajustável em Rate Limits).

Ordem quando o domínio sair:

1. Registrar o domínio e criar `hub.<domínio>` apontando para a Vercel (assim a equipe instala o app no celular uma vez só; na migração muda só o DNS).
2. Conta no Resend, verificar `mail.<domínio>` e configurar o SMTP no Supabase como acima.
3. No Supabase Auth: Site URL e Redirect URLs com `https://hub.<domínio>`; cadastro público desligado; senha mínima de 8 caracteres e proteção contra senhas vazadas.
4. Na Vercel: `NEXT_PUBLIC_APP_URL=https://hub.<domínio>` e novo deploy.

## Fase B — Migração para a VPS (dezembro/2026)

### Pré-requisitos (decisões e contratações do Emerson, até 30/11)

- [ ] Contratar a VPS de produção (escolha provisória: Magalu Cloud; ver `docs/comercial/checklist-comercial.md` §4). Linux, Docker liberado, datacenter no Brasil, 4 vCPU/8 GB/160 GB se tudo fica na VPS.
- [ ] VPS ou ambiente de homologação (Hostinger KVM 2) para o ensaio.
- [ ] Storage externo para os backups, em **outro provedor** (S3 compatível, Backblaze B2 etc.).
- [ ] Domínio e SMTP (Resend) resolvidos na fase A. Na VPS, o mesmo SMTP vai para `deploy/.env` (`SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASS=<chave>`).
- [ ] Contas criadas com senha provisória migram normalmente; quem ainda não trocou a senha continua obrigado a trocar (a marca fica em `auth.users`, que é copiado).

### Semana 1 (01–05/12) — preparar o servidor

- [ ] Firewall só com 80/443/SSH, SSH só por chave, `fail2ban`, atualizações automáticas de segurança.
- [ ] Ajustar o `Dockerfile` para o app não rodar como root (`USER node`).
- [ ] Subir o stack de `deploy/` na homologação com dados vazios; criar um `super_admin` de teste; rodar o E2E contra ela (`E2E_BASE_URL=https://...`).
- [ ] Backup diário no cron + envio ao storage externo; monitoramento do `/api/health` (UptimeRobot) e de disco.

### Semana 2 (08–12/12) — ensaio com cópia dos dados reais

- [ ] `pg_dump` do Supabase gerenciado (schemas `public` e `auth`, formato custom), com a mesma lógica de `deploy/scripts/backup.sh`.
- [ ] Restaurar na homologação com `deploy/scripts/restore.sh`.
- [ ] Reconciliar: contagem de linhas por tabela nos dois lados (zero divergência), 3 amostras clínicas por escala (total e melhora iguais), login de um usuário com a **senha antiga**.
- [ ] Conferir os riscos da tabela abaixo, um a um.
- [ ] Ao terminar, apagar a cópia de dados da homologação (são dados reais de paciente).

### Semana 3 (15–19/12) — corte

Janela combinada com a MaisFisio fora do horário de lançamentos (ex.: sexta à noite), com aviso prévio de 48 h:

1. Aviso na equipe: "o sistema fica fora do ar das X às Y".
2. Bloquear escrita na produção atual (pausar o projeto da Vercel ou subir uma página de manutenção).
3. Dump final do Supabase → restore na VPS de produção → reconciliação de contagens.
4. DNS de `hub.<domínio>` passa da Vercel para a VPS (TTL baixado para 300 s um dia antes).
5. Smoke test: login, um lançamento real, uma escala, dashboard; E2E completo.
6. Aviso de volta. **Todos terão de entrar de novo** (as sessões caem porque o segredo JWT muda; as senhas continuam as mesmas).

**Critério para seguir (go/no-go):** reconciliação sem divergência, login com senha antiga funcionando e E2E aprovado. Faltou um dos três → rollback.

**Rollback:** voltar o DNS para a Vercel e reabrir a escrita. Como o Supabase não recebeu nada durante a janela, nada se perde.

### Semana 4 (22/12 em diante) — estabilização

- [ ] Supabase gerenciado mantido **somente leitura por 30 dias** como contingência; depois exportar um último backup, guardar e encerrar o projeto.
- [ ] Repetir o teste de restauração **na VPS real** (pré-requisito para dizer "restauração testada" na proposta).
- [ ] Encerrar o projeto da Vercel.

## Riscos específicos desta migração

| Risco | Mitigação |
|---|---|
| Versão do GoTrue no Supabase gerenciado diferente da `v2.197.0` do stack: o restore só de dados de `auth` falha se as colunas não baterem | Descobrir a versão no ensaio; alinhar a imagem ou ajustar o dump |
| Agendamento da limpeza da auditoria (`pg_cron`, migração `202608030016`) só é criado se a extensão existir | Conferir `select * from cron.job` na VPS após as migrações |
| Variáveis `NEXT_PUBLIC_*` são embutidas no build | Construir a imagem já com o domínio final |
| Lançamentos feitos entre o dump e o corte | Bloqueio de escrita durante a janela (passo 2) |
| Migração `202611070018` (Qualidade) aplicada ou não no Supabase antes do corte | Indiferente: a VPS aplica todas as migrações; o restore traz os dados existentes |
| Cópia de dados reais na homologação | Apagar ao fim do ensaio; homologação recebe as mesmas proteções de acesso |
| Backup lógico diário = até 24 h de perda | Aceito para o início; WAL/PITR (pgBackRest ou wal-g) entra como evolução |
