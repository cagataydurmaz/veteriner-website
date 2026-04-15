-- ============================================================
-- VetBul — Full Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- USERS
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  role text not null check (role in ('owner', 'vet', 'admin')) default 'owner',
  city text,
  avatar_url text,
  created_at timestamptz default now(),
  constraint users_email_unique unique (email)
);
alter table public.users enable row level security;
create policy "Users read own" on public.users for select using (auth.uid() = id);
create policy "Users update own" on public.users for update using (auth.uid() = id);
create policy "Users insert own" on public.users for insert with check (auth.uid() = id);

-- VETERINARIANS
create table if not exists public.veterinarians (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade unique,
  specialty text default 'Genel Veteriner',
  city text,
  bio text,
  education text,
  license_number text,
  chamber_number text,
  diploma_url text,
  intro_video_url text,
  consultation_fee integer default 300,
  is_verified boolean default false,
  average_rating numeric(3,2) default 0,
  total_reviews integer default 0,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'pro', 'premium')),
  created_at timestamptz default now()
);
alter table public.veterinarians enable row level security;
create policy "Public read verified vets" on public.veterinarians for select using (is_verified = true);
create policy "Vet read own" on public.veterinarians for select using (auth.uid() = user_id);
create policy "Vet update own" on public.veterinarians for update using (auth.uid() = user_id);
create policy "Vet insert own" on public.veterinarians for insert with check (auth.uid() = user_id);

-- PETS
create table if not exists public.pets (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  name text not null,
  species text not null check (species in ('dog', 'cat', 'bird', 'rabbit', 'other')),
  breed text,
  birth_date date,
  weight numeric(5,2),
  gender text check (gender in ('male', 'female')),
  is_neutered boolean default false,
  microchip_number text,
  avatar_url text,
  notes text,
  created_at timestamptz default now()
);
alter table public.pets enable row level security;
create policy "Owner manages pets" on public.pets for all using (auth.uid() = owner_id);

-- APPOINTMENTS
create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  vet_id uuid references public.veterinarians(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes integer default 30,
  type text default 'video' check (type in ('video', 'in_person', 'phone')),
  status text default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  notes text,
  fee integer,
  video_room_id text,
  video_room_url text,
  created_at timestamptz default now()
);
alter table public.appointments enable row level security;
create policy "Owner manages appointments" on public.appointments for all using (auth.uid() = owner_id);
create policy "Vet manages appointments" on public.appointments for all using (
  exists (select 1 from public.veterinarians v where v.id = vet_id and v.user_id = auth.uid())
);

-- REVIEWS
create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  vet_id uuid references public.veterinarians(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);
alter table public.reviews enable row level security;
create policy "Public read reviews" on public.reviews for select using (true);
create policy "Owner writes reviews" on public.reviews for insert with check (auth.uid() = owner_id);

create or replace function update_vet_rating()
returns trigger as $$
begin
  update public.veterinarians
  set
    average_rating = (select avg(rating) from public.reviews where vet_id = new.vet_id),
    total_reviews = (select count(*) from public.reviews where vet_id = new.vet_id)
  where id = new.vet_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_review_insert
  after insert on public.reviews
  for each row execute function update_vet_rating();

-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  body text,
  type text default 'info',
  is_read boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "User manages notifications" on public.notifications for all using (auth.uid() = user_id);

-- BLOG POSTS
create table if not exists public.blog_posts (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text unique not null,
  excerpt text,
  content text not null,
  cover_image text,
  tags text[] default '{}',
  author_name text default 'VetBul Editörü',
  published boolean default false,
  published_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table public.blog_posts enable row level security;
create policy "Public read published posts" on public.blog_posts for select using (published = true);

-- SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  vet_id uuid references public.veterinarians(id) on delete cascade,
  tier text not null check (tier in ('pro', 'premium')),
  period text not null check (period in ('monthly', '6month', '12month')),
  amount integer not null,
  status text default 'active' check (status in ('active', 'cancelled', 'expired')),
  starts_at timestamptz default now(),
  ends_at timestamptz,
  iyzico_token text,
  created_at timestamptz default now()
);
alter table public.subscriptions enable row level security;
create policy "Vet reads own subs" on public.subscriptions for select using (
  exists (select 1 from public.veterinarians v where v.id = vet_id and v.user_id = auth.uid())
);

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public) values ('diplomas', 'diplomas', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('vet-videos', 'vet-videos', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;

create policy "Auth upload diplomas" on storage.objects for insert with check (bucket_id = 'diplomas' and auth.role() = 'authenticated');
create policy "Public read vet-videos" on storage.objects for select using (bucket_id = 'vet-videos');
create policy "Auth upload vet-videos" on storage.objects for insert with check (bucket_id = 'vet-videos' and auth.role() = 'authenticated');
create policy "Auth update vet-videos" on storage.objects for update using (bucket_id = 'vet-videos' and auth.role() = 'authenticated');
create policy "Public read avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Auth upload avatars" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- AUTO-CREATE USER PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'owner')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
