-- Payments through PayPal: a project unlocked, a pro's fee paid by their client, a pro's Studio or Build plan.
--   payments: one row per PayPal order (or subscription), written when it is made and settled once, by the capture
--   or the webhook, whichever comes first. The order and capture ids are unique, so nothing is ever counted twice.
--   profiles.paypal_email: where a pro's fees are paid; profiles.paypal_subscription: their live plan, if any.

create table if not exists payments (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('unlock', 'fee', 'plan')),
  purpose text not null,                       -- the custom_id sent to PayPal, e.g. fee:42
  project_id uuid references projects (id) on delete set null,
  milestone_id bigint references milestones (id) on delete set null,
  payer_id uuid references auth.users (id) on delete set null,
  payee_email text,                            -- the pro's PayPal, for a fee; null when Arcon is paid
  order_id text unique,
  capture_id text unique,
  subscription_id text unique,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'created' check (status in ('created', 'completed', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists payments_project on payments (project_id, created_at desc);
create index if not exists payments_payer on payments (payer_id, created_at desc);
alter table payments enable row level security;

alter table profiles add column if not exists paypal_email text check (paypal_email is null or paypal_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table profiles add column if not exists paypal_subscription text;

-- a fee paid through PayPal says so, with the payment it came from
alter table milestones add column if not exists payment_id bigint references payments (id) on delete set null;
