// Statistiky — agreguje výsledky testů a SRS data, renderuje přehledy
window.App = window.App || {};

App.Stats = (() => {
  const U = App.Utils;

  // history: array from App.DB.getQuizResults()
  // db: App.State.getDB() (for category labels)
  function render(history, db) {
    _renderOverall(history || []);
    _renderSRSBreakdown(db);
    _renderHistory(history || []);
  }

  function _renderOverall(history) {
    const total        = history.length;
    const answered     = history.reduce((s, r) => s + (r.totalQuestions || 0), 0);
    const avgScore     = total ? Math.round(history.reduce((s, r) => s + (r.scorePercent || 0), 0) / total) : null;
    const correctTotal = history.reduce((s, r) => s + (r.correct || 0), 0);
    const wrongTotal   = history.reduce((s, r) => s + (r.wrong || 0), 0);
    const accuracy     = (correctTotal + wrongTotal)
      ? Math.round(correctTotal / (correctTotal + wrongTotal) * 100)
      : null;

    _set('statsAttempts',      total);
    _set('statsAvgScore',      avgScore !== null ? avgScore + '%' : '—');
    _set('statsTotalAnswered', answered);
    _set('statsAccuracy',      accuracy !== null ? accuracy + '%' : '—');
  }

  // Category breakdown from live SRS states (more useful than quiz-result details anyway)
  function _renderSRSBreakdown(db) {
    const container = U.el('statsCategoryBreakdown');
    if (!container || !db) return;

    const cats      = db.categories || [];
    const questions = db.questions  || [];
    if (!cats.length) {
      container.innerHTML = '<p class="text-slate-400 text-sm">Zatím žádná data.</p>';
      return;
    }

    const catStats = {};
    cats.forEach(c => { catStats[c.id] = { label: c.label, correct: 0, wrong: 0, unseen: 0 }; });

    questions.forEach(q => {
      const cs = catStats[q.category];
      if (!cs) return;
      const s = App.SRS.getState(q.id);
      if (s.timesSeen === 0) { cs.unseen++; return; }
      cs.correct += s.timesCorrect;
      cs.wrong   += s.timesWrong;
    });

    const entries = Object.values(catStats).sort((a, b) => (b.correct + b.wrong) - (a.correct + a.wrong));
    container.innerHTML = entries.map(c => {
      const total = c.correct + c.wrong;
      if (!total) return `
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-medium">${U.escapeHtml(c.label)}</span>
            <span class="text-sm text-slate-400">${c.unseen} nevyzkoušeno</span>
          </div>
          <div class="h-2 bg-slate-100 dark:bg-gray-800 rounded-full"></div>
        </div>`;
      const pct       = Math.round(c.correct / total * 100);
      const color     = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-orange-500' : 'bg-red-500';
      const textColor = pct >= 75
        ? 'text-emerald-600 dark:text-emerald-400'
        : pct >= 50
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-red-600 dark:text-red-400';
      return `
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-medium">${U.escapeHtml(c.label)}</span>
            <span class="text-sm font-semibold ${textColor}">${pct}%</span>
          </div>
          <div class="h-2 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div class="progress-fill h-full ${color} rounded-full transition-all duration-700" style="width:${pct}%"></div>
          </div>
          <div class="text-xs text-slate-400 mt-1">${c.correct} / ${total} správně</div>
        </div>`;
    }).join('');
  }

  function _renderHistory(history) {
    const container = U.el('statsHistory');
    if (!container) return;
    if (!history.length) {
      container.innerHTML = '<p class="text-slate-400 text-sm">Zatím žádná data.</p>';
      return;
    }

    container.innerHTML = history.slice(0, 20).map(r => {
      const pct   = r.scorePercent ?? 0;
      const date  = r.finishedAt
        ? new Date(r.finishedAt).toLocaleDateString('cs-CZ', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })
        : '—';
      const color    = pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 50 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400';
      const barColor = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-orange-500' : 'bg-red-500';
      const modeBadge = r.mode === 'exam'
        ? '<span class="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-medium">Zkouška</span>'
        : '<span class="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">Studium</span>';
      return `
        <div class="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
          <div class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
            <span class="text-lg font-black ${color}">${pct}%</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">${modeBadge}<span class="text-xs text-slate-400">${date}</span></div>
            <div class="text-sm text-slate-600 dark:text-slate-400">${r.correct ?? 0} správně · ${r.wrong ?? 0} špatně · ${r.totalQuestions ?? 0} otázek</div>
          </div>
          <div class="shrink-0">
            <div class="w-24 h-2 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full ${barColor}" style="width:${pct}%"></div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function _set(id, value) {
    const el = U.el(id);
    if (el) el.textContent = value;
  }

  return { render };
})();
