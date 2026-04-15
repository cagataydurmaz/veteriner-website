-- Add service type columns to veterinarians table
alter table public.veterinarians
  add column if not exists offers_in_person boolean default true,
  add column if not exists offers_video boolean default false,
  add column if not exists offers_nobetci boolean default false,
  add column if not exists is_on_call boolean default false;

-- Index for filtering by service type
create index if not exists idx_vets_offers_in_person on public.veterinarians(offers_in_person) where offers_in_person = true;
create index if not exists idx_vets_offers_video on public.veterinarians(offers_video) where offers_video = true;
create index if not exists idx_vets_offers_nobetci on public.veterinarians(offers_nobetci) where offers_nobetci = true;
create index if not exists idx_vets_is_on_call on public.veterinarians(is_on_call) where is_on_call = true;
