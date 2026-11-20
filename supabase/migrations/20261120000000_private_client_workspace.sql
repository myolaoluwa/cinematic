create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  client_name text check (client_name is null or char_length(client_name) <= 120),
  shoot_date date,
  selection_limit smallint not null default 10 check (selection_limit between 1 and 100),
  share_token_hash text not null unique,
  password_salt text not null,
  password_hash text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'deleting')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  access_expires_at timestamptz,
  selection_submitted_at timestamptz
);

create table if not exists public.collection_photos (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  role text not null check (role in ('proof', 'final')),
  original_name text not null check (char_length(original_name) between 1 and 180),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  file_size bigint not null check (file_size between 1 and 52428800),
  storage_path text not null unique,
  upload_status text not null default 'pending' check (upload_status in ('pending', 'ready', 'deleting')),
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, collection_id)
);

create table if not exists public.collection_selections (
  collection_id uuid not null references public.collections(id) on delete cascade,
  photo_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (collection_id, photo_id),
  foreign key (photo_id, collection_id)
    references public.collection_photos(id, collection_id) on delete cascade
);

create index if not exists collections_owner_created_idx
  on public.collections (owner_id, created_at desc);
create index if not exists collection_photos_gallery_idx
  on public.collection_photos (collection_id, role, sort_order, created_at);

alter table public.collections enable row level security;
alter table public.collections force row level security;
alter table public.collection_photos enable row level security;
alter table public.collection_photos force row level security;
alter table public.collection_selections enable row level security;
alter table public.collection_selections force row level security;

revoke all on public.collections, public.collection_photos, public.collection_selections
  from anon, authenticated;
grant all on public.collections, public.collection_photos, public.collection_selections
  to service_role;

create table if not exists public.client_auth_attempts (
  share_token_hash text not null,
  ip_hash text not null,
  failed_attempts smallint not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  primary key (share_token_hash, ip_hash)
);

alter table public.client_auth_attempts enable row level security;
alter table public.client_auth_attempts force row level security;
revoke all on public.client_auth_attempts from anon, authenticated;
grant all on public.client_auth_attempts to service_role;

create or replace function public.record_client_auth_attempt(
  p_share_token_hash text,
  p_ip_hash text,
  p_success boolean
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.client_auth_attempts%rowtype;
begin
  insert into public.client_auth_attempts (share_token_hash, ip_hash, failed_attempts)
  values (p_share_token_hash, p_ip_hash, 0)
  on conflict (share_token_hash, ip_hash) do nothing;

  select * into attempt
  from public.client_auth_attempts
  where share_token_hash = p_share_token_hash and ip_hash = p_ip_hash
  for update;

  if p_success then
    delete from public.client_auth_attempts
    where share_token_hash = p_share_token_hash and ip_hash = p_ip_hash;
    return true;
  end if;

  if found and attempt.locked_until is not null and attempt.locked_until > now() then
    return false;
  end if;

  if attempt.window_started_at < now() - interval '15 minutes' then
    update public.client_auth_attempts
    set failed_attempts = 1, window_started_at = now(), locked_until = null
    where share_token_hash = p_share_token_hash and ip_hash = p_ip_hash;
    return true;
  end if;

  update public.client_auth_attempts
  set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 10 then now() + interval '15 minutes' else null end
  where share_token_hash = p_share_token_hash and ip_hash = p_ip_hash
  returning * into attempt;

  return attempt.locked_until is null or attempt.locked_until <= now();
end;
$$;

create or replace function public.update_client_selection(
  p_collection_id uuid,
  p_photo_id uuid,
  p_selected boolean
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  gallery public.collections%rowtype;
  current_count integer;
begin
  select * into gallery
  from public.collections
  where id = p_collection_id
  for update;

  if not found or gallery.status <> 'published' or gallery.access_expires_at <= now() then
    raise exception 'collection_unavailable' using errcode = 'P0001';
  end if;
  if gallery.selection_submitted_at is not null then
    raise exception 'selection_locked' using errcode = 'P0001';
  end if;

  if p_selected then
    if not exists (
      select 1 from public.collection_photos
      where id = p_photo_id
        and collection_id = p_collection_id
        and role = 'proof'
        and upload_status = 'ready'
        and published_at is not null
    ) then
      raise exception 'photo_unavailable' using errcode = 'P0001';
    end if;

    insert into public.collection_selections (collection_id, photo_id)
    values (p_collection_id, p_photo_id)
    on conflict do nothing;

    select count(*) into current_count
    from public.collection_selections
    where collection_id = p_collection_id;
    if current_count > gallery.selection_limit then
      delete from public.collection_selections
      where collection_id = p_collection_id and photo_id = p_photo_id;
      raise exception 'selection_limit_reached' using errcode = 'P0001';
    end if;
  else
    delete from public.collection_selections
    where collection_id = p_collection_id and photo_id = p_photo_id;
  end if;

  select count(*) into current_count
  from public.collection_selections
  where collection_id = p_collection_id;
  return current_count;
end;
$$;

create or replace function public.publish_client_collection(
  p_collection_id uuid,
  p_owner_id uuid
) returns table (
  id uuid,
  title text,
  client_name text,
  shoot_date date,
  selection_limit smallint,
  status text,
  created_at timestamptz,
  published_at timestamptz,
  access_expires_at timestamptz,
  selection_submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  gallery public.collections%rowtype;
  publish_time timestamptz := now();
begin
  select * into gallery
  from public.collections
  where collections.id = p_collection_id
    and owner_id = p_owner_id
  for update;

  if not found or gallery.status = 'deleting' then
    raise exception 'collection_unavailable' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.collection_photos
    where collection_id = p_collection_id
      and role = 'proof'
      and upload_status = 'ready'
  ) then
    raise exception 'proofs_required' using errcode = 'P0001';
  end if;

  update public.collection_photos
  set published_at = publish_time
  where collection_id = p_collection_id
    and upload_status = 'ready'
    and (role in ('proof', 'final'));

  return query
  update public.collections
  set status = 'published',
      published_at = publish_time,
      access_expires_at = publish_time + interval '30 days',
      updated_at = publish_time
  where collections.id = p_collection_id
  returning collections.id, collections.title, collections.client_name,
    collections.shoot_date, collections.selection_limit, collections.status,
    collections.created_at, collections.published_at,
    collections.access_expires_at, collections.selection_submitted_at;
end;
$$;

create or replace function public.set_collection_selection_limit(
  p_collection_id uuid,
  p_owner_id uuid,
  p_selection_limit smallint
) returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  gallery public.collections%rowtype;
  current_count integer;
begin
  if p_selection_limit < 1 or p_selection_limit > 100 then
    raise exception 'invalid_selection_limit' using errcode = 'P0001';
  end if;

  select * into gallery
  from public.collections
  where id = p_collection_id and owner_id = p_owner_id
  for update;
  if not found or gallery.status = 'deleting' then
    raise exception 'collection_unavailable' using errcode = 'P0001';
  end if;

  select count(*) into current_count
  from public.collection_selections
  where collection_id = p_collection_id;
  if current_count > p_selection_limit then
    raise exception 'selection_limit_below_current' using errcode = 'P0001';
  end if;

  update public.collections
  set selection_limit = p_selection_limit, updated_at = now()
  where id = p_collection_id;
  return p_selection_limit;
end;
$$;

create or replace function public.reopen_client_selections(
  p_collection_id uuid,
  p_owner_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  update public.collections
  set selection_submitted_at = null, updated_at = now()
  where id = p_collection_id
    and owner_id = p_owner_id
    and status <> 'deleting';
  if not found then
    raise exception 'collection_unavailable' using errcode = 'P0001';
  end if;

  select count(*) into current_count
  from public.collection_selections
  where collection_id = p_collection_id;
  return current_count;
end;
$$;

create or replace function public.submit_client_selections(
  p_collection_id uuid
) returns table (submitted_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  gallery public.collections%rowtype;
  current_count integer;
begin
  select * into gallery
  from public.collections
  where id = p_collection_id
  for update;

  if not found or gallery.status <> 'published' or gallery.access_expires_at <= now() then
    raise exception 'collection_unavailable' using errcode = 'P0001';
  end if;
  if gallery.selection_submitted_at is not null then
    raise exception 'selection_locked' using errcode = 'P0001';
  end if;

  select count(*) into current_count
  from public.collection_selections
  where collection_id = p_collection_id;
  if current_count = 0 then
    raise exception 'no_selections' using errcode = 'P0001';
  end if;

  update public.collections
  set selection_submitted_at = now(), updated_at = now()
  where id = p_collection_id
  returning collections.selection_submitted_at into submitted_at;
  return next;
end;
$$;

create or replace function public.mark_collection_photo_deleting(
  p_photo_id uuid,
  p_owner_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collection_id uuid;
begin
  select c.id into v_collection_id
  from public.collections c
  join public.collection_photos p on p.collection_id = c.id
  where p.id = p_photo_id and c.owner_id = p_owner_id
  for update of c;
  if not found then
    raise exception 'photo_unavailable' using errcode = 'P0001';
  end if;

  update public.collection_photos
  set upload_status = 'deleting'
  where id = p_photo_id and collection_photos.collection_id = v_collection_id;
  delete from public.collection_selections
  where photo_id = p_photo_id and collection_selections.collection_id = v_collection_id;
  return true;
end;
$$;

create or replace function public.delete_collection_photo(
  p_photo_id uuid,
  p_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.collection_photos p
  using public.collections c
  where p.id = p_photo_id
    and c.id = p.collection_id
    and c.owner_id = p_owner_id;
end;
$$;

revoke all on function public.record_client_auth_attempt(text, text, boolean) from public, anon, authenticated;
revoke all on function public.update_client_selection(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.publish_client_collection(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_collection_selection_limit(uuid, uuid, smallint) from public, anon, authenticated;
revoke all on function public.reopen_client_selections(uuid, uuid) from public, anon, authenticated;
revoke all on function public.submit_client_selections(uuid) from public, anon, authenticated;
revoke all on function public.mark_collection_photo_deleting(uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_collection_photo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_client_auth_attempt(text, text, boolean) to service_role;
grant execute on function public.update_client_selection(uuid, uuid, boolean) to service_role;
grant execute on function public.publish_client_collection(uuid, uuid) to service_role;
grant execute on function public.set_collection_selection_limit(uuid, uuid, smallint) to service_role;
grant execute on function public.reopen_client_selections(uuid, uuid) to service_role;
grant execute on function public.submit_client_selections(uuid) to service_role;
grant execute on function public.mark_collection_photo_deleting(uuid, uuid) to service_role;
grant execute on function public.delete_collection_photo(uuid, uuid) to service_role;

drop policy if exists workspace_bucket_server_only on storage.objects;
alter table storage.objects enable row level security;
create policy workspace_bucket_server_only
  on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'client-galleries')
  with check (bucket_id <> 'client-galleries');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-galleries',
  'client-galleries',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = excluded.allowed_mime_types;
