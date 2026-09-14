# Gasto Campo — Grupo Daan

PWA de despesas de campo: foto da nota, OCR (Google Vision), offline e sync com Supabase.

## Beta (produção)

Siga o guia completo: **[docs/BETA_SETUP.md](docs/BETA_SETUP.md)**

Resumo:

1. Projeto Firebase/GCP com **Cloud Vision** + billing + `GOOGLE_VISION_API_KEY`
2. Projeto **Supabase** novo + SQL em `supabase/schema.sql`
3. `.env.local` e variáveis na **Vercel** + Redeploy
4. Promover o 1º gestor com `supabase/promote_gestor.sql`

App: https://gasto-campo.vercel.app

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev
```

Sem `.env.local`, o app sobe em **modo demo** (só no aparelho; senha `demo123`). Isso **não** é o beta.

### Papéis no beta

| Papel | Como obtém |
|--------|------------|
| Técnico / Executivo | Cadastro no app |
| Gestor / Financeiro | Promoção via SQL (`promote_gestor.sql`) |

OCR preenche **valor**, **NF** e **data**. Categoria e região são manuais.

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build` / `npm start` — produção
- `npm run lint` — ESLint
