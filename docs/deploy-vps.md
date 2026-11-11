# Produção em VPS (sem Supabase gerenciado)

Stack em `deploy/`: **Caddy** (TLS automático) → **web** (Next.js) + **auth** (GoTrue) + **rest** (PostgREST) → **db** (Postgres do Supabase). Só o Caddy publica portas (80/443); o banco nunca é exposto. O app usa apenas Auth e PostgREST (tabelas e RPC), por isso não há Storage, Realtime nem funções de borda.

## Subir
1. VPS Linux (4 vCPU / 8 GB / 160 GB NVMe, datacenter no Brasil) com Docker e Compose. Aponte o DNS do domínio para o IP.
2. `cp deploy/.env.example deploy/.env`; preencha `SITE_ADDRESS`, `SITE_HOST` e `PUBLIC_URL` com o domínio; gere os segredos: `node deploy/scripts/gen-secrets.mjs` e cole a saída no `.env`. Preencha o SMTP (convites e senha).
3. `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build`. Se o build do Compose reclamar de permissão, construa a imagem com `docker build` (args `NEXT_PUBLIC_*`) e suba com `--no-build`.
4. As migrações de `supabase/migrations` são aplicadas pelo serviço `migrate` (uma vez cada).
5. Crie o primeiro super_admin pela API admin do GoTrue (`/auth/v1/admin/users`, com `SERVICE_ROLE_KEY`) e vincule o perfil como nos docs de implantação. O cadastro público fica **desativado**.

## Backup e restauração (testados)
- `deploy/scripts/backup.sh` gera `deploy/backups/maisfisio-<data>.dump` (public + auth), valida a leitura, grava o sha256 e apaga arquivos com mais de 30 dias. Agende no cron do host e **envie a pasta para storage externo** (rclone/S3 em outro provedor).
- `deploy/scripts/restore.sh <arquivo>` esvazia public/auth e restaura em **uma transação** (se falhar, nada muda).
- Teste executado em 11/11/2026 (ambiente local): banco populado, backup, **volume apagado**, stack recriado do zero, restauração. Resultado: contagens por tabela e hash das contas **idênticos**, login com a senha original funcionando. Repita o teste na VPS real antes de prometer "restauração testada".
- Limites: é backup lógico diário (perda máxima de até 24 h). Para perda quase zero, adicionar arquivamento de WAL (pgBackRest/wal-g). O backup deve ser restaurado em um stack com as **mesmas migrações**.

## Ainda falta (para a venda)
MFA para admins, WAL/PITR, monitoramento e alertas (uptime, disco, falha de backup), atualização das imagens (CVEs), firewall (só 80/443/SSH por chave), homologação em outra VPS, SMTP real, política de retenção/LGPD, e o teste de restauração repetido na VPS.
