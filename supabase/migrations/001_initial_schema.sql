-- Evaluación Interactiva de Habilidades Gerenciales
-- Esquema inicial. Revisar y probar en un proyecto Supabase de desarrollo antes de producción.
-- La clave correcta se mantiene en una tabla privada no accesible al rol anon/authenticated.

create extension if not exists pgcrypto;

create type public.participant_status as enum ('in_progress', 'submitted', 'revoked');
create type public.section_status as enum ('in_progress', 'completed');

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  carnet text not null,
  full_name text not null,
  status public.participant_status not null default 'in_progress',
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  constraint participants_carnet_unique unique (carnet),
  constraint participants_carnet_nonempty check (length(trim(carnet)) between 1 and 40),
  constraint participants_name_nonempty check (length(trim(full_name)) between 1 and 120)
);

create table public.sections (
  id smallint primary key check (id between 1 and 5),
  title text not null,
  presenter text not null,
  display_order smallint not null unique check (display_order between 1 and 5),
  is_enabled boolean not null default true,
  opens_at timestamptz,
  closes_at timestamptz
);

create table public.questions (
  id smallint primary key check (id between 1 and 10),
  section_id smallint not null references public.sections(id),
  question_text text not null,
  display_order smallint not null,
  unique (section_id, display_order)
);

-- Public option text is separated from the answer key.
create table public.options (
  id text primary key,
  question_id smallint not null references public.questions(id),
  option_text text not null,
  display_order smallint not null,
  unique (question_id, display_order),
  unique (question_id, id)
);

create table public.answer_key_private (
  question_id smallint primary key references public.questions(id),
  correct_option_id text not null,
  constraint answer_key_option_fk
    foreign key (question_id, correct_option_id)
    references public.options(question_id, id)
);

create table public.section_submissions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  section_id smallint not null references public.sections(id),
  status public.section_status not null default 'completed',
  submitted_at timestamptz not null default now(),
  unique (participant_id, section_id)
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  section_id smallint not null references public.sections(id),
  question_id smallint not null references public.questions(id),
  selected_option_id text not null,
  option_order_snapshot jsonb not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (participant_id, question_id),
  foreign key (question_id, selected_option_id)
    references public.options(question_id, id)
);

create table public.evaluation_results (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  correct_count smallint not null check (correct_count between 0 and 10),
  incorrect_count smallint not null check (incorrect_count between 0 and 10),
  score numeric(4,2) not null check (score between 0 and 10),
  finalized_at timestamptz not null default now(),
  constraint result_counts_sum check (correct_count + incorrect_count = 10)
);

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'analyst', 'viewer')),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  participant_id uuid references public.participants(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  section_id smallint references public.sections(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index answers_section_idx on public.answers(section_id);
create index answers_question_idx on public.answers(question_id);
create index participants_created_idx on public.participants(created_at);
create index audit_logs_created_idx on public.audit_logs(created_at);

-- Seed sections
insert into public.sections (id, title, presenter, display_order) values
(1, 'Fundamentos de las Habilidades Gerenciales', 'Madeline', 1),
(2, 'Modelos Teóricos y Exponentes (Parte I)', 'Angy', 2),
(3, 'Modelos Teóricos y Exponentes (Parte II)', 'Fernando', 3),
(4, 'Aplicación en sectores profesionales', 'Ayumi', 4),
(5, 'Importancia, Desarrollo y Aplicación', 'Melissa', 5);

-- IMPORTANT: Insert the 10 questions/options using the reviewed canonical content.
-- The app's initial question catalogue is in assets/js/questions.js.
-- A production migration should insert that data and the answer key in this private table.

-- Enable RLS on every table.
alter table public.participants enable row level security;
alter table public.sections enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.answer_key_private enable row level security;
alter table public.section_submissions enable row level security;
alter table public.answers enable row level security;
alter table public.evaluation_results enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.audit_logs enable row level security;

-- No direct anon/authenticated policies are intentionally granted here.
-- Use Edge Functions with server-side credentials for student operations.
-- Add explicit admin policies only after defining and testing the role model.

-- Direct browser access is disabled; the Edge Function mediates student operations.
revoke all on public.participants, public.sections, public.questions, public.options, public.answer_key_private, public.section_submissions, public.answers, public.evaluation_results, public.admin_profiles, public.audit_logs from anon, authenticated;
