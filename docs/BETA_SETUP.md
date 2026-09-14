# Setup do beta — Google Vision + Supabase

Siga nesta ordem. Sem estes passos o app fica em modo demo local.

## 1) Firebase / Google Cloud (Vision OCR)

1. Abra [Firebase Console](https://console.firebase.google.com/) → **Add project** (ou use um projeto GCP existente).
2. No [Google Cloud Console](https://console.cloud.google.com/) do mesmo projeto:
   - **APIs & Services** → **Enable APIs** → ative **Cloud Vision API**.
   - **Billing** → vincule uma conta de faturamento (obrigatório; sem isso a API retorna 403).
   - Crie alerta de orçamento (ex.: US$ 1–5) em **Billing → Budgets**.
3. **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
4. Restrinja a chave: **API restrictions** → só **Cloud Vision API**.
5. Guarde a chave como `GOOGLE_VISION_API_KEY` (Vercel + `.env.local`).

Free tier Vision: ~1.000 unidades/mês; dentro do limite normalmente não cobra.

## 2) Supabase (login, banco, fotos)

1. Abra [Supabase Dashboard](https://supabase.com/dashboard) → **New project** (plano Free).
2. **SQL Editor** → cole e rode [`supabase/schema.sql`](../supabase/schema.sql).
3. **Authentication** → **Providers** → **Email**:
   - No beta, desligue **Confirm email** (mais simples), **ou** deixe ligado e use a mensagem “verifique o e-mail” no app.
4. **Project Settings** → **API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Depois do primeiro cadastro (você), rode [`supabase/promote_gestor.sql`](../supabase/promote_gestor.sql) trocando o e-mail.

## 3) Variáveis locais

Copie `.env.example` → `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
GOOGLE_VISION_API_KEY=AIza...
```

Reinicie `npm run dev`.

## 4) Vercel (produção)

No projeto **gasto-campo**:

1. **Settings** → **Environment Variables** — as 3 variáveis acima (Production).
2. **Deployments** → **⋯** → **Redeploy**.

URL: https://gasto-campo.vercel.app

## 5) Checklist de teste beta

- [ ] Login com conta real (não `*@demo.com`)
- [ ] Cadastro só oferece Técnico / Executivo
- [ ] Nova despesa online mostra “Lido com Google Vision”
- [ ] Valor / NF / data preenchidos; categoria e região manuais
- [ ] Despesa aparece no histórico do gestor noutro aparelho **com foto**
- [ ] Financeiro aprova/rejeita e exporta CSV
