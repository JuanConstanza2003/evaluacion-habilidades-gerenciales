-- Estado global del formulario. La tabla solo es accesible por service_role (Edge Functions).
create table if not exists public.form_settings (
  id smallint primary key check (id = 1),
  is_open boolean not null default true,
  message text not null default 'La evaluación está cerrada. Ya no se admiten respuestas.',
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);
insert into public.form_settings (id, is_open, message)
values (1, true, 'La evaluación está cerrada. Ya no se admiten respuestas.')
on conflict (id) do nothing;
alter table public.form_settings enable row level security;
revoke all on public.form_settings from anon, authenticated, public;
grant select, insert, update, delete on public.form_settings to service_role;

-- Defensa adicional a nivel SQL: las RPC no pueden guardar respuestas ni finalizar si el formulario está cerrado.
create or replace function public.submit_section_secure(p_token_hash text, p_section_id smallint, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare v_participant public.participants%rowtype; v_expected integer; v_item jsonb; v_qid smallint; v_oid text; v_correct boolean; v_is_open boolean;
begin
  select is_open into v_is_open from public.form_settings where id=1 for share;
  if coalesce(v_is_open,true)=false then raise exception 'FORM_CLOSED'; end if;
  select p.* into v_participant from public.participant_sessions s join public.participants p on p.id=s.participant_id
   where s.token_hash=p_token_hash and s.revoked_at is null and s.expires_at > now() for update of p;
  if not found then raise exception 'SESSION_INVALID'; end if;
  if v_participant.status <> 'in_progress' then raise exception 'EVALUATION_CLOSED'; end if;
  if not exists(select 1 from public.section_unlocks where participant_id=v_participant.id and section_id=p_section_id) then raise exception 'SECTION_NOT_UNLOCKED'; end if;
  if exists(select 1 from public.section_submissions where participant_id=v_participant.id and section_id=p_section_id) then return jsonb_build_object('ok', true, 'already_submitted', true); end if;
  if p_section_id > 1 and not exists(select 1 from public.section_submissions where participant_id=v_participant.id and section_id=p_section_id-1) then raise exception 'SECTION_OUT_OF_ORDER'; end if;
  select count(*) into v_expected from public.questions where section_id=p_section_id;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> v_expected or v_expected <> 2 then raise exception 'ANSWERS_INCOMPLETE'; end if;
  for v_item in select value from jsonb_array_elements(p_answers) loop
    v_qid := (v_item->>'question_id')::smallint; v_oid := v_item->>'option_id';
    if not exists(select 1 from public.questions q join public.options o on o.question_id=q.id and o.id=v_oid where q.id=v_qid and q.section_id=p_section_id) then raise exception 'INVALID_OPTION'; end if;
    select (k.correct_option_id=v_oid) into v_correct from public.answer_key_private k where k.question_id=v_qid;
    if v_correct is null then raise exception 'ANSWER_KEY_MISSING'; end if;
    insert into public.answers(participant_id, section_id, question_id, selected_option_id, option_order_snapshot, is_correct)
    values (v_participant.id, p_section_id, v_qid, v_oid, coalesce(v_item->'option_order','[]'::jsonb), v_correct);
  end loop;
  if (select count(*) from public.answers where participant_id=v_participant.id and section_id=p_section_id) <> v_expected then raise exception 'ANSWERS_INCOMPLETE'; end if;
  insert into public.section_submissions(participant_id, section_id) values (v_participant.id, p_section_id);
  return jsonb_build_object('ok', true, 'already_submitted', false);
end; $$;
revoke all on function public.submit_section_secure(text, smallint, jsonb) from public, anon, authenticated;
grant execute on function public.submit_section_secure(text, smallint, jsonb) to service_role;

create or replace function public.finalize_evaluation_secure(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare v_participant public.participants%rowtype; v_correct smallint; v_total integer; v_is_open boolean;
begin
  select is_open into v_is_open from public.form_settings where id=1 for share;
  if coalesce(v_is_open,true)=false then raise exception 'FORM_CLOSED'; end if;
  select p.* into v_participant from public.participant_sessions s join public.participants p on p.id=s.participant_id
   where s.token_hash=p_token_hash and s.revoked_at is null and s.expires_at > now() for update of p;
  if not found then raise exception 'SESSION_INVALID'; end if;
  if exists(select 1 from public.evaluation_results where participant_id=v_participant.id) then
    return (select jsonb_build_object('ok',true,'score',score,'correct_count',correct_count,'incorrect_count',incorrect_count,'finalized_at',finalized_at) from public.evaluation_results where participant_id=v_participant.id);
  end if;
  select count(*) into v_total from public.answers where participant_id=v_participant.id;
  if v_total <> 10 or (select count(*) from public.section_submissions where participant_id=v_participant.id) <> 5 then raise exception 'EVALUATION_INCOMPLETE'; end if;
  select count(*) into v_correct from public.answers where participant_id=v_participant.id and is_correct;
  insert into public.evaluation_results(participant_id, correct_count, incorrect_count, score) values (v_participant.id, v_correct, 10-v_correct, v_correct::numeric);
  update public.participants set status='submitted', submitted_at=now() where id=v_participant.id;
  insert into public.audit_logs(participant_id,event_type,metadata) values(v_participant.id,'evaluation_finalized',jsonb_build_object('score',v_correct));
  return jsonb_build_object('ok',true,'score',v_correct,'correct_count',v_correct,'incorrect_count',10-v_correct,'finalized_at',now());
end; $$;
revoke all on function public.finalize_evaluation_secure(text) from public, anon, authenticated;
grant execute on function public.finalize_evaluation_secure(text) to service_role;
