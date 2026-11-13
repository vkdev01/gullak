-- Gullak — budgets that mean one thing, and rows that can be described.
-- Apply after 003_mvp2.sql.

-- 1. Free-form tags, stored ",trip,car," so a tag filter is a LIKE (see services/tags.py).
alter table transactions
  add column if not exists tags text not null default '';

-- 2. One active budget per category, and one overall budget per household.
--    The API refuses duplicates with a 409; this is the last line of defence.
create unique index if not exists budgets_one_per_scope
  on budgets (household_id, coalesce(category_id, ''))
  where is_active;

-- 3. Fixed bills (rent, EMIs) are paid once a period: no pace, no daily allowance.
alter table budgets
  add column if not exists fixed boolean not null default false;
