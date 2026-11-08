-- Arcon Studio connections: a person connects Arcon Studio (the agent workspace) to their own Arcon account.
--   studio_tokens: one row per connection. Only the token's sha256 is kept; the token itself is shown once.
--   A connection acts as that person, with their own role on each project, until it expires or is revoked.

create table if not exists studio_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  token_hash text not null unique check (char_length(token_hash) = 64),
  hint text not null check (char_length(hint) <= 20),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists studio_tokens_user on studio_tokens (user_id, created_at desc);
alter table studio_tokens enable row level security;
