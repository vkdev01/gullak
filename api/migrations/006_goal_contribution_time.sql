-- Gullak — undo for goal contributions needs to know which one was last.
-- Apply after 005_income_savings.sql.
alter table goal_contributions add column if not exists created_at timestamptz default now();
