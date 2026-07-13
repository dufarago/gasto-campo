-- Gasto Campo — schema Supabase
-- Execute no SQL Editor do projeto Supabase

create extension if not exists "pgcrypto";

create type public.user_role as enum ('tecnico', 'executivo', 'gestor', 'financeiro');
create type public.expense_status as enum (
  'rascunho',
  'pendente_sync',
  'enviado',
  'aprovado',
  'rejeitado'
);
create type public.expense_category as enum (
  'combustivel',
  'hotel',
  'refeicao',
  'pedagio',
  'outros'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role public.user_role not null default 'tecnico',
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  user_id uuid not null references public.profiles(id),
  user_name text not null,
  user_role public.user_role not null,
  amount numeric(12, 2) not null,
  invoice_number text not null default '',
  expense_date date not null,
  category public.expense_category not null default 'outros',
  region text not null default '',
  notes text not null default '',
  status public.expense_status not null default 'enviado',
  image_path text,
  ocr_confidence numeric(5, 4),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz
);

create index expenses_user_id_idx on public.expenses(user_id);
create index expenses_status_idx on public.expenses(status);
create index expenses_date_idx on public.expenses(expense_date);

alter table public.profiles enable row level security;
alter table public.expenses enable row level security;

create or replace function public.is_manager_or_finance()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('gestor', 'financeiro')
  );
$$;

create policy "profiles_select_own_or_manager"
  on public.profiles for select
  using (id = auth.uid() or public.is_manager_or_finance());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

create policy "expenses_select"
  on public.expenses for select
  using (user_id = auth.uid() or public.is_manager_or_finance());

create policy "expenses_insert_own"
  on public.expenses for insert
  with check (user_id = auth.uid());

create policy "expenses_update_own_or_finance"
  on public.expenses for update
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'financeiro'
    )
    or public.is_manager_or_finance()
  );

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "receipts_read_own_or_manager"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_manager_or_finance()
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'tecnico')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
