-- Gullak — MVP 1: statement import, rules and the review queue.
-- Apply after 001_init.sql.

-- 1. Transactions learn where they came from and whether a human has looked.
alter table transactions
  add column if not exists needs_review    boolean not null default false,
  add column if not exists dedupe_hash     text,
  add column if not exists import_batch_id text;

create index if not exists transactions_review on transactions (household_id, needs_review)
  where needs_review;

-- The database, not the application, is the last line of defence against a
-- statement being imported twice.
create unique index if not exists transactions_dedupe
  on transactions (account_id, dedupe_hash)
  where dedupe_hash is not null;

-- 2. User-authored categorisation rules. They win over every heuristic.
create table if not exists rules (
  id           text primary key default encode(gen_random_bytes(16), 'hex'),
  household_id text not null references households(id) on delete cascade,
  name         text not null default '',
  priority     int  not null default 100,
  match_type   text not null default 'contains' check (match_type in ('contains','equals','regex')),
  pattern      text not null,
  category_id  text not null references categories(id),
  created_at   timestamptz not null default now()
);
create index if not exists rules_household on rules (household_id, priority);

-- 3. Import batches: one uploaded statement, previewed before it is committed.
create table if not exists import_batches (
  id              text primary key default encode(gen_random_bytes(16), 'hex'),
  household_id    text not null references households(id) on delete cascade,
  account_id      text not null references accounts(id),
  filename        text not null default 'statement.csv',
  status          text not null default 'preview' check (status in ('preview','committed')),
  row_count       int  not null default 0,
  duplicate_count int  not null default 0,
  review_count    int  not null default 0,
  imported_count  int  not null default 0,
  mapping         text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists import_batches_household on import_batches (household_id, created_at desc);

-- 4. Candidate rows. Kept after commit so the preview stays auditable.
create table if not exists import_rows (
  id           text primary key default encode(gen_random_bytes(16), 'hex'),
  batch_id     text not null references import_batches(id) on delete cascade,
  line_no      int  not null default 0,
  occurred_at  date not null,
  description  text not null default '',
  merchant     text not null default '',
  direction    text not null default 'debit' check (direction in ('debit','credit')),
  amount       bigint not null check (amount > 0),
  category_id  text references categories(id),
  confidence   numeric(3,2) not null default 0,
  reason       text not null default '',
  dedupe_hash  text not null default '',
  is_duplicate boolean not null default false,
  status       text not null default 'ready'
);
create index if not exists import_rows_batch on import_rows (batch_id, line_no);
create index if not exists import_rows_hash  on import_rows (dedupe_hash);

-- 5. Tenant isolation for the new tables.
alter table rules          enable row level security;
alter table import_batches enable row level security;
alter table import_rows    enable row level security;

create policy tenant_rules on rules
  using (household_id = current_setting('app.household_id', true));

create policy tenant_import_batches on import_batches
  using (household_id = current_setting('app.household_id', true));

create policy tenant_import_rows on import_rows
  using (batch_id in (
    select id from import_batches
    where household_id = current_setting('app.household_id', true)
  ));
