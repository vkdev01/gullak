-- Gullak — MVP 2: budgets, goals, transfers and the numbers behind the dashboard.
-- Apply after 001_init.sql and 002_mvp1.sql.

-- 1. Transfers are two legs sharing an id, so a card payment never counts as spend.
alter table transactions
  add column if not exists transfer_id text;

create index if not exists transactions_transfer on transactions (transfer_id)
  where transfer_id is not null;

-- 2. Budgets: a category cap, or an envelope, for a repeating period.
create table if not exists budgets (
  id           text primary key default encode(gen_random_bytes(16), 'hex'),
  household_id text not null references households(id) on delete cascade,
  category_id  text references categories(id),
  name         text not null default '',
  period       text not null default 'monthly' check (period in ('monthly','weekly')),
  amount       bigint not null check (amount > 0),   -- paise
  rollover     boolean not null default false,
  is_active    boolean not null default true,
  created_on   date not null default current_date,
  created_at   timestamptz not null default now()
);
create index if not exists budgets_household on budgets (household_id) where is_active;

-- 3. Goals and the money that has gone into them.
create table if not exists goals (
  id             text primary key default encode(gen_random_bytes(16), 'hex'),
  household_id   text not null references households(id) on delete cascade,
  name           text not null,
  target         bigint not null check (target > 0),
  target_date    date,
  monthly_target bigint,
  account_id     text references accounts(id),
  status         text not null default 'active',
  created_at     timestamptz not null default now()
);

create table if not exists goal_contributions (
  id             text primary key default encode(gen_random_bytes(16), 'hex'),
  goal_id        text not null references goals(id) on delete cascade,
  amount         bigint not null,
  contributed_on date not null default current_date,
  transaction_id text references transactions(id),
  note           text not null default ''
);
create index if not exists goal_contributions_goal on goal_contributions (goal_id);

-- 4. The salary day lives on the household: it decides where every period starts.
--    (cycle_start_day already exists from 001_init.sql, defaulting to 1.)

-- 5. Tenant isolation.
alter table budgets            enable row level security;
alter table goals              enable row level security;
alter table goal_contributions enable row level security;

create policy tenant_budgets on budgets
  using (household_id = current_setting('app.household_id', true));

create policy tenant_goals on goals
  using (household_id = current_setting('app.household_id', true));

create policy tenant_goal_contributions on goal_contributions
  using (goal_id in (
    select id from goals where household_id = current_setting('app.household_id', true)
  ));
