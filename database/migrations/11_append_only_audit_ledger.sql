-- 11_append_only_audit_ledger.sql
--
-- The action ledger is a compliance artifact: it records what Prism proposed,
-- who approved it, and what actually executed. It must be append-only.
--
-- Before this migration, RLS allowed any signed-in user to UPDATE and INSERT
-- their own public.agent_audit_logs rows with the public anon key, so a user
-- could rewrite or fabricate their own execution history. Writes now happen
-- exclusively through server routes using the service role (which bypasses RLS),
-- and the trigger below protects the ledger from every writer, including those.

-- 1. Remove browser write access. Reads (the Action Ledger page) are unchanged.
drop policy if exists "agent_audit_logs_update_approval" on public.agent_audit_logs;
drop policy if exists "agent_audit_logs_insert" on public.agent_audit_logs;

-- 2. Enforce append-only semantics at the row level.
create or replace function public.prism_guard_audit_log() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'public.agent_audit_logs is append-only and cannot be deleted';
  end if;

  if old.status in ('executed', 'rejected') then
    raise exception 'public.agent_audit_logs row % is terminal (%) and cannot be modified',
      old.id, old.status;
  end if;

  -- Only the documented lifecycle may advance: pending -> approved/rejected/failed,
  -- then approved -> executed/failed.
  if new.status is distinct from old.status and not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'failed')) or
    (old.status = 'approved' and new.status in ('executed', 'failed'))
  ) then
    raise exception 'invalid public.agent_audit_logs status transition: % -> %',
      old.status, new.status;
  end if;

  -- Identity and authorship of a ledger row never change after insert.
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.organization_id is distinct from old.organization_id
     or new.tool_slug is distinct from old.tool_slug
     or new.action_type is distinct from old.action_type
     or new.created_at is distinct from old.created_at then
    raise exception 'immutable public.agent_audit_logs columns cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists prism_guard_audit_log on public.agent_audit_logs;
create trigger prism_guard_audit_log
  before update or delete on public.agent_audit_logs
  for each row execute function public.prism_guard_audit_log();
