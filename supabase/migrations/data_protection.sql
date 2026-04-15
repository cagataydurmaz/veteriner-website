-- ============================================
-- DATA PROTECTION & ANTI-CIRCUMVENTION SYSTEM
-- ============================================

-- Add terms acceptance to veterinarians
alter table public.veterinarians
  add column if not exists terms_accepted boolean default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists suspension_until timestamptz,
  add column if not exists violation_count integer default 0,
  add column if not exists is_banned boolean default false;

-- Internal messaging
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  receiver_id uuid not null references public.users(id),
  content text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_messages_appointment on public.messages(appointment_id);
create index if not exists idx_messages_sender on public.messages(sender_id);

-- Blocked message attempts log
create table if not exists public.blocked_messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  sender_id uuid not null references public.users(id),
  content text not null,
  block_reason text not null,
  created_at timestamptz default now()
);

create index if not exists idx_blocked_messages_sender on public.blocked_messages(sender_id);

-- Violation reports (owner reports vet)
create table if not exists public.violation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id),
  vet_id uuid not null references public.veterinarians(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  reason text not null check (reason in (
    'platform_disina_yonlendirdi',
    'iletisim_bilgisi_paylasti',
    'uygunsuz_davranis',
    'diger'
  )),
  details text,
  status text default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  admin_note text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

create index if not exists idx_violation_reports_vet on public.violation_reports(vet_id);
create index if not exists idx_violation_reports_status on public.violation_reports(status);

-- Fraud / suspicious behavior flags
create table if not exists public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  vet_id uuid not null references public.veterinarians(id) on delete cascade,
  flag_type text not null check (flag_type in (
    'repeated_cancellations_pair',
    'high_cancellation_rate',
    'no_completions_30days'
  )),
  details jsonb default '{}',
  is_resolved boolean default false,
  admin_notified boolean default false,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists idx_fraud_flags_vet on public.fraud_flags(vet_id);
create index if not exists idx_fraud_flags_resolved on public.fraud_flags(is_resolved);

-- RLS policies for messages
alter table public.messages enable row level security;

create policy "Users can view their own messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Users can mark messages as read"
  on public.messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- RLS for blocked messages (insert only for authenticated, admin can read)
alter table public.blocked_messages enable row level security;

create policy "System can log blocked messages"
  on public.blocked_messages for insert
  with check (auth.uid() = sender_id);

-- RLS for violation reports
alter table public.violation_reports enable row level security;

create policy "Users can submit reports"
  on public.violation_reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users can view own reports"
  on public.violation_reports for select
  using (auth.uid() = reporter_id);

-- RLS for fraud flags (admin only via service role)
alter table public.fraud_flags enable row level security;
