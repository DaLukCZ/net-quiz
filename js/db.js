// Lokální datová vrstva — vše v localStorage, žádný server
window.App = window.App || {};

App.DB = (() => {
  const SRS_KEY     = 'nq_srs_states';
  const RESULTS_KEY = 'nq_quiz_results';

  function _load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
  }
  function _save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  // ── SRS states ───────────────────────────────────────────────

  function loadSRSStates(questionIds) {
    const all = _load(SRS_KEY, {});
    return questionIds.map(id => all[id]).filter(Boolean);
  }

  function saveSRSState(state) {
    const all = _load(SRS_KEY, {});
    all[state.questionId] = state;
    _save(SRS_KEY, all);
  }

  // ── Quiz results ─────────────────────────────────────────────

  function saveQuizResult(result) {
    const results = _load(RESULTS_KEY, []);
    results.unshift({ ...result, finishedAt: result.finishedAt || Date.now() });
    if (results.length > 100) results.length = 100;
    _save(RESULTS_KEY, results);
  }

  function getQuizResults(limit = 50) {
    return _load(RESULTS_KEY, []).slice(0, limit);
  }

  function clearQuizResults() {
    localStorage.removeItem(RESULTS_KEY);
  }

  // ── Questions (in-memory, načteno z questions.json) ──────────

  function upsertQuestion(q) {
    const db = App.State.getDB();
    if (!db) return q;
    if (!q.id) q = { ...q, id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) };
    const idx = db.questions.findIndex(x => x.id === q.id);
    if (idx !== -1) db.questions[idx] = q;
    else db.questions.push(q);
    App.State.setDB(db);
    return q;
  }

  function deleteQuestion(id) {
    const db = App.State.getDB();
    if (!db) return;
    db.questions = db.questions.filter(q => q.id !== id);
    App.State.setDB(db);
  }

  function deleteQuestions(ids) {
    const db = App.State.getDB();
    if (!db) return;
    const set = new Set(ids);
    db.questions = db.questions.filter(q => !set.has(q.id));
    App.State.setDB(db);
  }

  return {
    loadSRSStates, saveSRSState,
    saveQuizResult, getQuizResults, clearQuizResults,
    upsertQuestion, deleteQuestion, deleteQuestions,
  };
})();
