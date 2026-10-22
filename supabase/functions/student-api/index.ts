import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function normalizeCarnet(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function session(token: string) {
  if (!token || token.length < 32) return null;
  const tokenHash = await sha256(token);
  const { data, error } = await supabase.from("participant_sessions")
    .select("participant_id, expires_at, revoked_at, participants!inner(id, full_name, carnet, status)")
    .eq("token_hash", tokenHash).maybeSingle();
  if (error || !data || data.revoked_at || new Date(data.expires_at) <= new Date()) return null;
  return { tokenHash, participantId: data.participant_id, participant: data.participants as { id: string; full_name: string; carnet: string; status: string } };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "register") {
      const fullName = String(body.full_name ?? "").trim().replace(/\s+/g, " ");
      const carnet = normalizeCarnet(body.carnet);
      if (fullName.length < 3 || fullName.length > 120 || !/^\d{10,}$/.test(carnet) || carnet.length > 40) return response({ error: "INVALID_REGISTRATION", message: "El nombre debe tener entre 3 y 120 caracteres y el carné debe contener al menos 10 dígitos numéricos, sin letras ni símbolos (máximo 40 dígitos)." }, 400);
      const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
      const token = [...tokenBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      const tokenHash = await sha256(token);
      const { data: participant, error: participantError } = await supabase.from("participants")
        .insert({ full_name: fullName, carnet }).select("id,full_name,carnet,status,created_at").single();
      if (participantError) {
        if (participantError.code === "23505") return response({ error: "CARNET_EXISTS", message: "Este carné ya tiene una evaluación registrada. Solicita asistencia para recuperar el acceso." }, 409);
        throw participantError;
      }
      const { error: sessionError } = await supabase.from("participant_sessions").insert({ participant_id: participant.id, token_hash: tokenHash });
      if (sessionError) throw sessionError;
      await supabase.from("audit_logs").insert({ participant_id: participant.id, event_type: "participant_registered" });
      return response({ token, participant: { full_name: participant.full_name, carnet: participant.carnet }, progress: { completed: [], finalized: false } }, 201);
    }

    const auth = await session(String(body.token ?? ""));
    if (!auth) return response({ error: "SESSION_INVALID", message: "La sesión no es válida o ha expirado. Solicita asistencia para recuperar el acceso." }, 401);
    await supabase.from("participant_sessions").update({ last_seen_at: new Date().toISOString() }).eq("token_hash", auth.tokenHash);
    if (auth.participant.status === "revoked") return response({ error: "ACCESS_REVOKED" }, 403);

    if (action === "progress") {
      const [{ data: sectionRows, error: sectionError }, { data: submissions, error: submissionsError }, { data: answers, error: answersError }, { data: result }] = await Promise.all([
        supabase.from("sections").select("id,title,presenter,display_order,is_enabled,opens_at,closes_at").order("display_order"),
        supabase.from("section_submissions").select("section_id,submitted_at").eq("participant_id", auth.participantId),
        supabase.from("answers").select("question_id,selected_option_id,section_id,option_order_snapshot").eq("participant_id", auth.participantId),
        supabase.from("evaluation_results").select("correct_count,incorrect_count,score,finalized_at").eq("participant_id", auth.participantId).maybeSingle(),
      ]);
      if (sectionError || submissionsError || answersError) throw sectionError ?? submissionsError ?? answersError;
      const completed = (submissions ?? []).map((x) => x.section_id);
      const publicSections = [];
      for (const section of sectionRows ?? []) {
        const { data: qs, error: qError } = await supabase.from("questions").select("id,question_text,display_order,options(id,option_text,display_order)").eq("section_id", section.id).order("display_order");
        if (qError) throw qError;
        publicSections.push({ ...section, completed: completed.includes(section.id), questions: (qs ?? []).map((q: any) => ({ ...q, options: (q.options ?? []).sort((a: any,b: any) => a.display_order-b.display_order) })) });
      }
      let feedback = null;
      if (result) {
        const { data: allAnswers, error: feedbackError } = await supabase.from("answers").select("question_id,selected_option_id,is_correct,section_id,option_order_snapshot,questions!inner(question_text,display_order,options(id,option_text,display_order))").eq("participant_id", auth.participantId).order("question_id");
        if (feedbackError) throw feedbackError;
        const { data: keys, error: keyError } = await supabase.from("answer_key_private").select("question_id,correct_option_id");
        if (keyError) throw keyError;
        const keyMap = new Map((keys ?? []).map((k) => [k.question_id, k.correct_option_id]));
        feedback = (allAnswers ?? []).map((a: any) => {
          const options = (a.questions.options ?? []).sort((x: any,y: any) => x.display_order-y.display_order);
          const correctId = keyMap.get(a.question_id);
          return { question_id: a.question_id, section_id: a.section_id, question_text: a.questions.question_text, selected_option_id: a.selected_option_id,
            selected_option_text: options.find((o: any) => o.id === a.selected_option_id)?.option_text ?? "",
            correct_option_id: correctId, correct_option_text: options.find((o: any) => o.id === correctId)?.option_text ?? "", is_correct: a.is_correct, option_order_snapshot: a.option_order_snapshot };
        });
      }
      return response({ participant: { full_name: auth.participant.full_name, carnet: auth.participant.carnet, status: auth.participant.status }, sections: publicSections,
        completed, answers: answers ?? [], result: result ?? null, feedback });
    }

    if (action === "unlock-section") {
      const sectionId = Number(body.section_id);
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!Number.isInteger(sectionId) || sectionId < 1 || sectionId > 5 || !code) return response({ error: "INVALID_CODE", message: "Escribe el código de acceso." }, 400);
      const { data: prior } = await supabase.from("section_submissions").select("section_id").eq("participant_id", auth.participantId).eq("section_id", sectionId).maybeSingle();
      if (prior) return response({ error: "SECTION_ALREADY_SUBMITTED", message: "Esta sección ya fue enviada y está cerrada." }, 409);
      if (sectionId > 1) {
        const { data: previous } = await supabase.from("section_submissions").select("section_id").eq("participant_id", auth.participantId).eq("section_id", sectionId - 1).maybeSingle();
        if (!previous) return response({ error: "SECTION_OUT_OF_ORDER", message: "Completa primero la sección anterior." }, 409);
      }
      const { data: recentAttempts } = await supabase.from("access_code_attempts").select("id").eq("participant_id", auth.participantId).eq("section_id", sectionId).eq("succeeded", false).gte("attempted_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());
      if ((recentAttempts ?? []).length >= 5) return response({ error: "RATE_LIMITED", message: "Has realizado varios intentos. Espera 15 minutos e inténtalo de nuevo." }, 429);
      const codeHash = await sha256(code);
      const { data: configured } = await supabase.from("section_access_codes").select("section_id,code_hash,is_enabled").eq("section_id", sectionId).maybeSingle();
      const good = !!configured?.is_enabled && configured.code_hash === codeHash;
      await supabase.from("access_code_attempts").insert({ participant_id: auth.participantId, section_id: sectionId, succeeded: good });
      if (!good) return response({ error: "INVALID_CODE", message: "El código ingresado no es correcto. Revísalo e inténtalo de nuevo." }, 403);
      const { error: unlockError } = await supabase.from("section_unlocks").upsert({ participant_id: auth.participantId, section_id: sectionId }, { onConflict: "participant_id,section_id" });
      if (unlockError) throw unlockError;
      return response({ ok: true, section_id: sectionId });
    }

    if (action === "submit-section") {
      if (auth.participant.status !== "in_progress") return response({ error: "EVALUATION_CLOSED" }, 409);
      const sectionId = Number(body.section_id);
      const answers = body.answers;
      if (!Number.isInteger(sectionId) || !Array.isArray(answers)) return response({ error: "INVALID_PAYLOAD" }, 400);
      const { data, error } = await supabase.rpc("submit_section_secure", { p_token_hash: auth.tokenHash, p_section_id: sectionId, p_answers: answers });
      if (error) return response({ error: error.message.split(" ")[0], message: "No se pudo guardar la sección. Verifica tus respuestas e inténtalo de nuevo." }, 400);
      await supabase.from("audit_logs").insert({ participant_id: auth.participantId, event_type: "section_submitted", section_id: sectionId });
      return response(data);
    }

    if (action === "finalize") {
      const { data, error } = await supabase.rpc("finalize_evaluation_secure", { p_token_hash: auth.tokenHash });
      if (error) return response({ error: error.message.split(" ")[0], message: "Completa todas las secciones antes de finalizar." }, 409);
      return response(data);
    }

    if (action === "logout") {
      await supabase.from("participant_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", auth.tokenHash);
      return response({ ok: true });
    }
    return response({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("student-api error", error);
    return response({ error: "INTERNAL_ERROR", message: "Ocurrió un error inesperado. Inténtalo de nuevo." }, 500);
  }
});
