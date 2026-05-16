
document.addEventListener('DOMContentLoaded', async () => {
  const U  = App.Utils;
  const QE = App.QuizEngine;
  const R  = App.Router;
  const C  = App.Components;
  const St = App.State;

  St.init();
  if (St.getSetting('darkMode')) document.documentElement.classList.add('dark');
  _syncDarkModeUI();

  R.init();

  R.onEnter('dashboard',  renderDashboard);
  R.onEnter('quiz-setup', renderQuizSetup);
  R.onEnter('quiz',       () => {});
  R.onEnter('results',    () => {});
  R.onEnter('adaptive',   startAdaptiveSession);
  R.onEnter('editor',     () => App.Editor.render());
  R.onEnter('stats',      renderStats);
  R.onEnter('json-editor',renderJsonEditor);
  R.onEnter('settings',   renderSettings);
  R.onEnter('materials',  () => {});

  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('hidden');
  });
  document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);

  App.Editor.init();
  App.Materials.init();

  // Načti otázky z questions.json
  try {
    const resp = await fetch('questions.json');
    const data = await resp.json();
    St.setDB(data);
    const qIds = (data.questions || []).map(q => q.id);
    App.SRS.loadStates(App.DB.loadSRSStates(qIds));
    _setText('subjectTitle', data.meta?.title || 'NetQuiz');
    _setText('subjectMeta', `${(data.questions || []).length} otázek · ${(data.categories || []).length} kategorií`);
    _updateSidebarStats();
  } catch (e) {
    console.error('Chyba při načítání otázek:', e);
    U.showToast('Nepodařilo se načíst questions.json', 'error');
  }

  R.navigate('dashboard');

  // ── Dashboard ────────────────────────────────────────────────

  function renderDashboard() {
    const db = St.getDB();
    if (!db) return;

    const history = App.DB.getQuizResults(10);

    _setText('statTotalQ',     db.questions?.length ?? 0);
    _setText('statCategories', db.categories?.length ?? 0);
    _setText('statAttempts',   history.length);
    _setText('statBestScore',  history.length ? Math.max(...history.map(r => r.scorePercent ?? 0)) + '%' : '—');
    _setText('dashboardTitle', db.meta?.title || 'NetQuiz');
    _setText('subjectTitle',   db.meta?.title || 'Předmět');
    _setText('subjectMeta',    `${db.questions?.length ?? 0} otázek · ${db.categories?.length ?? 0} kategorií`);
    _updateSidebarStats();

    const grid = U.el('categoryGrid');
    if (grid) {
      const cats   = db.categories || [];
      const counts = {};
      (db.questions || []).forEach(q => { counts[q.category] = (counts[q.category] || 0) + 1; });
      grid.innerHTML = cats.length
        ? cats.map(c => C.categoryChip(c, counts[c.id] || 0)).join('')
        : '<p class="text-slate-400 text-sm col-span-full">Žádné kategorie.</p>';
    }

    const recent = U.el('recentResults');
    if (recent) {
      if (!history.length) {
        recent.innerHTML = `<div class="text-center py-10 text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <p class="font-medium">Zatím žádné výsledky</p>
          <p class="text-sm mt-1">Spusť kvíz a výsledky se zobrazí zde.</p>
        </div>`;
      } else {
        recent.innerHTML = history.map(r => {
          const pct   = r.scorePercent ?? 0;
          const color = pct >= 75 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : pct >= 50 ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
          const date  = r.finishedAt ? new Date(r.finishedAt).toLocaleDateString('cs-CZ') : '—';
          return `<div class="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
            <div class="w-12 h-12 rounded-xl ${color} flex items-center justify-center font-black text-lg shrink-0">${pct}%</div>
            <div class="flex-1"><div class="text-sm font-medium">${r.correct ?? 0} správně z ${r.totalQuestions ?? 0}</div><div class="text-xs text-slate-400">${date} · ${U.formatTime(r.elapsedSeconds ?? 0)}</div></div>
          </div>`;
        }).join('');
      }
    }
  }

  function _updateSidebarStats() {
    const db = St.getDB();
    const el = U.el('sidebarStats');
    if (!el) return;
    el.innerHTML = db
      ? `<div>${db.questions?.length ?? 0} otázek celkem</div><div>${db.categories?.length ?? 0} kategorií</div>`
      : '<div>Žádná data</div>';
  }

  // ── Quiz setup ───────────────────────────────────────────────

  function renderQuizSetup() {
    const db = St.getDB();
    if (!db) { R.navigate('dashboard'); return; }
    const settings = St.getSettings();

    const slider  = U.el('setup-count');
    const display = U.el('setup-count-display');
    if (slider) {
      slider.value = settings.defaultCount;
      if (display) display.textContent = settings.defaultCount;
      const fresh = slider.cloneNode(true);
      slider.parentNode.replaceChild(fresh, slider);
      fresh.addEventListener('input', () => { if (display) display.textContent = fresh.value; _updateFilterCount(); });
    }

    U.setToggle(U.el('toggle-randomize'), settings.randomize);
    U.setToggle(U.el('toggle-timer'),     settings.showTimer);
    _rebindBtn('toggle-randomize', function() { U.setToggle(this, !U.getToggle(this)); });
    _rebindBtn('toggle-timer',     function() { U.setToggle(this, !U.getToggle(this)); });

    document.querySelectorAll('.mode-option input').forEach(radio => {
      radio.addEventListener('change', _updateModeCards);
    });
    _updateModeCards();

    const catsContainer = U.el('setup-categories');
    if (catsContainer && db) {
      const cats = db.categories || [];
      catsContainer.innerHTML = `<label class="cursor-pointer"><input type="checkbox" class="sr-only cat-filter" value="" checked><span class="cat-chip inline-block px-3 py-1.5 rounded-full text-sm border-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-medium transition-all">Vše</span></label>` +
        cats.map(c => `<label class="cursor-pointer"><input type="checkbox" class="sr-only cat-filter" value="${U.escapeHtml(c.id)}"><span class="cat-chip inline-block px-3 py-1.5 rounded-full text-sm border-2 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 transition-all">${U.escapeHtml(c.label)}</span></label>`).join('');
      catsContainer.querySelectorAll('.cat-filter').forEach(cb => {
        cb.addEventListener('change', () => { _syncCategoryChips(catsContainer); _updateFilterCount(); });
      });
    }

    document.querySelectorAll('.diff-filter').forEach(cb => {
      _syncDiffChip(cb);
      const fresh = cb.cloneNode(true);
      cb.parentNode.replaceChild(fresh, cb);
      _syncDiffChip(fresh);
      fresh.addEventListener('change', () => { _syncDiffChip(fresh); _updateFilterCount(); });
    });

    document.querySelectorAll('.srs-filter').forEach(cb => {
      _syncDiffChip(cb);
      const fresh = cb.cloneNode(true);
      cb.parentNode.replaceChild(fresh, cb);
      _syncDiffChip(fresh);
      fresh.addEventListener('change', () => { _syncDiffChip(fresh); _updateFilterCount(); });
    });

    _rebindBtn('startQuizBtn', startQuiz);
    _updateFilterCount();
  }

  function _updateModeCards() {
    document.querySelectorAll('.mode-option').forEach(label => {
      const radio = label.querySelector('input[type="radio"]');
      const card  = label.querySelector('.mode-card');
      if (!card) return;
      card.className = radio?.checked
        ? 'mode-card border-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 transition-all'
        : 'mode-card border-2 border-slate-200 dark:border-gray-700 rounded-xl p-4 transition-all';
    });
  }

  function _syncCategoryChips(container) {
    container.querySelectorAll('.cat-filter').forEach(cb => {
      const chip = cb.nextElementSibling;
      if (!chip) return;
      if (cb.checked) {
        chip.classList.add('border-orange-500', 'bg-orange-50', 'text-orange-700', 'font-medium');
        chip.classList.remove('border-slate-200', 'text-slate-600');
      } else {
        chip.classList.remove('border-orange-500', 'bg-orange-50', 'text-orange-700', 'font-medium');
        chip.classList.add('border-slate-200', 'text-slate-600');
      }
    });
  }

  function _syncDiffChip(cb) {
    const chip = cb.nextElementSibling;
    if (!chip) return;
    chip.style.opacity    = cb.checked ? '1' : '0.45';
    chip.style.fontWeight = cb.checked ? '600' : '400';
  }

  function _updateFilterCount() {
    const el = U.el('filterCountDisplay');
    const db = St.getDB();
    if (!el || !db?.questions) return;

    const count    = Number(U.el('setup-count')?.value || 20);
    const selCats  = Array.from(document.querySelectorAll('.cat-filter:checked')).map(c => c.value).filter(Boolean);
    const selDiffs = Array.from(document.querySelectorAll('.diff-filter:checked')).map(c => c.value);
    const selSRS   = Array.from(document.querySelectorAll('.srs-filter:checked')).map(c => c.value);

    let pool = [...db.questions];
    if (selCats.length)  pool = pool.filter(q => selCats.includes(q.category));
    if (selDiffs.length) pool = pool.filter(q => !q.difficulty || selDiffs.includes(q.difficulty));
    if (selSRS.includes('unseen') || selSRS.includes('weak')) {
      pool = pool.filter(q => {
        const s = App.SRS.getState(q.id);
        const unseen = !s || s.timesSeen === 0;
        const weak   = s && s.timesSeen > 0 && s.timesCorrect / s.timesSeen < 0.5;
        return (selSRS.includes('unseen') && unseen) || (selSRS.includes('weak') && weak);
      });
    }
    if (selSRS.includes('bookmarked')) {
      const bm = new Set(App.DB.getBookmarks());
      pool = pool.filter(q => bm.has(q.id));
    }

    const total = pool.length;
    const used  = Math.min(count, total);
    if (total === 0) {
      el.textContent = 'Žádné otázky neodpovídají filtru';
      el.className = 'text-center text-xs text-red-400 dark:text-red-500 -mt-3';
    } else {
      el.textContent = `${used} z ${total} otázek`;
      el.className = 'text-center text-xs text-slate-400 dark:text-slate-500 -mt-3';
    }
  }

  function startQuiz() {
    const db = St.getDB();
    if (!db?.questions?.length) { U.showToast('Nejsou dostupné žádné otázky.', 'error'); return; }

    const mode      = document.querySelector('input[name="quizMode"]:checked')?.value || 'study';
    const count     = Number(U.el('setup-count')?.value || 20);
    const randomize = U.getToggle(U.el('toggle-randomize'));
    const showTimer = U.getToggle(U.el('toggle-timer'));

    const selCats  = Array.from(document.querySelectorAll('.cat-filter:checked')).map(c => c.value).filter(Boolean);
    const selDiffs = Array.from(document.querySelectorAll('.diff-filter:checked')).map(c => c.value);
    const selSRS   = Array.from(document.querySelectorAll('.srs-filter:checked')).map(c => c.value);

    let pool = [...db.questions];
    if (selCats.length)  pool = pool.filter(q => selCats.includes(q.category));
    if (selDiffs.length) pool = pool.filter(q => !q.difficulty || selDiffs.includes(q.difficulty));
    if (selSRS.includes('unseen') || selSRS.includes('weak')) {
      pool = pool.filter(q => {
        const s = App.SRS.getState(q.id);
        const unseen = !s || s.timesSeen === 0;
        const weak   = s && s.timesSeen > 0 && s.timesCorrect / s.timesSeen < 0.5;
        return (selSRS.includes('unseen') && unseen) || (selSRS.includes('weak') && weak);
      });
    }
    if (selSRS.includes('bookmarked')) {
      const bm = new Set(App.DB.getBookmarks());
      pool = pool.filter(q => bm.has(q.id));
    }
    if (!pool.length) { U.showToast('Žádné otázky pro zvolené filtry.', 'warning'); return; }

    if (randomize) pool = U.shuffle(pool);
    let questions = pool.slice(0, Math.min(count, pool.length));

    if (randomize) {
      questions = questions.map(q => {
        if (q.type !== 'single' && q.type !== 'multi') return q;
        return { ...q, answers: U.shuffle(q.answers) };
      });
    }

    St.setSetting('defaultCount', count);
    St.setSetting('randomize', randomize);
    St.setSetting('showTimer', showTimer);
    St.setSetting('defaultMode', mode);

    QE.start(questions, { mode, showTimer });
    QE.onTimer(secs => { const d = U.el('topbarTimerDisplay'); if (d) d.textContent = U.formatTime(secs); });

    R.navigate('quiz');
    _renderQuizView();
  }

  function _renderQuizView() {
    _renderQuestion();
    _renderNavGrid();
    _updateProgress();
    _rebindBtn('prevQuestionBtn',  () => { if (QE.prev()) { _renderQuestion(); _renderNavGrid(); _updateProgress(); } });
    _rebindBtn('nextQuestionBtn',  () => _handleNext());
    _rebindBtn('confirmAnswerBtn', () => _confirmAnswer());
    _rebindBtn('skipBtn',          () => { QE.skip(); _handleNext(); });
    _rebindBtn('flagBtn',          () => { QE.toggleFlag(); _renderFlagBtn(); _renderNavGrid(); });
    _rebindBtn('starBtn',          () => { App.DB.toggleBookmark(QE.getQuestion()?.id); _renderStarBtn(); });
    _rebindBtn('quizPauseBtn',     () => _handlePause());
    _rebindBtn('quizEndBtn',       () => { if (confirm('Ukončit test a zobrazit výsledky?')) _finishQuiz(); });
  }

  function _renderQuestion(skipAnimation = false) {
    const session  = QE.getSession();
    const q        = QE.getQuestion();
    if (!q) return;
    const idx      = QE.getCurrentIndex();
    const answer   = QE.getAnswer();
    const revealed = QE.isRevealed();
    const mode     = session.config.mode;
    const db       = St.getDB();
    const catLabel = db?.categories?.find(c => c.id === q.category)?.label || q.category || '';

    if (!skipAnimation) {
      const card = U.el('questionCard');
      if (card) { card.classList.remove('question-slide'); void card.offsetWidth; card.classList.add('question-slide'); }
    }

    _setText('qCategory', catLabel);
    _setHtml('qType', `<span class="text-xs px-2.5 py-1 bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-slate-400 rounded-full">${U.typeLabel(q.type)}</span><span class="text-xs text-slate-400 ml-2">${U.typeHint(q.type)}</span>`);
    _setText('qNumDisplay', idx + 1);

    const diffEl = U.el('qDifficulty');
    if (diffEl) {
      if (q.difficulty) {
        const cls = { easy: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300', medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300', hard: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' };
        diffEl.className = `text-xs px-2.5 py-1 rounded-full font-medium ${cls[q.difficulty] || ''}`;
        diffEl.textContent = { easy: 'Lehká', medium: 'Střední', hard: 'Těžká' }[q.difficulty] || q.difficulty;
        diffEl.classList.remove('hidden');
      } else { diffEl.classList.add('hidden'); }
    }

    _setText('qText', q.question);
    const answersArea = U.el('answersArea');
    if (answersArea) { answersArea.innerHTML = C.renderAnswers(q, answer, revealed); _bindAnswerEvents(answersArea, q.type); }

    const feedbackArea = U.el('feedbackArea');
    if (feedbackArea) {
      if (revealed && mode === 'study') {
        feedbackArea.innerHTML = C.renderFeedback(QE.isCorrect(q, answer), q.explanation, q.type);
        feedbackArea.classList.remove('hidden');
      } else { feedbackArea.classList.add('hidden'); feedbackArea.innerHTML = ''; }
    }

    _renderFlagBtn();
    _renderStarBtn();
    _updateActionButtons();
  }

  function _bindAnswerEvents(container, type) {
    if (type === 'single' || type === 'boolean') {
      container.querySelectorAll('label[data-index], label[data-value]').forEach(label => {
        label.addEventListener('click', event => {
          if (event.target.tagName === 'INPUT') return;
          const input = label.querySelector('input');
          if (!input || input.disabled) return;
          QE.setAnswer(type === 'boolean' ? label.dataset.value : Number(label.dataset.index));
          _renderQuestion(true);
        });
      });
    }
    if (type === 'multi') {
      container.querySelectorAll('label[data-index]').forEach(label => {
        label.addEventListener('click', event => {
          if (event.target.tagName === 'INPUT') return;
          const input = label.querySelector('input');
          if (!input || input.disabled) return;
          const i = Number(label.dataset.index);
          const cur = Array.isArray(QE.getAnswer()) ? [...QE.getAnswer()] : [];
          const pos = cur.indexOf(i);
          if (pos === -1) cur.push(i); else cur.splice(pos, 1);
          QE.setAnswer(cur);
          _renderQuestion(true);
        });
      });
    }
    if (type === 'number') {
      container.querySelector('#numAnswer')?.addEventListener('input', function() { QE.setAnswer(this.value ? Number(this.value) : undefined); _updateActionButtons(); });
    }
    if (type === 'text') {
      container.querySelector('#txtAnswer')?.addEventListener('input', function() { QE.setAnswer(this.value || undefined); _updateActionButtons(); });
    }
    if (type === 'open') {
      container.querySelector('#openAnswer')?.addEventListener('input', function() { QE.setAnswer(this.value || undefined); _updateActionButtons(); });
    }
  }

  function _updateActionButtons() {
    const session   = QE.getSession();
    const answer    = QE.getAnswer();
    const revealed  = QE.isRevealed();
    const mode      = session?.config?.mode;
    const idx       = QE.getCurrentIndex();
    const lastIdx   = (session?.questions?.length ?? 1) - 1;
    const hasAnswer = answer !== undefined && answer !== null && answer !== '' && !(Array.isArray(answer) && !answer.length);

    const confirmBtn = U.el('confirmAnswerBtn');
    const nextBtn    = U.el('nextQuestionBtn');

    if (mode === 'study' && !revealed) {
      if (confirmBtn) { confirmBtn.classList.remove('hidden'); confirmBtn.disabled = !hasAnswer; }
      if (nextBtn) nextBtn.classList.add('hidden');
    } else {
      if (confirmBtn) confirmBtn.classList.add('hidden');
      if (nextBtn) {
        nextBtn.classList.remove('hidden');
        nextBtn.innerHTML = idx === lastIdx
          ? 'Dokončit <svg class="w-4 h-4 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
          : 'Další <svg class="w-4 h-4 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>';
      }
    }
    const prevBtn = U.el('prevQuestionBtn');
    if (prevBtn) prevBtn.disabled = idx === 0;
  }

  function _confirmAnswer() {
    const q = QE.getQuestion();
    if (!q) return;
    const answer = QE.getAnswer();
    QE.reveal(); _renderQuestion(); _renderNavGrid();
    if (q.type !== 'open') {
      const area = U.el('answersArea');
      if (area) {
        const cls = QE.isCorrect(q, answer) ? 'answer-correct-pulse' : 'answer-shake';
        area.classList.add(cls);
        area.addEventListener('animationend', () => area.classList.remove(cls), { once: true });
      }
    }
  }

  function _handleNext() {
    const session = QE.getSession();
    const idx     = QE.getCurrentIndex();
    if (idx === session.questions.length - 1) { _finishQuiz(); return; }
    if (QE.next()) { _renderQuestion(); _renderNavGrid(); _updateProgress(); }
  }

  function _handlePause() {
    const paused = QE.togglePause();
    const btn = U.el('quizPauseBtn');
    if (btn) {
      btn.title = paused ? 'Pokračovat' : 'Pauza';
      btn.innerHTML = paused
        ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
        : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    }
  }

  function _renderFlagBtn() {
    const btn = U.el('flagBtn');
    if (!btn) return;
    const flagged = QE.isFlagged();
    btn.classList.toggle('text-amber-500', flagged);
    btn.classList.toggle('text-slate-300', !flagged);
  }

  function _renderStarBtn() {
    const btn = U.el('starBtn');
    if (!btn) return;
    const starred = App.DB.isBookmarked(QE.getQuestion()?.id);
    btn.classList.toggle('text-yellow-500', !!starred);
    btn.classList.toggle('text-slate-300',  !starred);
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', starred ? 'currentColor' : 'none');
  }

  function _renderNavGrid() {
    const grid = U.el('quizNavGrid');
    if (!grid) return;
    const session = QE.getSession();
    if (!session) return;
    grid.innerHTML = session.questions.map((_, i) => {
      return `<button class="${C.navBtnClass(QE.navStatus(i))}" data-qi="${i}">${i + 1}</button>`;
    }).join('');
    grid.querySelectorAll('[data-qi]').forEach(btn => {
      btn.addEventListener('click', () => { QE.goTo(Number(btn.dataset.qi)); _renderQuestion(); _renderNavGrid(); _updateProgress(); });
    });
  }

  function _updateProgress() {
    const session = QE.getSession();
    if (!session) return;
    const total    = session.questions.length;
    const answered = Object.keys(session.answers).length;
    const bar  = U.el('quizProgressBar');
    const text = U.el('quizProgressText');
    if (bar)  bar.style.width = Math.round((answered / total) * 100) + '%';
    if (text) text.textContent = `${QE.getCurrentIndex() + 1} / ${total}`;
  }

  function _finishQuiz() {
    const result = QE.submit();
    if (!result) return;
    App.DB.saveQuizResult(result);
    _renderResults(result);
    R.navigate('results');
  }

  function _renderResults(result) {
    const pct  = result.scorePercent;
    const grad = U.scoreGradient(pct);
    const scoreCard = U.el('resultScoreCard');
    if (scoreCard) scoreCard.className = `rounded-2xl p-8 text-white mb-8 text-center shadow-lg bg-gradient-to-br ${grad}`;
    const scoreEl = U.el('resultScore');
    if (scoreEl) { scoreEl.classList.remove('score-reveal'); void scoreEl.offsetWidth; scoreEl.classList.add('score-reveal'); }
    _setText('resultScore',  pct + '%');
    _setText('resultGrade',  U.gradeLabel(pct));
    _setText('resultMeta',   `${result.totalQuestions} otázek · ${U.formatTime(result.elapsedSeconds)} · ${result.mode === 'exam' ? 'Zkouška' : 'Studium'}`);
    _setText('resultCorrect', result.correct);
    _setText('resultWrong',   result.wrong);
    _setText('resultSkipped', result.skipped);

    const review = U.el('resultReview');
    if (review) review.innerHTML = result.details.map((d, i) => C.resultReviewCard(d.question, d.answer, d.correct, i)).join('');

    _rebindBtn('retryBtn', () => R.navigate('quiz-setup'));
    _rebindBtn('retryWrongBtn', () => {
      const wrongs = result.details.filter(d => d.correct === false).map(d => d.question);
      if (!wrongs.length) { U.showToast('Žádné špatné odpovědi!', 'success'); return; }
      QE.start(wrongs, { mode: result.mode, showTimer: St.getSetting('showTimer') });
      QE.onTimer(secs => { const d = U.el('topbarTimerDisplay'); if (d) d.textContent = U.formatTime(secs); });
      R.navigate('quiz'); _renderQuizView();
    });
  }

  // ── Stats view ───────────────────────────────────────────────

  function renderStats() {
    const db = St.getDB();
    const history = App.DB.getQuizResults(50);
    App.Stats.render(history, db);

    _rebindBtn('clearHistoryBtn', () => {
      if (!confirm('Smazat historii testů a výkon dle kategorií? Akce je nevratná.')) return;
      App.DB.clearQuizResults();
      App.DB.clearSRSStates();
      App.SRS.reset();
      renderStats();
      U.showToast('Historie a statistiky smazány', 'info');
    });
  }

  // ── JSON editor view ─────────────────────────────────────────

  function renderJsonEditor() {
    const db   = St.getDB();
    const area = U.el('jsonEditorArea');
    if (!area) return;
    const text = db ? JSON.stringify(db, null, 2) : '';
    area.value = text;
    _updateJsonMeta(text);

    const freshArea = area.cloneNode(true);
    area.parentNode.replaceChild(freshArea, area);
    freshArea.value = text;
    freshArea.addEventListener('input', U.debounce(() => _updateJsonMeta(freshArea.value), 300));

    _rebindBtn('jsonFormatBtn', () => {
      try { freshArea.value = JSON.stringify(JSON.parse(freshArea.value), null, 2); _updateJsonMeta(freshArea.value); }
      catch { U.showToast('Nevalidní JSON', 'error'); }
    });
    _rebindBtn('jsonMinifyBtn', () => {
      try { freshArea.value = JSON.stringify(JSON.parse(freshArea.value)); _updateJsonMeta(freshArea.value); }
      catch { U.showToast('Nevalidní JSON', 'error'); }
    });
    _rebindBtn('jsonApplyBtn', () => {
      let parsed;
      try { parsed = JSON.parse(freshArea.value); } catch { U.showToast('Nevalidní JSON', 'error'); return; }
      if (!parsed.questions) { U.showToast('Chybí pole questions', 'error'); return; }
      St.setDB(parsed);
      const qIds = (parsed.questions || []).map(q => q.id);
      App.SRS.loadStates(App.DB.loadSRSStates(qIds));
      _setText('subjectTitle', parsed.meta?.title || 'NetQuiz');
      _setText('subjectMeta', `${(parsed.questions || []).length} otázek · ${(parsed.categories || []).length} kategorií`);
      _updateSidebarStats();
      U.showToast(`Načteno ${parsed.questions.length} otázek`, 'success');
    });
  }

  function _updateJsonMeta(text) {
    const badge = U.el('jsonValidBadge');
    const count = U.el('jsonCharCount');
    if (count) count.textContent = text.length.toLocaleString('cs') + ' znaků';
    if (!badge) return;
    try {
      JSON.parse(text);
      badge.textContent = '✓ Validní JSON';
      badge.className = 'text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full font-semibold border border-emerald-200 dark:border-emerald-800';
    } catch {
      badge.textContent = '✗ Chyba JSON';
      badge.className = 'text-xs px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-full font-semibold border border-red-200 dark:border-red-800';
    }
  }

  // ── Settings view ────────────────────────────────────────────

  function renderSettings() {
    const settings = St.getSettings();
    const countInput = U.el('default-count');
    if (countInput) {
      countInput.value = settings.defaultCount;
      const fresh = countInput.cloneNode(true);
      countInput.parentNode.replaceChild(fresh, countInput);
      fresh.value = settings.defaultCount;
      fresh.addEventListener('change', () => St.setSetting('defaultCount', Number(fresh.value)));
    }
    U.setToggle(U.el('settings-dark-toggle'),     settings.darkMode);
    U.setToggle(U.el('settings-random-toggle'),   settings.randomize);
    U.setToggle(U.el('settings-feedback-toggle'), settings.instantFeedback);

    _bindSettingsToggle('settings-dark-toggle', 'darkMode', val => {
      document.documentElement.classList.toggle('dark', val);
      _syncDarkModeUI();
    });
    _bindSettingsToggle('settings-random-toggle',   'randomize');
    _bindSettingsToggle('settings-feedback-toggle', 'instantFeedback');

    _rebindBtn('exportDataBtn', () => {
      const db = St.getDB();
      if (db) U.downloadJSON(db, 'questions_export.json');
    });
    _rebindBtn('clearStatsBtn', () => {
      if (!confirm('Smazat historii a statistiky (včetně výkonu dle kategorií)? Akce je nevratná.')) return;
      App.DB.clearQuizResults();
      App.DB.clearSRSStates();
      App.SRS.reset();
      U.showToast('Historie a statistiky smazány', 'info');
    });
  }

  function _bindSettingsToggle(id, settingKey, onChange) {
    const btn = U.el(id);
    if (!btn) return;
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    U.setToggle(fresh, St.getSetting(settingKey));
    fresh.addEventListener('click', function() {
      const newVal = !U.getToggle(this);
      U.setToggle(this, newVal);
      St.setSetting(settingKey, newVal);
      if (onChange) onChange(newVal);
    });
  }

  function toggleDarkMode() {
    const dark = document.documentElement.classList.toggle('dark');
    St.setSetting('darkMode', dark);
    _syncDarkModeUI();
    U.setToggle(U.el('settings-dark-toggle'), dark);
  }

  function _syncDarkModeUI() {
    const dark = document.documentElement.classList.contains('dark');
    document.getElementById('darkIcon')?.classList.toggle('hidden', !dark);
    document.getElementById('lightIcon')?.classList.toggle('hidden', dark);
  }

  // ── Adaptive learning ────────────────────────────────────────
  const _adp = {
    pool: [], mode: 'adaptive', shownThisSession: new Map(),
    sessionCount: 0, sessionCorrect: 0, sessionStreak: 0,
    currentQ: null, currentAnswer: null, revealed: false,
    questionShownAt: 0, finished: false,
  };

  function startAdaptiveSession() {
    const db = St.getDB();
    if (!db?.questions?.length) { U.showToast('Nejsou dostupne zadne otazky.', 'error'); return; }

    _adp.pool             = [...db.questions];
    _adp.shownThisSession = new Map();
    _adp.mode             = 'adaptive';
    _adp.sessionCount     = 0;
    _adp.sessionCorrect   = 0;
    _adp.sessionStreak    = 0;
    _adp.currentQ         = null;
    _adp.currentAnswer    = null;
    _adp.revealed         = false;
    _adp.finished         = false;

    ['adaptiveQuestionCard', 'srsStatusChips', 'srsActionBar'].forEach(id => U.el(id)?.classList.remove('hidden'));
    ['srsSessionSummary', 'srsRatingPanel', 'srsWarningBanner'].forEach(id => U.el(id)?.classList.add('hidden'));

    _bindAdaptiveControls();
    _updateSRSChips();
    _adaptiveNextQuestion();
  }

  function _bindAdaptiveControls() {
    document.querySelectorAll('.srs-mode-btn').forEach(btn => {
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', () => {
        _adp.mode = fresh.dataset.mode;
        _adp.shownThisSession.clear();
        _syncModeToggle();
        _adaptiveNextQuestion();
      });
    });
    _syncModeToggle();
    _rebindBtn('adaptiveEndBtn', _adaptiveEndSession);
    _rebindBtn('srsConfirmBtn', _adaptiveConfirm);
    _rebindBtn('srsRevealBtn',  _adaptiveReveal);
    document.querySelectorAll('.rating-btn').forEach(btn => {
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', () => _adaptiveRate(Number(fresh.dataset.rating)));
    });
    _rebindBtn('srsRestartBtn', startAdaptiveSession);
  }

  function _syncModeToggle() {
    document.querySelectorAll('.srs-mode-btn').forEach(btn => {
      const active = btn.dataset.mode === _adp.mode;
      btn.className = active
        ? 'srs-mode-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-orange-500 text-white shadow-sm'
        : 'srs-mode-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700';
    });
  }

  function _adaptiveNextQuestion() {
    const q = App.SRS.selectNext(_adp.pool, _adp.shownThisSession, _adp.mode);
    if (!q) {
      U.showToast('Vsechny otazky zobrazeny. Zkus jine sezeni!', 'info', 4000);
      _adaptiveEndSession();
      return;
    }
    _adp.currentQ = q; _adp.currentAnswer = null; _adp.revealed = false; _adp.questionShownAt = Date.now();
    _renderAdaptiveQuestion(); _hideRatingPanel(); _hideWarningBanner();
    _updateSRSChips(); _updateSessionCounters();
  }

  function _renderAdaptiveQuestion() {
    const q  = _adp.currentQ;
    const db = St.getDB();
    if (!q) return;
    const catLabel = db?.categories?.find(c => c.id === q.category)?.label || q.category || '';
    _setText('srsQCategory', catLabel);
    _setHtml('srsQType', `<span class="text-xs px-2.5 py-1 bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-slate-400 rounded-full">${U.typeLabel(q.type)}</span>`);

    const state = App.SRS.getState(q.id);
    const badge = U.el('srsStateBadge');
    if (badge) {
      if (state.timesSeen === 0) {
        badge.textContent = 'Nova'; badge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'; badge.classList.remove('hidden');
      } else if (state.streak >= 4) {
        badge.textContent = 'Zvladnuta'; badge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'; badge.classList.remove('hidden');
      } else if (state.timesWrong > state.timesCorrect) {
        badge.textContent = 'Problematicka'; badge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'; badge.classList.remove('hidden');
      } else { badge.classList.add('hidden'); }
    }

    _setText('srsQText', q.question);
    const answersArea = U.el('srsAnswersArea');
    if (answersArea) { answersArea.innerHTML = App.Components.renderAnswers(q, _adp.currentAnswer, _adp.revealed); _bindAdaptiveAnswerEvents(answersArea, q.type); }

    const feedbackArea = U.el('srsFeedbackArea');
    if (feedbackArea) {
      if (_adp.revealed) {
        const correct = q.type === 'open' ? true : QE.isCorrect(q, _adp.currentAnswer);
        feedbackArea.innerHTML = App.Components.renderFeedback(correct, q.explanation, q.type);
        feedbackArea.classList.remove('hidden');
      } else { feedbackArea.classList.add('hidden'); feedbackArea.innerHTML = ''; }
    }

    const card = U.el('adaptiveQuestionCard');
    if (card) { card.classList.remove('question-slide'); void card.offsetWidth; card.classList.add('question-slide'); }
    _updateAdaptiveActionBar();
  }

  function _bindAdaptiveAnswerEvents(container, type) {
    if (type === 'single' || type === 'boolean') {
      container.querySelectorAll('label[data-index], label[data-value]').forEach(label => {
        label.addEventListener('click', e => {
          if (e.target.tagName === 'INPUT') return;
          const input = label.querySelector('input');
          if (!input || input.disabled) return;
          _adp.currentAnswer = type === 'boolean' ? label.dataset.value : Number(label.dataset.index);
          _renderAdaptiveQuestion();
        });
      });
    }
    if (type === 'multi') {
      container.querySelectorAll('label[data-index]').forEach(label => {
        label.addEventListener('click', e => {
          if (e.target.tagName === 'INPUT') return;
          const input = label.querySelector('input');
          if (!input || input.disabled) return;
          const i = Number(label.dataset.index);
          const cur = Array.isArray(_adp.currentAnswer) ? [..._adp.currentAnswer] : [];
          const pos = cur.indexOf(i);
          if (pos === -1) cur.push(i); else cur.splice(pos, 1);
          _adp.currentAnswer = cur; _renderAdaptiveQuestion();
        });
      });
    }
    if (type === 'number') { container.querySelector('#numAnswer')?.addEventListener('input', function() { _adp.currentAnswer = this.value ? Number(this.value) : null; _updateAdaptiveActionBar(); }); }
    if (type === 'text')   { container.querySelector('#txtAnswer')?.addEventListener('input', function() { _adp.currentAnswer = this.value || null; _updateAdaptiveActionBar(); }); }
    if (type === 'open')   { container.querySelector('#openAnswer')?.addEventListener('input', function() { _adp.currentAnswer = this.value || null; _updateAdaptiveActionBar(); }); }
  }

  function _updateAdaptiveActionBar() {
    const q = _adp.currentQ;
    const confirmed = U.el('srsConfirmBtn');
    const reveal    = U.el('srsRevealBtn');
    const actionBar = U.el('srsActionBar');
    if (!q || !actionBar) return;
    if (_adp.revealed) { actionBar.classList.add('hidden'); return; }
    actionBar.classList.remove('hidden');
    const hasAnswer = _adp.currentAnswer !== null && _adp.currentAnswer !== undefined && !(Array.isArray(_adp.currentAnswer) && !_adp.currentAnswer.length);
    if (q.type === 'open') {
      if (confirmed) confirmed.classList.add('hidden');
      if (reveal) reveal.classList.remove('hidden');
    } else {
      if (confirmed) { confirmed.classList.remove('hidden'); confirmed.disabled = !hasAnswer; }
      if (reveal) reveal.classList.add('hidden');
    }
  }

  function _adaptiveConfirm() {
    if (!_adp.currentQ || _adp.revealed) return;
    _adp.revealed = true;
    const q = _adp.currentQ;
    const correct = QE.isCorrect(q, _adp.currentAnswer);
    const area = U.el('srsAnswersArea');
    if (area && q.type !== 'open') {
      const cls = correct ? 'answer-correct-pulse' : 'answer-shake';
      area.classList.add(cls);
      area.addEventListener('animationend', () => area.classList.remove(cls), { once: true });
    }
    _renderAdaptiveQuestion();
    _showRatingPanel(q.id, correct);
    _checkAntiPatterns(q, correct);
  }

  function _adaptiveReveal() {
    if (!_adp.currentQ || _adp.revealed) return;
    _adp.revealed = true; _renderAdaptiveQuestion(); _showRatingPanel(_adp.currentQ.id, null);
  }

  function _adaptiveRate(rating) {
    const q = _adp.currentQ;
    if (!q) return;
    const wasCorrect = q.type === 'open' ? rating >= 3 : QE.isCorrect(q, _adp.currentAnswer);
    const newState = App.SRS.updateAfterRating(q.id, rating, wasCorrect);
    App.DB.saveSRSState(newState);

    _adp.shownThisSession.set(q.id, Date.now());
    _adp.sessionCount++;
    if (rating >= 3) { _adp.sessionCorrect++; _adp.sessionStreak++; } else { _adp.sessionStreak = 0; }
    _adaptiveNextQuestion();
  }

  function _showRatingPanel(questionId, wasCorrect) {
    const panel = U.el('srsRatingPanel');
    const bar   = U.el('srsActionBar');
    if (!panel) return;
    [1, 2, 3, 4, 5].forEach(r => {
      const preview = panel.querySelector(`[data-preview="${r}"]`);
      if (preview) preview.textContent = _formatInterval(App.SRS.previewNextInterval(questionId, r));
    });
    panel.classList.remove('hidden');
    if (bar) bar.classList.add('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _hideRatingPanel() {
    U.el('srsRatingPanel')?.classList.add('hidden');
    U.el('srsActionBar')?.classList.remove('hidden');
  }

  function _formatInterval(days) {
    if (days === 1) return 'zitra';
    if (days < 7)   return `${days} dni`;
    if (days < 14)  return '1 tyden';
    if (days < 30)  return `${Math.round(days / 7)} tydny`;
    if (days < 60)  return '1 mesic';
    return `${Math.round(days / 30)} mesice`;
  }

  function _checkAntiPatterns(q) {
    const state      = App.SRS.getState(q.id);
    const answerTime = Date.now() - _adp.questionShownAt;
    let warning = null;
    if (App.SRS.isSuspiciouslyFast(answerTime) && q.type !== 'boolean')
      warning = 'Rychla odpoved — ujisti se, ze opravdu znas tuto otazku, a ohodnoť se uprimne.';
    else if (App.SRS.isFalseConfidence(state, state.manualRating || 4))
      warning = 'Tato otazka ti historicky dela problemy. Zkontroluj svou odpoved pred hodnocenim.';
    if (warning) _showWarningBanner(warning);
  }

  function _showWarningBanner(text) {
    const banner = U.el('srsWarningBanner'); const msg = U.el('srsWarningText');
    if (!banner || !msg) return;
    msg.textContent = text; banner.classList.remove('hidden');
  }
  function _hideWarningBanner() { U.el('srsWarningBanner')?.classList.add('hidden'); }

  function _updateSRSChips() {
    const container = U.el('srsStatusChips');
    if (!container) return;
    const stats = App.SRS.getStats(_adp.pool.map(q => q.id));
    container.innerHTML = [
      `<span class="px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-semibold">${stats.newCount} novych</span>`,
      `<span class="px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-semibold">${stats.dueNow} due dnes</span>`,
      `<span class="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold">${stats.struggling} problematickych</span>`,
      `<span class="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold">${stats.mastered} zvladnutych</span>`,
    ].join('');
  }

  function _updateSessionCounters() {
    _setText('srsSeenCount',     _adp.sessionCount);
    _setText('srsCorrectCount',  _adp.sessionCorrect);
    _setText('srsStreakDisplay', _adp.sessionStreak);
  }

  function _adaptiveEndSession() {
    _adp.finished = true;
    ['adaptiveQuestionCard', 'srsRatingPanel', 'srsActionBar', 'srsStatusChips', 'srsWarningBanner'].forEach(id => U.el(id)?.classList.add('hidden'));
    U.el('srsSessionSummary')?.classList.remove('hidden');

    const total   = _adp.sessionCount;
    const correct = _adp.sessionCorrect;
    const wrong   = total - correct;
    const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;

    _setText('srsSummaryScore',   total > 0 ? pct + '%' : '—');
    _setText('srsSummaryLabel',   pct >= 80 ? 'Vyborny vykon!' : pct >= 60 ? 'Dobry vykon' : total === 0 ? 'Sezeni dokonceno' : 'Procvic slabe otazky');
    _setText('srsSummaryMeta',    `${total} otazek · ${correct} spravne · ${wrong} spatne`);
    _setText('srsSummaryCorrect', correct);
    _setText('srsSummaryWrong',   wrong);

    const tomorrowMs = Date.now() + 86_400_000;
    _setText('srsSummaryDue', _adp.pool.filter(q => {
      const s = App.SRS.getState(q.id);
      return s.nextReviewAt > Date.now() && s.nextReviewAt <= tomorrowMs;
    }).length);

    _rebindBtn('srsRestartBtn', startAdaptiveSession);
  }

  document.addEventListener('keydown', e => {
    if (R.getCurrent() !== 'adaptive') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (_adp.finished) return;
    if (!_adp.revealed) {
      const q = _adp.currentQ;
      if (!q) return;
      if (e.key === 'Enter') {
        const confirm = U.el('srsConfirmBtn'); const reveal = U.el('srsRevealBtn');
        if (confirm && !confirm.classList.contains('hidden') && !confirm.disabled) confirm.click();
        else if (reveal && !reveal.classList.contains('hidden')) reveal.click();
        return;
      }
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1) {
        if (q.type === 'single') document.querySelectorAll('#srsAnswersArea label[data-index]')[num - 1]?.click();
        if (q.type === 'boolean') {
          if (num === 1) document.querySelector('#srsAnswersArea label[data-value="true"]')?.click();
          if (num === 2) document.querySelector('#srsAnswersArea label[data-value="false"]')?.click();
        }
      }
    } else {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 5) document.querySelector(`.rating-btn[data-rating="${num}"]`)?.click();
    }
  });

  document.addEventListener('keydown', e => {
    if (R.getCurrent() !== 'quiz') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const q = QE.getQuestion();
    if (!q) return;
    if (e.key === 'ArrowRight') { const nb = U.el('nextQuestionBtn'); if (nb && !nb.classList.contains('hidden')) nb.click(); }
    if (e.key === 'Enter') {
      const cb = U.el('confirmAnswerBtn');
      if (cb && !cb.classList.contains('hidden') && !cb.disabled) { cb.click(); return; }
      const nb = U.el('nextQuestionBtn'); if (nb && !nb.classList.contains('hidden')) nb.click();
    }
    if (e.key === 'ArrowLeft') U.el('prevQuestionBtn')?.click();
    if (e.key === 'f' || e.key === 'F') U.el('flagBtn')?.click();
    if (e.key === 'b' || e.key === 'B') U.el('starBtn')?.click();
    if (e.key === 's' || e.key === 'S') U.el('skipBtn')?.click();
    if (!QE.isRevealed()) {
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1) {
        if (q.type === 'single') document.querySelectorAll('#answersArea label[data-index]')[num - 1]?.click();
        if (q.type === 'boolean') {
          if (num === 1) document.querySelector('#answersArea label[data-value="true"]')?.click();
          if (num === 2) document.querySelector('#answersArea label[data-value="false"]')?.click();
        }
      }
    }
  });

  // Escape key closes open modals
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('questionModal')?.classList.contains('hidden'))
      document.getElementById('questionModalBackdrop')?.click();
    else if (!document.getElementById('deleteModal')?.classList.contains('hidden'))
      document.getElementById('deleteModalCancel')?.click();
    else if (!document.getElementById('importJsonModal')?.classList.contains('hidden'))
      document.getElementById('importJsonClose')?.click();
  });

  // ── Helpers ──────────────────────────────────────────────────

  function _rebindBtn(id, fn) {
    const btn = U.el(id);
    if (!btn) return btn;
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', fn);
    return fresh;
  }

  function _setText(id, val) { const el = U.el(id); if (el) el.textContent = val ?? ''; }
  function _setHtml(id, val) { const el = U.el(id); if (el) el.innerHTML = val ?? ''; }
});
