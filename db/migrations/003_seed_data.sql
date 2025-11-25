-- Seed data for local development so the web + worker apps have an account context.

insert into accounts (
  account_id,
  name,
  plan_tier,
  currency,
  created_at
)
values (
  '079ed5c0-4dfd-4feb-aa91-0c4017a7be2f',
  'Internal Agency',
  'agency_internal',
  'USD',
  now()
)
on conflict (account_id) do update set
  name = excluded.name,
  plan_tier = excluded.plan_tier,
  currency = excluded.currency;

insert into users (
  user_id,
  account_id,
  email,
  role,
  created_at
)
values (
  '8d589c1f-02f9-45d7-9c8c-9c3d9b07f0f9',
  '079ed5c0-4dfd-4feb-aa91-0c4017a7be2f',
  'founder@example.com',
  'owner',
  now()
)
on conflict (user_id) do update set
  account_id = excluded.account_id,
  email = excluded.email,
  role = excluded.role;



