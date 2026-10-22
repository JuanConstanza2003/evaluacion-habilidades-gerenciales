-- Backend security layer and canonical question seed. Apply after 001_initial_schema.sql.
create table public.participant_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz
);
create index participant_sessions_participant_idx on public.participant_sessions(participant_id);

create table public.section_access_codes (
  section_id smallint primary key references public.sections(id) on delete cascade,
  code_hash text not null,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.access_code_attempts (
  id bigint generated always as identity primary key,
  participant_id uuid references public.participants(id) on delete cascade,
  section_id smallint not null references public.sections(id),
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);
create index access_code_attempts_rate_idx on public.access_code_attempts(participant_id, section_id, attempted_at desc);
create table public.section_unlocks (
  participant_id uuid not null references public.participants(id) on delete cascade,
  section_id smallint not null references public.sections(id),
  unlocked_at timestamptz not null default now(),
  primary key (participant_id, section_id)
);

alter table public.participant_sessions enable row level security;
alter table public.section_access_codes enable row level security;
alter table public.access_code_attempts enable row level security;
alter table public.section_unlocks enable row level security;
-- No direct client policies. All student operations are performed through the Edge Function.

insert into public.questions(id, section_id, question_text, display_order) values (1, 1, 'De acuerdo con la definición expuesta, ¿cuál es el elemento central que distingue a las habilidades gerenciales?', 1) on conflict (id) do update set section_id=excluded.section_id, question_text=excluded.question_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('1A', 1, 'La capacidad de ejecutar tareas técnicas operativas sin ayuda.', 1) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('1B', 1, 'La integración de conocimientos, destrezas y actitudes para liderar, coordinar y tomar decisiones.', 2) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('1C', 1, 'La memorización exacta de los manuales de procedimientos.', 3) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('1D', 1, 'El número de años de experiencia dentro de la empresa.', 4) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.questions(id, section_id, question_text, display_order) values (2, 1, 'Según lo explicado sobre las diferencias entre habilidades, ¿en qué se enfoca principalmente una habilidad gerencial a diferencia de una técnica?', 2) on conflict (id) do update set section_id=excluded.section_id, question_text=excluded.question_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('2A', 2, 'En la dirección, coordinación y gestión del talento humano.', 1) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('2B', 2, 'En el manejo exclusivo de maquinaria y software especializado.', 2) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('2C', 2, 'En realizar el trabajo operativo en el menor tiempo posible.', 3) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('2D', 2, 'No existe ninguna diferencia, ambas se aplican de la misma manera.', 4) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.questions(id, section_id, question_text, display_order) values (3, 2, 'Según el modelo de roles gerenciales de Henry Mintzberg, ¿en qué tres categorías principales se agrupan los roles directivos?', 1) on conflict (id) do update set section_id=excluded.section_id, question_text=excluded.question_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('3A', 3, 'Operativos, Administrativos y Financieros.', 1) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('3B', 3, 'Interpersonales, Informativos y Decisorios.', 2) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('3C', 3, 'Individuales, Grupales y Masivos.', 3) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('3D', 3, 'Estratégicos, Tácticos y Logísticos-', 4) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.questions(id, section_id, question_text, display_order) values (4, 2, 'De acuerdo con el modelo de competencias directivas de Whetten y Cameron, ¿cuál se considera la base fundamental para el desarrollo gerencial?', 2) on conflict (id) do update set section_id=excluded.section_id, question_text=excluded.question_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('4A', 4, 'El autoconocimiento y la gestión eficiente del estrés personal.', 1) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('4B', 4, 'La aplicación estricta de reglamentos sin flexibilidad.', 2) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('4C', 4, 'La automatización total de las actividades diarias.', 3) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('4D', 4, 'La eliminación de reuniones con el equipo.', 4) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.questions(id, section_id, question_text, display_order) values (5, 3, 'Con base en la Teoría del Liderazgo Situacional de Paul Hersey y Ken Blanchard, ¿a qué debe ajustarse principalmente el estilo del líder?', 1) on conflict (id) do update set section_id=excluded.section_id, question_text=excluded.question_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('5A', 5, 'Al presupuesto total asignado al departamento.', 1) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('5B', 5, 'Al nivel de madurez o desarrollo del colaborador frente a la tarea.', 2) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('5C', 5, 'A la antigüedad de la empresa en el mercado.', 3) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('5D', 5, 'Al horario de la jornada laboral.', 4) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.questions(id, section_id, question_text, display_order) values (6, 3, 'Dentro de la Matriz de Habilidades Directivas de Berta Madrigal Torres, ¿qué aspecto se destaca como clave para la efectividad del líder?', 2) on conflict (id) do update set section_id=excluded.section_id, question_text=excluded.question_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('6A', 6, 'La combinación equilibrada de habilidades personales, interpersonales y directivas.', 1) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('6B', 6, 'La imposición de autoridad sin escuchar sugerencias.', 2) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('6C', 6, 'Delegar la toma de decisiones únicamente al personal operativo.', 3) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('6D', 6, 'Evitar evaluar el desempeño individual del equipo.', 4) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.questions(id, section_id, question_text, display_order) values (7, 4, 'De acuerdo con lo mencionado por Ayumi, ¿cuál es el valor principal de las habilidades gerenciales en el sector de Tecnología y Desarrollo de Software?', 1) on conflict (id) do update set section_id=excluded.section_id, question_text=excluded.question_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('7A', 7, 'Reemplazar por completo el trabajo de los programadores.', 1) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('7B', 7, 'Coordinar equipos multidisciplinarios y traducir requerimientos técnicos en metas claras.', 2) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('7C', 7, 'Eliminar la necesidad de hacer planificación estratégica.', 3) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('7D', 7, 'Evitar el uso de metodologías de trabajo en equipo.', 4) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.questions(id, section_id, question_text, display_order) values (8, 4, 'Según el análisis sectorial que presentó Ayumi, ¿por qué son indispensables estas competencias en áreas como Salud y Banca?', 2) on conflict (id) do update set section_id=excluded.section_id, question_text=excluded.question_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('8A', 8, 'Porque permiten la toma de decisiones críticas bajo presión y la gestión de crisis.', 1) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('8B', 8, 'Porque reducen la necesidad de comunicarse entre departamentos.', 2) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('8C', 8, 'Porque automatizan todos los procesos financieros y médicos.', 3) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('8D', 8, 'Porque evitan el cumplimiento de normativas legales.', 4) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.questions(id, section_id, question_text, display_order) values (9, 5, 'Según la visión actual de las organizaciones expuesta por Melissa, ¿cómo se catalogan hoy en día las habilidades gerenciales y de liderazgo?', 1) on conflict (id) do update set section_id=excluded.section_id, question_text=excluded.question_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('9A', 9, 'Como un aspecto secundario ante el uso de tecnología y maquinaria.', 1) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('9B', 9, 'Como un factor imprescindible para la adaptabilidad, inteligencia emocional y gestión del cambio.', 2) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('9C', 9, 'Como competencias que solo se utilizan al momento del reclutamiento.', 3) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('9D', 9, 'Como requisitos opcionales solo para empresas multinacionales.', 4) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.questions(id, section_id, question_text, display_order) values (10, 5, 'Con base en la explicación de Melissa sobre el desarrollo de estas habilidades, ¿cuál es la vía más efectiva para adquirirlas?', 2) on conflict (id) do update set section_id=excluded.section_id, question_text=excluded.question_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('10A', 10, 'Memorizar teorías de libros sin llevarlas a la práctica.', 1) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('10B', 10, 'A través de la práctica reflexiva, el aprendizaje experiencial y la retroalimentación constante.', 2) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('10C', 10, 'Esperar a que la empresa imponga capacitaciones obligatorias.', 3) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;
insert into public.options(id, question_id, option_text, display_order) values ('10D', 10, 'Evitar tomar responsabilidades en proyectos grupales.', 4) on conflict (id) do update set question_id=excluded.question_id, option_text=excluded.option_text, display_order=excluded.display_order;

-- Transactional section submission. The caller must pass a valid session token hash.
create or replace function public.submit_section_secure(p_token_hash text, p_section_id smallint, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare v_participant public.participants%rowtype; v_expected integer; v_inserted integer; v_item jsonb; v_qid smallint; v_oid text; v_correct boolean;
begin
  select p.* into v_participant from public.participant_sessions s join public.participants p on p.id=s.participant_id
   where s.token_hash=p_token_hash and s.revoked_at is null and s.expires_at > now() for update of p;
  if not found then raise exception 'SESSION_INVALID'; end if;
  if v_participant.status <> 'in_progress' then raise exception 'EVALUATION_CLOSED'; end if;
  if not exists(select 1 from public.section_unlocks where participant_id=v_participant.id and section_id=p_section_id) then raise exception 'SECTION_NOT_UNLOCKED'; end if;
  if exists(select 1 from public.section_submissions where participant_id=v_participant.id and section_id=p_section_id) then
    return jsonb_build_object('ok', true, 'already_submitted', true);
  end if;
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
declare v_participant public.participants%rowtype; v_correct smallint; v_total integer;
begin
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
