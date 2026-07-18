# MaisFisio HUB

Sistema web/PWA **multi-unidade** de indicadores assistenciais da MaisFisio (Hospital Público Estadual Galileu, Unidade Santa Terezinha e futuras). A aplicação substitui a coleta manual em planilha, padroniza colaboradores e setores por unidade, calcula as escalas clínicas (Barthel, MRC, Melhoria Funcional da UTI) e oferece dashboard por unidade — com visão consolidada para a matriz —, metas, relatórios e auditoria.

Uso interno da equipe: acesso somente por convite, sem cadastro público e sem indexação por buscadores.

## Stack

- Next.js 15+ (App Router), TypeScript, Tailwind e componentes shadcn/ui
- Supabase (PostgreSQL, Auth e RLS)
- react-hook-form + zod, Recharts, SheetJS e jsPDF
- PWA com manifest e service worker

## Execução local

1. Instale as dependências: `npm install`.
2. Copie `.env.example` para `.env.local` e preencha as chaves do Supabase.
3. Vincule o projeto com a Supabase CLI e execute `supabase db push`.
4. Aplique `supabase/seed.sql` pelo SQL Editor ou com `supabase db reset` no ambiente local.
5. Inicie com `npm run dev` e acesse `http://localhost:3000`.

As instruções completas de implantação, primeiro administrador, importação e verificação estão em [docs/implantacao.md](docs/implantacao.md).

## Comandos de qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run import:xlsx:dry
```

O arquivo `Hospital Público Estadual Galileu - Produção Assistencial.xlsx` é fonte histórica somente leitura e não pode ser alterado ou apagado.
