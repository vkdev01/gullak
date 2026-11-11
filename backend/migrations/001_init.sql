-- Gullak — MVP 0 schema (Postgres 15+)
-- The FastAPI models create the same tables; this file is the production path,
-- because it also installs the row-level security that keeps households apart.

create extension if not exists pgcrypto;

create table users (
  id            text primary key default encode(gen_random_bytes(16), 'hex'),
  email         citext unique not null,
  name          text not null,
  password_hash text not null,
  timezone      text not null default 'Asia/Kolkata',
  currency      char(3) not null default 'INR',
  created_at    timestamptz not null default now()
);

create table households (
  id              text primary key default encode(gen_random_bytes(16), 'hex'),
  name            text not null,
  currency        char(3) not null default 'INR',
  cycle_start_day smallint not null default 1,
  created_at      timestamptz not null default now()
);

create table memberships (
  id           text primary key default encode(gen_random_bytes(16), 'hex'),
  household_id text not null references households(id) on delete cascade,
  user_id      text not null references users(id) on delete cascade,
  role         text not null default 'owner',
  unique (household_id, user_id)
);

create table accounts (
  id              text primary key default encode(gen_random_bytes(16), 'hex'),
  household_id    text not null references households(id) on delete cascade,
  name            text not null,
  type            text not null default 'bank',
  institution     text default '',
  masked_number   text default '',
  opening_balance bigint not null default 0,   -- paise
  currency        char(3) not null default 'INR',
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

create table categories (
  id           text primary key default encode(gen_random_bytes(16), 'hex'),
  household_id text not null references households(id) on delete cascade,
  parent_id    text references categories(id),
  name         text not null,
  kind         text not null default 'expense',
  colour       text not null default 'green'
);

create table merchants (
  id                  text primary key default encode(gen_random_bytes(16), 'hex'),
  household_id        text not null references households(id) on delete cascade,
  name                text not null,
  default_category_id text references categories(id)
);

create table transactions (
  id           text primary key default encode(gen_random_bytes(16), 'hex'),
  household_id text not null references households(id) on delete cascade,
  account_id   text not null references accounts(id),
  direction    text not null check (direction in ('debit','credit')),
  amount       bigint not null check (amount > 0),   -- paise, always positive
  occurred_at  date not null,
  merchant     text not null,
  category_id  text references categories(id),
  note         text default '',
  source       text not null default 'manual',
  confidence   numeric(3,2) default 1.0,
  created_at   timestamptz not null default now()
);

create index transactions_household_date on transactions (household_id, occurred_at desc);
create index transactions_category on transactions (household_id, category_id, occurred_at desc);

create table transaction_splits (
  id             text primary key default encode(gen_random_bytes(16), 'hex'),
  transaction_id text not null references transactions(id) on delete cascade,
  category_id    text references categories(id),
  amount         bigint not null,
  note           text default ''
);

-- splits must sum to the parent amount
create or replace function assert_splits_sum() returns trigger as $$
declare total bigint; parent bigint;
begin
  select coalesce(sum(amount), 0) into total from transaction_splits
    where transaction_id = coalesce(new.transaction_id, old.transaction_id);
  select amount into parent from transactions where id = coalesce(new.transaction_id, old.transaction_id);
  if parent is not null and total <> parent then
    raise exception 'splits (%) do not sum to parent amount (%)', total, parent;
  end if;
  return null;
end $$ language plpgsql;

create constraint trigger splits_sum_check
  after insert or update or delete on transaction_splits
  deferrable initially deferred
  for each row execute function assert_splits_sum();

-- tenant isolation: the API sets app.household_id per request
alter table accounts            enable row level security;
alter table categories          enable row level security;
alter table merchants           enable row level security;
alter table transactions        enable row level security;
alter table transaction_splits  enable row level security;

create policy tenant_accounts on accounts
  using (household_id = current_setting('app.household_id', true));
create policy tenant_categories on categories
  using (household_id = current_setting('app.household_id', true));
create policy tenant_merchants on merchants
  using (household_id = current_setting('app.household_id', true));
create policy tenant_transactions on transactions
  using (household_id = current_setting('app.household_id', true));
