-- ============================================================
-- Video Payment Fields Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. video_consultation_fee on veterinarians (min 200 TL)
alter table public.veterinarians
  add column if not exists video_consultation_fee integer default 300
    check (video_consultation_fee >= 200);

-- 2. Payment tracking on appointments
alter table public.appointments
  add column if not exists payment_status text default 'none'
    check (payment_status in ('none', 'held', 'completed', 'refunded_full', 'refunded_partial')),
  add column if not exists payment_id text,
  add column if not exists payment_amount integer;

-- 3. payments table (if not already exists)
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  vet_id uuid references public.veterinarians(id) on delete set null,
  owner_id uuid references public.users(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  amount integer not null,
  type text not null check (type in ('subscription', 'video_consultation')),
  status text not null check (status in ('pending', 'success', 'failed', 'refunded_full', 'refunded_partial')),
  iyzico_payment_id text,
  iyzico_transaction_id text,
  description text,
  created_at timestamptz default now()
);

alter table public.payments enable row level security;
create policy if not exists "Vet reads own payments" on public.payments for select using (
  exists (select 1 from public.veterinarians v where v.id = vet_id and v.user_id = auth.uid())
);
create policy if not exists "Owner reads own payments" on public.payments for select using (
  auth.uid() = owner_id
);
