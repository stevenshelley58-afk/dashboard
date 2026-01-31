-- Tasks/Todo table for business task management
-- Simple and ADHD-friendly - just what you need to get things done

create table if not exists tasks (
  task_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(account_id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'archived')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  completed_at timestamptz,
  created_by uuid references users(user_id),
  assigned_to uuid references users(user_id),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_account_status
  on tasks (account_id, status, position);

create index if not exists idx_tasks_account_due_date
  on tasks (account_id, due_date) where status != 'archived';

-- Trigger to auto-update updated_at
create or replace function update_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_updated_at_trigger on tasks;
create trigger tasks_updated_at_trigger
  before update on tasks
  for each row execute function update_tasks_updated_at();
