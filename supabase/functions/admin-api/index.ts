import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const out = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
async function guard(req: Request) {
  const h = req.headers.get("Authorization") ?? ""; const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return { response: out({ error: "UNAUTHORIZED", message: "Inicia sesión para continuar." }, 401) };
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return { response: out({ error: "UNAUTHORIZED", message: "La sesión no es válida o expiró." }, 401) };
  const { data: profile, error: pe } = await db.from("admin_profiles").select("role").eq("user_id", data.user.id).maybeSingle();
  if (pe || !profile || !["admin", "analyst", "viewer"].includes(profile.role)) return { response: out({ error: "FORBIDDEN", message: "Esta cuenta no tiene permisos administrativos." }, 403) };
  return { user: data.user, role: profile.role };
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const auth = await guard(req); if ("response" in auth) return auth.response;
    const body = await req.json().catch(() => ({})); const action = String(body.action ?? "overview");
    if (action === "overview") {
      const [t,f,p,s,sec,unlocks,submissions] = await Promise.all([
        db.from("participants").select("id",{count:"exact",head:true}), db.from("participants").select("id",{count:"exact",head:true}).eq("status","submitted"), db.from("participants").select("id",{count:"exact",head:true}).eq("status","in_progress"), db.from("evaluation_results").select("score"), db.from("sections").select("id,title,presenter,display_order,is_enabled").order("display_order"), db.from("section_unlocks").select("section_id,participant_id"), db.from("section_submissions").select("section_id,participant_id,status")
      ]); const err=t.error??f.error??p.error??s.error??sec.error??unlocks.error??submissions.error; if(err) throw err;
      const scores=(s.data??[]).map((x:any)=>Number(x.score)).filter(Number.isFinite); const avg=scores.length?scores.reduce((a:number,b:number)=>a+b,0)/scores.length:0;
      const sectionMetrics=(sec.data??[]).map((section:any)=>{const unlocked=(unlocks.data??[]).filter((x:any)=>x.section_id===section.id);const submitted=(submissions.data??[]).filter((x:any)=>x.section_id===section.id&&x.status==="completed");const unlockedIds=new Set(unlocked.map((x:any)=>x.participant_id));const submittedCount=new Set(submitted.map((x:any)=>x.participant_id).filter((id:string)=>unlockedIds.has(id))).size;return {...section,unlocked_count:unlockedIds.size,submitted_count:submittedCount,pending_count:Math.max(0,unlockedIds.size-submittedCount),completion_rate:unlockedIds.size?Math.round(submittedCount/unlockedIds.size*100):0};});
      return out({ role:auth.role,user:{email:auth.user.email},stats:{total:t.count??0,finished:f.count??0,pending:p.count??0,graded:scores.length,average:Number(avg.toFixed(2))},sections:sectionMetrics });
    }
    if (action === "participants" || action === "export") {
      const search=String(body.search??"").trim().slice(0,80).replace(/[,%()]/g, ""); const status=String(body.status??"all"); const page=Math.max(1,Number(body.page)||1); const pageSize=Math.max(5,Math.min(100,Number(body.pageSize)||25));
      let q=db.from("participants").select("id,carnet,full_name,status,created_at,submitted_at,evaluation_results(score,correct_count,incorrect_count,finalized_at)",{count:"exact"}).order("created_at",{ascending:false});
      if(action!=="export") q=q.range((page-1)*pageSize,page*pageSize-1);
      if(search) q=q.or(`carnet.ilike.%${search}%,full_name.ilike.%${search}%`);
      if(["in_progress","submitted","revoked"].includes(status)) q=q.eq("status",status);
      const {data,error,count}=await q; if(error) throw error; return out({participants:data??[],total:count??0,page,pageSize});
    }
    if (action === "participant-detail") {
      const id=String(body.participant_id??""); if(!/^[0-9a-f-]{36}$/i.test(id)) return out({error:"INVALID_ID"},400);
      const [pr,ar,sr,ur,lr,kr,orows]=await Promise.all([
        db.from("participants").select("id,carnet,full_name,status,created_at,submitted_at,evaluation_results(score,correct_count,incorrect_count,finalized_at)").eq("id",id).maybeSingle(),
        db.from("answers").select("question_id,section_id,selected_option_id,is_correct,answered_at,questions!inner(question_text,sections!inner(title))").eq("participant_id",id).order("question_id"),
        db.from("section_submissions").select("section_id,status,submitted_at,sections(title,presenter,display_order)").eq("participant_id",id).order("section_id"),
        db.from("section_unlocks").select("section_id,unlocked_at,sections(title)").eq("participant_id",id).order("section_id"),
        db.from("audit_logs").select("event_type,section_id,created_at,metadata").eq("participant_id",id).order("created_at",{ascending:false}).limit(50),
        db.from("answer_key_private").select("question_id,correct_option_id"),db.from("options").select("id,question_id,option_text")
      ]); const err=pr.error??ar.error??sr.error??ur.error??lr.error??kr.error??orows.error; if(err) throw err; if(!pr.data) return out({error:"NOT_FOUND"},404);
      const keys=new Map((kr.data??[]).map((x:any)=>[x.question_id,x.correct_option_id])); const texts=new Map((orows.data??[]).map((x:any)=>[`${x.question_id}:${x.id}`,x.option_text]));
      const answers=(ar.data??[]).map((a:any)=>({question_id:a.question_id,section_id:a.section_id,section_title:a.questions?.sections?.title??"",question_text:a.questions?.question_text??"",selected_option_id:a.selected_option_id,selected_option_text:texts.get(`${a.question_id}:${a.selected_option_id}`)??"",correct_option_text:texts.get(`${a.question_id}:${keys.get(a.question_id)}`)??"",is_correct:a.is_correct,answered_at:a.answered_at}));
      return out({participant:pr.data,answers,submissions:sr.data??[],unlocks:ur.data??[],audit_logs:lr.data??[]});
    }
    if(action==="delete-participant"){
   if(auth.role!=="admin") return out({error:"FORBIDDEN",message:"Solo un administrador puede eliminar registros."},403);
   const id=String(body.participant_id??"");
   if(!/^[0-9a-f-]{36}$/i.test(id)) return out({error:"INVALID_ID",message:"El identificador no es válido."},400);
   const {data,error}=await db.rpc("admin_delete_participant",{p_participant_id:id,p_actor_user_id:auth.user.id});
   if(error){console.error("admin delete error",error); if(String(error.message||"").includes("NOT_FOUND")) return out({error:"NOT_FOUND",message:"El participante ya no existe."},404); if(String(error.message||"").includes("FORBIDDEN")) return out({error:"FORBIDDEN",message:"No tienes permisos para eliminar registros."},403); throw error;}
   return out({ok:true,deleted_participant_id:id});
  }
  return out({error:"UNKNOWN_ACTION"},400);
  } catch(e) { console.error("admin-api error",e); return out({error:"INTERNAL_ERROR",message:"No se pudo completar la consulta administrativa."},500); }
});
