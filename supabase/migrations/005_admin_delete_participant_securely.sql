create or replace function public.admin_delete_participant(
  p_participant_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_participant public.participants%rowtype;
begin
  if not exists (
    select 1 from public.admin_profiles
    where user_id = p_actor_user_id and role = 'admin'
  ) then
    raise exception 'FORBIDDEN: admin role required';
  end if;

  select * into v_participant
  from public.participants
  where id = p_participant_id
  for update;

  if not found then
    raise exception 'NOT_FOUND: participant does not exist';
  end if;

  update public.audit_logs
  set participant_id = null
  where participant_id = p_participant_id;

  insert into public.audit_logs (actor_user_id, event_type, metadata)
  values (
    p_actor_user_id,
    'participant_deleted',
    jsonb_build_object(
      'participant_id', v_participant.id,
      'carnet', v_participant.carnet,
      'full_name', v_participant.full_name,
      'previous_status', v_participant.status
    )
  );

  delete from public.participants where id = p_participant_id;
  return jsonb_build_object('ok', true, 'deleted_participant_id', p_participant_id);
end;
$$;

revoke all on function public.admin_delete_participant(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_participant(uuid, uuid) to service_role;
