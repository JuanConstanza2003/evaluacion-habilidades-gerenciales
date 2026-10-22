(() => {
  "use strict";
  const TOKEN_KEY = "hg_student_session_v1";
  const DRAFT_KEY = "hg_section_draft_v1";
  const config = window.SUPABASE_CONFIG;
  const notify = {
    warning: (m) => window.alertify ? alertify.warning(m) : window.alert(m),
    error: (m) => window.alertify ? alertify.error(m) : window.alert(m),
    success: (m) => window.alertify ? alertify.success(m) : window.alert(m),
    message: (m) => window.alertify ? alertify.message(m) : window.alert(m)
  };
  if (window.alertify) {
    alertify.defaults.notifier.position = "top-right";
    alertify.defaults.notifier.delay = 4.5;
    alertify.defaults.notifier.closeButton = true;
    alertify.defaults.transition = "fade";
  }
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
  const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token);
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);
  async function api(action, payload = {}) {
    let response;
    try {
      response = await fetch(`${config.url}/functions/v1/student-api`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8", "apikey": config.publishableKey },
        body: JSON.stringify({ action, token: getToken(), ...payload })
      });
    } catch (_) {
      throw { error: "NETWORK_ERROR", message: "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo." };
    }
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw { status: response.status, ...data, message: data.message || "No se pudo completar la operación." };
    return data;
  }
  function showFormError(message) {
    const el = document.querySelector("#form-error");
    if (el) el.textContent = message || "";
  }
  function shuffleOptions(options, savedOrder) {
    if (Array.isArray(savedOrder) && savedOrder.length === options.length) {
      const ordered = savedOrder.map(id => options.find(o => o.id === id)).filter(Boolean);
      if (ordered.length === options.length) return ordered;
    }
    const arr = [...options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function getDraft() {
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}"); } catch (_) { return {}; }
  }
  function saveDraft(draft) { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }
  function clearDraft() { sessionStorage.removeItem(DRAFT_KEY); }
  function routeError(error, formMode = false) {
    const message = error?.message || "Ocurrió un error inesperado. Inténtalo de nuevo.";
    if (error?.error === "SESSION_INVALID" || error?.error === "ACCESS_REVOKED") {
      clearToken();
      clearDraft();
      if (formMode) showFormError("La sesión anterior ya no es válida. Ingresa tus datos para comenzar.");
      else location.href = "index.html";
      return;
    }
    if (formMode) showFormError(message); else notify.error(message);
  }

  // La página inicial siempre muestra el registro. Una sesión incompleta puede retomarse
  // en el mismo dispositivo tras validar nombre/carné; una sesión finalizada nunca reabre la nota.
  const regForm = document.querySelector("#registration-form");
  if (regForm) {
    const nameInput = document.querySelector("#full-name");
    const carnetInput = document.querySelector("#carnet");
    let existingInProgress = null;
    if (getToken()) {
      api("progress").then(state => {
        if (state.result || state.participant?.status === "submitted") {
          clearToken(); clearDraft(); existingInProgress = null;
          showFormError("Esta evaluación ya fue finalizada. Los resultados se muestran al terminar y quedan disponibles únicamente para el equipo administrativo.");
          return;
        }
        if (state.participant && state.participant.status === "in_progress") {
          existingInProgress = { carnet: String(state.participant.carnet || "").trim().toUpperCase().replace(/\s+/g, ""), fullName: String(state.participant.full_name || "").trim().replace(/\s+/g, " ").toLowerCase() };
          nameInput.value = state.participant.full_name || "";
          carnetInput.value = state.participant.carnet || "";
          const submit = regForm.querySelector('button[type="submit"]');
          if (submit) submit.innerHTML = 'Continuar evaluación <span aria-hidden="true">→</span>';
          showFormError("Encontramos una evaluación en progreso en este dispositivo. Confirma tus datos para continuar.");
        }
      }).catch(() => { clearToken(); clearDraft(); });
    }
    regForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = regForm.querySelector('button[type="submit"]');
      const fullName = nameInput.value.trim();
      const carnet = carnetInput.value.trim();
      showFormError("");
      if (!fullName || !carnet) { showFormError("Escribe tu nombre completo y carné."); return; }
      submit.disabled = true;
      try {
        if (getToken()) {
          try {
            const state = await api("progress");
            const sameCarnet = String(carnet).trim().toUpperCase().replace(/\s+/g, "") === String(state.participant?.carnet || "").trim().toUpperCase().replace(/\s+/g, "");
            const sameName = fullName.replace(/\s+/g, " ").toLowerCase() === String(state.participant?.full_name || "").trim().replace(/\s+/g, " ").toLowerCase();
            if (state.result || state.participant?.status === "submitted") {
              clearToken(); clearDraft();
              showFormError("Esta evaluación ya fue finalizada. No es posible volver a consultar la nota desde el enlace público.");
              return;
            }
            if (state.participant?.status === "in_progress" && sameCarnet && sameName) {
              location.href = "progreso.html"; return;
            }
          } catch (_) { /* Si la sesión dejó de ser válida, se intenta registrar normalmente. */ }
          clearToken();
        }
        const result = await api("register", { full_name: fullName, carnet });
        saveToken(result.token);
        clearDraft();
        location.href = "progreso.html";
      } catch (error) { routeError(error, true); }
      finally { submit.disabled = false; }
    });
  }

  // Progreso y validación real del código en el servidor.
  const sectionsList = document.querySelector("#sections-list");
  if (sectionsList) {
    (async () => {
      if (!getToken()) { location.href = "index.html"; return; }
      let state;
      try { state = await api("progress"); } catch (error) { routeError(error); return; }
      if (state.result || state.participant?.status === "submitted") { clearToken(); clearDraft(); location.href = "index.html"; return; }
      const completed = state.completed || [];
      const sections = state.sections || [];
      const nextSection = sections.find(s => !completed.includes(s.id));
      sectionsList.innerHTML = sections.map(section => {
        const complete = completed.includes(section.id);
        const isNext = !!nextSection && nextSection.id === section.id;
        const available = isNext && section.is_enabled;
        const status = complete ? "Completada" : available ? "Disponible" : "Bloqueada";
        const icon = complete ? "✓" : available ? "↗" : "🔒";
        return `<article class="section-card ${complete ? "is-complete" : ""} ${available ? "is-unlocked" : "is-locked"}">
          <div class="section-number">${section.display_order}</div>
          <div class="section-info"><h2>${escapeHTML(section.title)}</h2><p>${escapeHTML(section.presenter)} · ${(section.questions || []).length} preguntas</p><span class="status">${icon} ${status}</span></div>
          <div class="section-action">${complete ? '<span class="completed-mark">✓</span>' : available ? '<span class="status">Código requerido</span>' : '<span class="lock-mark" aria-label="Bloqueada">🔒</span>'}</div>
          ${available ? `<label class="code-field"><span>Código de acceso de ${escapeHTML(section.presenter)}</span><input data-code="${section.id}" placeholder="Código de acceso" autocomplete="off" maxlength="80"><button class="btn btn-outline btn-small" type="button" data-unlock="${section.id}">Desbloquear</button></label>` : ""}
        </article>`;
      }).join("");
      document.querySelector("#progress-count").textContent = `${completed.length}/5`;
      document.querySelector("#progress-bar").style.width = `${completed.length / 5 * 100}%`;
      const finish = document.querySelector("#finish-btn");
      finish.disabled = completed.length !== 5;
      sectionsList.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-unlock]");
        if (!button) return;
        const id = Number(button.dataset.unlock);
        const input = document.querySelector(`[data-code="${id}"]`);
        const code = input.value.trim();
        if (!code) { notify.warning("Escribe el código de acceso que te proporcionó el expositor."); input.focus(); return; }
        const originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = "Validando…";
        button.setAttribute("aria-busy", "true");
        try {
          await api("unlock-section", { section_id: id, code });
          sessionStorage.setItem("hg_unlocked_section", String(id));
          location.href = `evaluacion.html?section=${id}`;
        } catch (error) {
          routeError(error);
          if (error?.error === "EMPTY_CODE") notify.warning(error.message);
          input.focus();
        } finally {
          button.disabled = false;
          button.textContent = originalLabel;
          button.removeAttribute("aria-busy");
        }
      });
      finish.addEventListener("click", async () => {
        if (completed.length !== 5) return;
        finish.disabled = true;
        try {
          await api("finalize");
          location.href = "resultado.html";
        } catch (error) { routeError(error); finish.disabled = false; }
      });
    })();
  }

  // Una sección se guarda de forma definitiva en el servidor; las respuestas correctas no están en el cliente.
  const answerForm = document.querySelector("#answers-form");
  if (answerForm) {
    (async () => {
      const id = Number(new URLSearchParams(location.search).get("section"));
      if (!getToken() || !Number.isInteger(id) || id < 1 || id > 5 || sessionStorage.getItem("hg_unlocked_section") !== String(id)) { location.href = "progreso.html"; return; }
      let state;
      try { state = await api("progress"); } catch (error) { routeError(error); return; }
      if (state.result || state.participant?.status === "submitted") { clearToken(); clearDraft(); location.href = "index.html"; return; }
      if ((state.completed || []).includes(id)) { location.href = "progreso.html"; return; }
      const section = (state.sections || []).find(s => s.id === id);
      if (!section || !section.questions?.length) { notify.error("No se encontró la sección solicitada."); location.href = "progreso.html"; return; }
      document.querySelector("#section-counter").textContent = `${id}/5`;
      document.querySelector("#section-kicker").textContent = `SECCIÓN ${id}`;
      document.querySelector("#section-title").textContent = section.title;
      document.querySelector("#section-description").textContent = `${section.presenter}`;
      const draft = getDraft();
      draft[id] = draft[id] || { answers: {}, orders: {} };
      const sectionDraft = draft[id];
      const prepared = section.questions.map(q => ({ ...q, orderedOptions: shuffleOptions(q.options || [], sectionDraft.orders[q.id]) }));
      prepared.forEach(q => sectionDraft.orders[q.id] = q.orderedOptions.map(o => o.id));
      saveDraft(draft);
      document.querySelector("#question-list").innerHTML = prepared.map((q, index) => `<fieldset class="question-card"><legend><span class="question-number">Pregunta ${index + 1} de ${prepared.length}</span></legend><h2>${escapeHTML(q.question_text)}</h2><div class="options-list">${q.orderedOptions.map((opt, i) => `<label class="option-row"><input type="radio" name="q${q.id}" value="${escapeHTML(opt.id)}" ${sectionDraft.answers[q.id] === opt.id ? "checked" : ""} required><span class="option-letter">${String.fromCharCode(65+i)}</span><span class="option-text">${escapeHTML(opt.option_text)}</span></label>`).join("")}</div></fieldset>`).join("");
      answerForm.addEventListener("change", event => {
        const input = event.target.closest('input[type="radio"]');
        if (!input) return;
        sectionDraft.answers[input.name.slice(1)] = input.value;
        draft[id] = sectionDraft;
        saveDraft(draft);
      });
      const dialog = document.querySelector("#confirm-dialog");
      answerForm.addEventListener("submit", event => {
        event.preventDefault();
        if (prepared.some(q => !sectionDraft.answers[q.id])) { notify.warning(`Responde las ${prepared.length} preguntas antes de continuar.`); return; }
        dialog.showModal();
      });
      document.querySelector("#cancel-confirm").addEventListener("click", () => dialog.close());
      document.querySelector("#confirm-save").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        const answers = prepared.map(q => ({ question_id: q.id, option_id: sectionDraft.answers[q.id], option_order: sectionDraft.orders[q.id] }));
        try {
          await api("submit-section", { section_id: id, answers });
          clearDraft();
          sessionStorage.removeItem("hg_unlocked_section");
          dialog.close();
          location.href = "progreso.html";
        } catch (error) { routeError(error); }
        finally { button.disabled = false; }
      });
    })();
  }

  // La nota y la retroalimentación se solicitan al servidor únicamente tras finalizar.
  const scoreEl = document.querySelector("#final-score");
  if (scoreEl) {
    (async () => {
      if (!getToken()) { location.href = "index.html"; return; }
      let state;
      try { state = await api("progress"); } catch (error) { routeError(error); return; }
      if (!state.result) { location.href = "progreso.html"; return; }
      const result = state.result;
      const feedback = state.feedback || [];
      const percent = Math.round(Number(result.correct_count) / 10 * 100);
      scoreEl.textContent = `${result.score} / 10`;
      document.querySelector("#score-detail").textContent = `${result.correct_count} correctas · ${result.incorrect_count} incorrectas`;
      document.querySelector("#score-percent").textContent = `${percent} %`;
      document.querySelector("#score-bar").style.width = `${percent}%`;
      document.querySelector("#result-summary").textContent = `¡Gracias por completar la evaluación, ${state.participant.full_name}! Aquí tienes tu resultado y la revisión de tus respuestas.`;
      const title = document.querySelector("#result-title");
      title.innerHTML = result.correct_count >= 9 ? "¡Excelente <span>trabajo!</span>" : result.correct_count >= 7 ? "¡Buen <span>trabajo!</span>" : "Evaluación <span>completada</span>";
      document.querySelector("#feedback-list").innerHTML = feedback.map((q, index) => {
        const order = Array.isArray(q.option_order_snapshot) ? q.option_order_snapshot : [];
        const chosenPosition = order.indexOf(q.selected_option_id);
        const correctPosition = order.indexOf(q.correct_option_id);
        const chosenLetter = chosenPosition >= 0 ? String.fromCharCode(65 + chosenPosition) : "—";
        const correctLetter = correctPosition >= 0 ? String.fromCharCode(65 + correctPosition) : "—";
        return `<article class="feedback-card ${q.is_correct ? "feedback-correct" : "feedback-incorrect"}"><div class="feedback-card-top"><span class="feedback-number">Pregunta ${index + 1}</span><span class="feedback-status">${q.is_correct ? "✓ Correcta" : "✕ Incorrecta"}</span></div><p class="feedback-section-name">${escapeHTML((state.sections.find(s => s.id === q.section_id) || {}).title || "Habilidades Gerenciales")}</p><h3>${escapeHTML(q.question_text)}</h3><div class="feedback-answer ${q.is_correct ? "answer-is-correct" : "answer-is-incorrect"}"><span class="answer-label">Tu respuesta · ${chosenLetter}</span><p>${escapeHTML(q.selected_option_text || "No se registró una respuesta.")}</p></div>${!q.is_correct ? `<div class="feedback-answer answer-correct"><span class="answer-label">Respuesta correcta · ${correctLetter}</span><p>${escapeHTML(q.correct_option_text)}</p></div>` : '<p class="feedback-encouragement">¡Muy bien! Seleccionaste la respuesta correcta.</p>'}</article>`;
      }).join("");
      // The result is a one-time student view; the durable record remains in the admin dashboard.
      clearToken();
      clearDraft();
      sessionStorage.removeItem("hg_unlocked_section");
    })();
  }
})();
