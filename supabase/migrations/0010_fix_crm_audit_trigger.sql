-- Keep record-field access table-specific; PostgreSQL resolves record fields
-- before boolean short-circuiting in trigger expressions.
create or replace function public.audit_crm_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare row_data record; action text; singular_type text;
begin
  row_data := case when tg_op = 'DELETE' then old else new end;
  action := lower(tg_op);
  singular_type := case tg_table_name when 'branches' then 'branch' when 'customers' then 'customer' else 'vehicle' end;

  if tg_op = 'UPDATE' then
    if tg_table_name = 'branches' then
      if old.is_active and not new.is_active then action := 'deactivated';
      elsif not old.is_primary and new.is_primary then action := 'made_primary';
      end if;
    elsif tg_table_name = 'customers' then
      if not old.is_archived and new.is_archived then action := 'archived'; end if;
    elsif tg_table_name = 'vehicles' then
      if not old.is_archived and new.is_archived then action := 'archived'; end if;
    end if;
  end if;

  insert into public.audit_events (organization_id, actor_user_id, entity_type, entity_id, event_type)
  values (row_data.organization_id, auth.uid(), tg_table_name, row_data.id, singular_type || '.' || action);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
