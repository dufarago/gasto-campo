# Gasto Campo

PWA para controle de despesas de viagem: captura de notas, OCR (valor e número), modo offline e dashboard para gestão/financeiro.

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Contas demo (modo local)

Sem Supabase configurado, use senha `demo123`:

| E-mail | Perfil |
|--------|--------|
| tecnico@demo.com | Técnico |
| executivo@demo.com | Executivo |
| gestor@demo.com | Gestor |
| financeiro@demo.com | Financeiro |

No mesmo navegador, as despesas ficam no IndexedDB e o gestor/financeiro vê o consolidado local. Em produção, use Supabase para sincronizar entre aparelhos.

## Supabase (produção)

1. Crie um projeto no [Supabase](https://supabase.com).
2. Rode o SQL em [`supabase/schema.sql`](supabase/schema.sql).
3. Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Reinicie `npm run dev`.

## Recursos da v1

- Login por perfil (técnico, executivo, gestor, financeiro)
- Foto da nota + compressão
- OCR (Tesseract) sugerindo valor e número da NF, com revisão manual
- Salvamento offline (IndexedDB) + fila de sync automática ao voltar online
- Histórico, dashboard por pessoa e fila financeira com aprovação/CSV
- Manifest PWA + service worker

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build` / `npm start` — produção
- `npm run lint` — ESLint
