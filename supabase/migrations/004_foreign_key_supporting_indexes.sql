create index if not exists access_code_attempts_section_idx on public.access_code_attempts(section_id);
create index if not exists answer_key_private_option_fk_idx on public.answer_key_private(question_id,correct_option_id);
create index if not exists answers_question_option_fk_idx on public.answers(question_id,selected_option_id);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id);
create index if not exists audit_logs_participant_idx on public.audit_logs(participant_id);
create index if not exists audit_logs_section_idx on public.audit_logs(section_id);
create index if not exists section_submissions_section_idx on public.section_submissions(section_id);
create index if not exists section_unlocks_section_idx on public.section_unlocks(section_id);
