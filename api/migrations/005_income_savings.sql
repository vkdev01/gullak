-- Gullak — income, savings and investments as their own flows.
-- Apply after 004_budgets_tags.sql.

-- 1. Savings and investment accounts carry their terms and, when known, a market value.
--    Account types: bank, credit_card, cash, wallet (spending) and
--    fd, rd, ppf, epf, nps, mutual_fund, stocks, gold, other_investment (see services/flows.py).
alter table accounts add column if not exists description    text not null default '';
alter table accounts add column if not exists interest_rate  double precision;
alter table accounts add column if not exists maturity_date  date;
alter table accounts add column if not exists monthly_amount bigint;
alter table accounts add column if not exists current_value  bigint;
alter table accounts add column if not exists value_as_of    date;

-- 2. A third category kind: money set aside, never spending. Existing households get the
--    new defaults from POST /categories/defaults, which only adds what is missing.
--    categories.kind is free text: 'expense' | 'income' | 'saving'.
