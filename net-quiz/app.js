
document.addEventListener('DOMContentLoaded', async () => {
  const U = App.Utils;
  const QE = App.QuizEngine;
  const R = App.Router;
  const C = App.Components;
  const St = App.State;

  St.init();
  if (St.getSetting('darkMode')) document.documentElement.classList.add('dark');
  _syncDarkModeUI();

  R.init();

  R.onEnter('dashboard', renderDashboard);
  R.onEnter('quiz-setup', renderQuizSetup);
  R.onEnter('quiz', () => { });
  R.onEnter('results', () => { });
  R.onEnter('adaptive', startAdaptiveSession);
  R.onEnter('editor', () => App.Editor.render());
  R.onEnter('stats', renderStats);
  R.onEnter('json-editor', renderJsonEditor);
  R.onEnter('settings', renderSettings);
  R.onEnter('materials', () => { });
  R.onEnter('browse', _renderBrowseView);
  R.onEnter('subjects', renderSubjects);

  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('hidden');
  });
  document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);

  App.Editor.init();
  App.Materials.init();

  const SUBJECTS = [
    { id: 'site', label: 'Sítě', file: '../json/site.json' },
    { id: 'weby', label: 'Weby', file: '../json/weby.json' },
  ];

  function _getCurrentSubject() {
    const subjectKey = St.getSetting('defaultSubject') || 'site';
    return SUBJECTS.find(s => s.id === subjectKey) || SUBJECTS[0];
  }

  async function _loadSubject(subjectId) {
    const customS = _getCustomSubjects().find(s => s.id === subjectId);
    if (customS) {
      const data = customS.data;
      St.setDB(data);
      App.SRS.loadStates(App.DB.loadSRSStates((data.questions || []).map(q => q.id)));
      _setText('subjectTitle', data.meta?.title || customS.label);
      _setText('subjectMeta', `${(data.questions || []).length} otázek · ${(data.categories || []).length} kategorií`);
      _updateSidebarStats();
      return true;
    }
    const subject = SUBJECTS.find(s => s.id === subjectId) || _getCurrentSubject();
    try {
      const resp = await fetch(subject.file);
      const data = await resp.json();
      St.setDB(data);
      const qIds = (data.questions || []).map(q => q.id);
      App.SRS.loadStates(App.DB.loadSRSStates(qIds));
      _setText('subjectTitle', data.meta?.title || subject.label);
      _setText('subjectMeta', `${(data.questions || []).length} otázek · ${(data.categories || []).length} kategorií`);
      _updateSidebarStats();
      return true;
    } catch (e) {
      console.error(`Chyba při načítání ${subject.file}:`, e);
      U.showToast(`Nepodařilo se načíst ${subject.file}`, 'error');
      return false;
    }
  }

  function _getCustomSubjects() {
    try { return JSON.parse(localStorage.getItem('nq_custom_subjects') || '[]'); }
    catch { return []; }
  }

  await _loadSubject(St.getSetting('defaultSubject') || 'site');

  async function renderSubjects() {
    const grid = U.el('subjectsGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="text-slate-400 text-sm col-span-full text-center py-12">Načítám předměty…</div>';

    const currentId = St.getSetting('defaultSubject') || 'site';
    const custom = _getCustomSubjects();

    const builtinCards = await Promise.all(SUBJECTS.map(async (s) => {
      try {
        const resp = await fetch(s.file);
        const data = await resp.json();
        return {
          id: s.id, qCount: (data.questions || []).length, catCount: (data.categories || []).length,
          isActive: s.id === currentId, title: data.meta?.title || s.label, isCustom: false
        };
      } catch {
        return { id: s.id, qCount: '?', catCount: '?', isActive: s.id === currentId, title: s.label, isCustom: false };
      }
    }));

    const customCards = custom.map(s => ({
      id: s.id, isCustom: true, isActive: s.id === currentId,
      title: s.data?.meta?.title || s.label,
      qCount: (s.data?.questions || []).length,
      catCount: (s.data?.categories || []).length,
    }));

    const allCards = [...builtinCards, ...customCards];

    grid.innerHTML = allCards.map(({ id, qCount, catCount, isActive, title, isCustom }) => `
      <button data-subject="${id}" class="relative text-left p-5 rounded-2xl border-2 transition-all group
        ${isActive ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 shadow-sm'
        : 'border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-orange-300 hover:shadow-sm'}">
        <div class="flex items-start justify-between mb-3 gap-2">
          <span class="font-bold text-lg leading-tight">${title}</span>
          <div class="flex items-center gap-1.5 shrink-0">
            ${isActive ? '<span class="text-xs font-semibold bg-orange-500 text-white px-2 py-0.5 rounded-full">Aktivní</span>' : ''}
            ${isCustom ? `<button data-delete-subject="${id}" class="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded" title="Smazat předmět">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>` : ''}
          </div>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">${qCount} otázek · ${catCount} kategorií</p>
      </button>
    `).join('');

    grid.querySelectorAll('[data-subject]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (e.target.closest('[data-delete-subject]')) return;
        const id = btn.dataset.subject;
        if (id === (St.getSetting('defaultSubject') || 'site')) { R.navigate('dashboard'); return; }
        St.setSetting('defaultSubject', id);
        await _loadSubject(id);
        _browseQs = [];
        R.navigate('dashboard');
        U.showToast('Předmět přepnut', 'success');
      });
    });

    grid.querySelectorAll('[data-delete-subject]').forEach(delBtn => {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = delBtn.dataset.deleteSubject;
        const updated = _getCustomSubjects().filter(s => s.id !== id);
        localStorage.setItem('nq_custom_subjects', JSON.stringify(updated));
        if ((St.getSetting('defaultSubject') || 'site') === id) {
          St.setSetting('defaultSubject', 'site');
          await _loadSubject('site');
          _browseQs = [];
        }
        renderSubjects();
      });
    });

    // Wire up create form (idempotent via onclick assignment)
    const createBtn = U.el('createSubjectBtn');
    const form = U.el('createSubjectForm');
    if (createBtn) createBtn.onclick = () => {
      form?.classList.toggle('hidden');
      U.el('createSubjectError')?.classList.add('hidden');
    };
    const cancelBtn = U.el('createSubjectCancel');
    if (cancelBtn) cancelBtn.onclick = () => form?.classList.add('hidden');

    const fileInput = document.getElementById('newSubjectFile');
    const fileLabel = U.el('newSubjectFileName');
    if (fileInput && fileLabel) {
      fileInput.onchange = () => {
        fileLabel.textContent = fileInput.files[0]?.name || 'Vybrat soubor…';
      };
    }

    const submitBtn = U.el('createSubjectSubmit');
    if (submitBtn) submitBtn.onclick = async () => {
      const title = U.el('newSubjectTitle')?.value?.trim();
      const slugRaw = U.el('newSubjectSlug')?.value?.trim();
      const errEl = U.el('createSubjectError');
      errEl?.classList.add('hidden');

      if (!title) {
        if (errEl) { errEl.textContent = 'Název je povinný.'; errEl.classList.remove('hidden'); }
        return;
      }
      const id = slugRaw || title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const existingCustom = _getCustomSubjects();
      if (existingCustom.find(s => s.id === id) || SUBJECTS.find(s => s.id === id)) {
        if (errEl) { errEl.textContent = `ID "${id}" je již použito.`; errEl.classList.remove('hidden'); }
        return;
      }

      let data;
      const file = fileInput?.files?.[0];
      if (file) {
        try {
          const text = await file.text();
          data = JSON.parse(text);
          if (!Array.isArray(data.questions)) throw new Error('Chybí pole "questions"');
          data.meta = { ...(data.meta || {}), title };
        } catch (e) {
          if (errEl) { errEl.textContent = 'Neplatný soubor: ' + e.message; errEl.classList.remove('hidden'); }
          return;
        }
      } else {
        data = { meta: { title, version: 1, questionCount: 0 }, categories: [], questions: [] };
      }

      try {
        existingCustom.push({ id, label: title, data });
        localStorage.setItem('nq_custom_subjects', JSON.stringify(existingCustom));
      } catch (e) {
        if (errEl) { errEl.textContent = 'Chyba ukládání (soubor může být příliš velký): ' + e.message; errEl.classList.remove('hidden'); }
        return;
      }

      if (U.el('newSubjectTitle')) U.el('newSubjectTitle').value = '';
      if (U.el('newSubjectSlug')) U.el('newSubjectSlug').value = '';
      if (fileInput) { fileInput.value = ''; if (fileLabel) fileLabel.textContent = 'Vybrat soubor…'; }
      form?.classList.add('hidden');

      St.setSetting('defaultSubject', id);
      await _loadSubject(id);
      _browseQs = [];
      R.navigate('dashboard');
      U.showToast(`Předmět "${title}" přidán`, 'success');
    };
  }

  R.navigate('dashboard');

  // ── Dashboard ────────────────────────────────────────────────

  function renderDashboard() {
    const db = St.getDB();
    if (!db) return;

    const history = App.DB.getQuizResults(10);

    _setText('statTotalQ', db.questions?.length ?? 0);
    _setText('statCategories', db.categories?.length ?? 0);
    _setText('statAttempts', history.length);
    _setText('statBestScore', history.length ? Math.max(...history.map(r => r.scorePercent ?? 0)) + '%' : '—');
    _setText('dashboardTitle', db.meta?.title || 'NetQuiz');
    _setText('subjectTitle', db.meta?.title || 'Předmět');
    _setText('subjectMeta', `${db.questions?.length ?? 0} otázek · ${db.categories?.length ?? 0} kategorií`);
    _updateSidebarStats();

    const grid = U.el('categoryGrid');
    if (grid) {
      const cats = db.categories || [];
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
          const pct = r.scorePercent ?? 0;
          const color = pct >= 75 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : pct >= 50 ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
          const date = r.finishedAt ? new Date(r.finishedAt).toLocaleDateString('cs-CZ') : '—';
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

    const totalQ = db.questions.length;
    const slider = U.el('setup-count');
    const display = U.el('setup-count-display');
    if (slider) {
      slider.max = totalQ;
      slider.value = totalQ;
      if (display) display.textContent = totalQ;
      const fresh = slider.cloneNode(true);
      slider.parentNode.replaceChild(fresh, slider);
      fresh.addEventListener('input', () => { if (display) display.textContent = fresh.value; _updateFilterCount(); });
    }

    U.setToggle(U.el('toggle-randomize'), settings.randomize);
    U.setToggle(U.el('toggle-timer'), settings.showTimer);
    _rebindBtn('toggle-randomize', function () { U.setToggle(this, !U.getToggle(this)); });
    _rebindBtn('toggle-timer', function () { U.setToggle(this, !U.getToggle(this)); });

    document.querySelectorAll('.mode-option input').forEach(radio => {
      radio.addEventListener('change', () => { _updateModeCards(); _updateFilterCount(); });
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
    let selectedMode = 'browse';
    document.querySelectorAll('.mode-option').forEach(label => {
      const radio = label.querySelector('input[type="radio"]');
      const card = label.querySelector('.mode-card');
      if (!card) return;
      const active = radio?.checked;
      if (active && radio.value) selectedMode = radio.value;
      card.className = active
        ? 'mode-card border-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 transition-all'
        : 'mode-card border-2 border-slate-200 dark:border-gray-700 rounded-xl p-4 transition-all';
    });
    const countSection = U.el('setup-count-section');
    if (countSection) countSection.classList.toggle('hidden', selectedMode === 'browse');
    const startBtn = U.el('startQuizBtn');
    if (startBtn) startBtn.textContent = selectedMode === 'browse' ? 'Procházet →' : 'Spustit test →';
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
    chip.style.opacity = cb.checked ? '1' : '0.45';
    chip.style.fontWeight = cb.checked ? '600' : '400';
  }

  function _updateFilterCount() {
    const el = U.el('filterCountDisplay');
    const db = St.getDB();
    if (!el || !db?.questions) return;

    const count = Number(U.el('setup-count')?.value || 20);
    const selCats = Array.from(document.querySelectorAll('.cat-filter:checked')).map(c => c.value).filter(Boolean);
    const selDiffs = Array.from(document.querySelectorAll('.diff-filter:checked')).map(c => c.value);
    const selSRS = Array.from(document.querySelectorAll('.srs-filter:checked')).map(c => c.value);

    let pool = [...db.questions];
    if (selCats.length) pool = pool.filter(q => selCats.includes(q.category));
    if (selDiffs.length) pool = pool.filter(q => !q.difficulty || selDiffs.includes(q.difficulty));
    if (selSRS.includes('unseen') || selSRS.includes('weak')) {
      pool = pool.filter(q => {
        const s = App.SRS.getState(q.id);
        const unseen = !s || s.timesSeen === 0;
        const weak = s && s.timesSeen > 0 && s.timesCorrect / s.timesSeen < 0.5;
        return (selSRS.includes('unseen') && unseen) || (selSRS.includes('weak') && weak);
      });
    }
    if (selSRS.includes('bookmarked')) {
      const bm = new Set(App.DB.getBookmarks());
      pool = pool.filter(q => bm.has(q.id));
    }
    if (selSRS.includes('leaked')) {
      pool = pool.filter(q => q.leaked === true);
    }

    const total = pool.length;
    const isBrowse = document.querySelector('input[name="quizMode"]:checked')?.value === 'browse';
    if (total === 0) {
      el.textContent = 'Žádné otázky neodpovídají filtru';
      el.className = 'text-center text-xs text-red-400 dark:text-red-500 -mt-3';
    } else if (isBrowse) {
      el.textContent = `${total} otázek`;
      el.className = 'text-center text-xs text-slate-400 dark:text-slate-500 -mt-3';
    } else {
      const used = Math.min(count, total);
      el.textContent = `${used} z ${total} otázek`;
      el.className = 'text-center text-xs text-slate-400 dark:text-slate-500 -mt-3';
    }
  }

  function startQuiz() {
    const db = St.getDB();
    if (!db?.questions?.length) { U.showToast('Nejsou dostupné žádné otázky.', 'error'); return; }

    const mode = document.querySelector('input[name="quizMode"]:checked')?.value || 'browse';
    const count = Number(U.el('setup-count')?.value || db.questions.length);
    const randomize = U.getToggle(U.el('toggle-randomize'));
    const showTimer = U.getToggle(U.el('toggle-timer'));

    const selCats = Array.from(document.querySelectorAll('.cat-filter:checked')).map(c => c.value).filter(Boolean);
    const selDiffs = Array.from(document.querySelectorAll('.diff-filter:checked')).map(c => c.value);
    const selSRS = Array.from(document.querySelectorAll('.srs-filter:checked')).map(c => c.value);

    let pool = [...db.questions];
    if (selCats.length) pool = pool.filter(q => selCats.includes(q.category));
    if (selDiffs.length) pool = pool.filter(q => !q.difficulty || selDiffs.includes(q.difficulty));
    if (selSRS.includes('unseen') || selSRS.includes('weak')) {
      pool = pool.filter(q => {
        const s = App.SRS.getState(q.id);
        const unseen = !s || s.timesSeen === 0;
        const weak = s && s.timesSeen > 0 && s.timesCorrect / s.timesSeen < 0.5;
        return (selSRS.includes('unseen') && unseen) || (selSRS.includes('weak') && weak);
      });
    }
    if (selSRS.includes('bookmarked')) {
      const bm = new Set(App.DB.getBookmarks());
      pool = pool.filter(q => bm.has(q.id));
    }
    if (selSRS.includes('leaked')) {
      pool = pool.filter(q => q.leaked === true);
    }
    if (!pool.length) { U.showToast('Žádné otázky pro zvolené filtry.', 'warning'); return; }

    // Browse mode: sort by category, skip count/shuffle, go to browse view
    if (mode === 'browse') {
      const catOrder = (db.categories || []).map(c => c.id);
      pool.sort((a, b) => {
        const ai = catOrder.indexOf(a.category); const bi = catOrder.indexOf(b.category);
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      });
      startBrowseMode(pool);
      return;
    }

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
    _rebindBtn('prevQuestionBtn', () => { if (QE.prev()) { _renderQuestion(); _renderNavGrid(); _updateProgress(); } });
    _rebindBtn('nextQuestionBtn', () => _handleNext());
    _rebindBtn('confirmAnswerBtn', () => _confirmAnswer());
    _rebindBtn('skipBtn', () => { QE.skip(); _handleNext(); });
    _rebindBtn('flagBtn', () => { QE.toggleFlag(); _renderFlagBtn(); _renderNavGrid(); });
    _rebindBtn('starBtn', () => { App.DB.toggleBookmark(QE.getQuestion()?.id); _renderStarBtn(); });
    _rebindBtn('quizPauseBtn', () => _handlePause());
    _rebindBtn('quizEndBtn', () => { if (confirm('Ukončit test a zobrazit výsledky?')) _finishQuiz(); });
  }

  function _renderQuestion(skipAnimation = false) {
    const session = QE.getSession();
    const q = QE.getQuestion();
    if (!q) return;
    const idx = QE.getCurrentIndex();
    const answer = QE.getAnswer();
    const revealed = QE.isRevealed();
    const mode = session.config.mode;
    const db = St.getDB();
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
      container.querySelector('#numAnswer')?.addEventListener('input', function () { QE.setAnswer(this.value ? Number(this.value) : undefined); _updateActionButtons(); });
    }
    if (type === 'text') {
      container.querySelector('#txtAnswer')?.addEventListener('input', function () { QE.setAnswer(this.value || undefined); _updateActionButtons(); });
    }
    if (type === 'open') {
      container.querySelector('#openAnswer')?.addEventListener('input', function () { QE.setAnswer(this.value || undefined); _updateActionButtons(); });
    }
  }

  function _updateActionButtons() {
    const session = QE.getSession();
    const answer = QE.getAnswer();
    const revealed = QE.isRevealed();
    const mode = session?.config?.mode;
    const idx = QE.getCurrentIndex();
    const lastIdx = (session?.questions?.length ?? 1) - 1;
    const hasAnswer = answer !== undefined && answer !== null && answer !== '' && !(Array.isArray(answer) && !answer.length);

    const confirmBtn = U.el('confirmAnswerBtn');
    const nextBtn = U.el('nextQuestionBtn');

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
    const idx = QE.getCurrentIndex();
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
    btn.classList.toggle('text-slate-300', !starred);
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
    const total = session.questions.length;
    const answered = Object.keys(session.answers).length;
    const bar = U.el('quizProgressBar');
    const text = U.el('quizProgressText');
    if (bar) bar.style.width = Math.round((answered / total) * 100) + '%';
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
    const pct = result.scorePercent;
    const grad = U.scoreGradient(pct);
    const scoreCard = U.el('resultScoreCard');
    if (scoreCard) scoreCard.className = `rounded-2xl p-8 text-white mb-8 text-center shadow-lg bg-gradient-to-br ${grad}`;
    const scoreEl = U.el('resultScore');
    if (scoreEl) { scoreEl.classList.remove('score-reveal'); void scoreEl.offsetWidth; scoreEl.classList.add('score-reveal'); }
    _setText('resultScore', pct + '%');
    _setText('resultGrade', U.gradeLabel(pct));
    _setText('resultMeta', `${result.totalQuestions} otázek · ${U.formatTime(result.elapsedSeconds)} · ${result.mode === 'exam' ? 'Zkouška' : 'Studium'}`);
    _setText('resultCorrect', parseFloat(result.totalScore.toFixed(2)));
    _setText('resultWrong', result.wrong);
    _setText('resultSkipped', result.skipped);

    const review = U.el('resultReview');
    if (review) {
      review.innerHTML = result.details.map((d, i) => C.resultReviewCard(d.question, d.answer, d.correct, i, d.score)).join('');

      const _openRatings = {}; // idx → points 0–5
      review.querySelectorAll('.open-self-rate').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          const pts = Number(btn.dataset.pts);
          _openRatings[idx] = pts;

          const group = btn.closest('.open-rate-group');
          group.querySelectorAll('.open-self-rate').forEach(b => {
            const selected = Number(b.dataset.pts) === pts;
            b.className = `open-self-rate flex-1 text-xs font-bold py-1.5 rounded-lg border-2 transition-colors ${
              selected
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'border-slate-300 dark:border-gray-600 text-slate-500 dark:text-slate-400 hover:border-orange-400 hover:text-orange-600'
            }`;
          });

          const ratedCount = Object.keys(_openRatings).length;
          const openAsCorrect = Object.values(_openRatings).reduce((s, p) => s + p, 0);
          const nonOpenAnswered = result.correct + result.wrong;
          const totalDenominator = nonOpenAnswered + ratedCount;
          const newTotal = result.totalScore + openAsCorrect;
          const newPct = totalDenominator > 0 ? Math.round((newTotal / totalDenominator) * 100) : 0;
          _setText('resultScore', newPct + '%');
          _setText('resultGrade', U.gradeLabel(newPct));
          _setText('resultCorrect', parseFloat(newTotal.toFixed(2)));
        });
      });
    }

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
    const db = St.getDB();
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

    const subjectSelect = U.el('settings-subject');
    if (subjectSelect) {
      const allSubjects = [...SUBJECTS, ..._getCustomSubjects()];
      subjectSelect.innerHTML = allSubjects.map(s => `<option value="${s.id}">${s.label}</option>`).join('') +
        '<option value="__add__">+ Přidat nový učivo…</option>';
      subjectSelect.value = settings.defaultSubject || 'site';
      const fresh = subjectSelect.cloneNode(true);
      subjectSelect.parentNode.replaceChild(fresh, subjectSelect);
      fresh.addEventListener('change', async () => {
        const selected = fresh.value;
        if (selected === '__add__') {
          R.navigate('subjects');
          fresh.value = settings.defaultSubject || 'site';
          return;
        }
        St.setSetting('defaultSubject', selected);
        await _loadSubject(selected);
        const label = allSubjects.find(s => s.id === selected)?.label || selected;
        U.showToast(`Načteno učivo "${label}"`, 'success');
      });
    }

    U.setToggle(U.el('settings-dark-toggle'), settings.darkMode);
    U.setToggle(U.el('settings-random-toggle'), settings.randomize);
    U.setToggle(U.el('settings-feedback-toggle'), settings.instantFeedback);

    _bindSettingsToggle('settings-dark-toggle', 'darkMode', val => {
      document.documentElement.classList.toggle('dark', val);
      _syncDarkModeUI();
    });
    _bindSettingsToggle('settings-random-toggle', 'randomize');
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
    fresh.addEventListener('click', function () {
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

    _adp.pool = [...db.questions];
    _adp.shownThisSession = new Map();
    _adp.mode = 'adaptive';
    _adp.sessionCount = 0;
    _adp.sessionCorrect = 0;
    _adp.sessionStreak = 0;
    _adp.currentQ = null;
    _adp.currentAnswer = null;
    _adp.revealed = false;
    _adp.finished = false;

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
    _rebindBtn('srsRevealBtn', _adaptiveReveal);
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
    let q = App.SRS.selectNext(_adp.pool, _adp.shownThisSession, _adp.mode);
    if (!q) {
      U.showToast('Vsechny otazky zobrazeny. Zkus jine sezeni!', 'info', 4000);
      _adaptiveEndSession();
      return;
    }
    if (q.type === 'single' || q.type === 'multi') {
      q = { ...q, answers: U.shuffle(q.answers) };
    }
    _adp.currentQ = q; _adp.currentAnswer = null; _adp.revealed = false; _adp.questionShownAt = Date.now();
    _renderAdaptiveQuestion(); _hideRatingPanel(); _hideWarningBanner();
    _updateSRSChips(); _updateSessionCounters();
  }

  function _renderAdaptiveQuestion() {
    const q = _adp.currentQ;
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
    if (type === 'number') { container.querySelector('#numAnswer')?.addEventListener('input', function () { _adp.currentAnswer = this.value ? Number(this.value) : null; _updateAdaptiveActionBar(); }); }
    if (type === 'text') { container.querySelector('#txtAnswer')?.addEventListener('input', function () { _adp.currentAnswer = this.value || null; _updateAdaptiveActionBar(); }); }
    if (type === 'open') { container.querySelector('#openAnswer')?.addEventListener('input', function () { _adp.currentAnswer = this.value || null; _updateAdaptiveActionBar(); }); }
  }

  function _updateAdaptiveActionBar() {
    const q = _adp.currentQ;
    const confirmed = U.el('srsConfirmBtn');
    const reveal = U.el('srsRevealBtn');
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
    const bar = U.el('srsActionBar');
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
    if (days < 7) return `${days} dni`;
    if (days < 14) return '1 tyden';
    if (days < 30) return `${Math.round(days / 7)} tydny`;
    if (days < 60) return '1 mesic';
    return `${Math.round(days / 30)} mesice`;
  }

  function _checkAntiPatterns(q) {
    const state = App.SRS.getState(q.id);
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
    _setText('srsSeenCount', _adp.sessionCount);
    _setText('srsCorrectCount', _adp.sessionCorrect);
    _setText('srsStreakDisplay', _adp.sessionStreak);
  }

  function _adaptiveEndSession() {
    _adp.finished = true;
    ['adaptiveQuestionCard', 'srsRatingPanel', 'srsActionBar', 'srsStatusChips', 'srsWarningBanner'].forEach(id => U.el(id)?.classList.add('hidden'));
    U.el('srsSessionSummary')?.classList.remove('hidden');

    const total = _adp.sessionCount;
    const correct = _adp.sessionCorrect;
    const wrong = total - correct;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    _setText('srsSummaryScore', total > 0 ? pct + '%' : '—');
    _setText('srsSummaryLabel', pct >= 80 ? 'Vyborny vykon!' : pct >= 60 ? 'Dobry vykon' : total === 0 ? 'Sezeni dokonceno' : 'Procvic slabe otazky');
    _setText('srsSummaryMeta', `${total} otazek · ${correct} spravne · ${wrong} spatne`);
    _setText('srsSummaryCorrect', correct);
    _setText('srsSummaryWrong', wrong);

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

  // Browse keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (R.getCurrent() !== 'browse') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') U.el('browseNextBtn')?.click();
    if (e.key === 'ArrowLeft') U.el('browsePrevBtn')?.click();
    if (!_browseRevealed[_browseIdx]) {
      const q = _browseQs[_browseIdx];
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1) {
        if (q?.type === 'single') document.querySelectorAll('#browseAnswersArea label[data-index]')[num - 1]?.click();
        if (q?.type === 'boolean') {
          if (num === 1) document.querySelector('#browseAnswersArea label[data-value="true"]')?.click();
          if (num === 2) document.querySelector('#browseAnswersArea label[data-value="false"]')?.click();
        }
      }
    }
  });

  // ── Browse mode ──────────────────────────────────────────────

  let _browseQs = [];
  let _browseQsAll = [];
  let _browseIdx = 0;
  let _browseRevealed = {};
  let _browseAnswers = {};
  let _browseCatStart = {}; // catId → first index
  let _browseAutoReveal = false;
  let _browseLeakedOnly = false;

  function startBrowseMode(questionsOverride) {
    const db = St.getDB();
    if (!db?.questions?.length) { U.showToast('Nejsou dostupné žádné otázky.', 'error'); return; }

    if (questionsOverride) {
      // Called from startQuiz with a pre-filtered+sorted pool
      _browseQsAll = questionsOverride;
      _browseQs = _browseLeakedOnly ? questionsOverride.filter(q => q.leaked) : questionsOverride;
      _browseIdx = 0;
      _browseRevealed = {};
      _browseAnswers = {};
      _browseCatStart = {};
      _browseQs.forEach((q, i) => { if (_browseCatStart[q.category] === undefined) _browseCatStart[q.category] = i; });
      R.navigate('browse');
    } else {
      // Called from onEnter (sidebar click) — init only if empty
      if (!_browseQsAll.length) {
        const catOrder = (db.categories || []).map(c => c.id);
        _browseQsAll = [...db.questions].sort((a, b) => {
          const ai = catOrder.indexOf(a.category); const bi = catOrder.indexOf(b.category);
          return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
        });
      }
      if (!_browseQs.length) {
        _browseQs = _browseLeakedOnly ? _browseQsAll.filter(q => q.leaked) : _browseQsAll;
        _browseCatStart = {};
        _browseQs.forEach((q, i) => { if (_browseCatStart[q.category] === undefined) _browseCatStart[q.category] = i; });
      }
      _renderBrowseView();
    }
  }

  function _renderBrowseView() {
    // Init if arrived via sidebar without startBrowseMode
    if (!_browseQs.length) { startBrowseMode(); return; }
    _renderBrowseQuestion();
    _renderBrowseCatList();

    _rebindBtn('browsePrevBtn', () => { if (_browseIdx > 0) { _browseIdx--; _renderBrowseQuestion(); _renderBrowseCatList(); } });
    _rebindBtn('browseNextBtn', () => { if (_browseIdx < _browseQs.length - 1) { _browseIdx++; _renderBrowseQuestion(); _renderBrowseCatList(); } });
    _rebindBtn('browseConfirmBtn', () => { _browseRevealed[_browseIdx] = true; _renderBrowseQuestion(); });
    _rebindBtn('browseJumpBtn', _browseJump);

    const leakedBtn = U.el('browseLeakedToggle');
    if (leakedBtn) {
      const freshL = leakedBtn.cloneNode(true);
      leakedBtn.parentNode.replaceChild(freshL, leakedBtn);
      U.setToggle(freshL, _browseLeakedOnly);
      freshL.addEventListener('click', () => {
        _browseLeakedOnly = !_browseLeakedOnly;
        U.setToggle(freshL, _browseLeakedOnly);
        _browseQs = _browseLeakedOnly ? _browseQsAll.filter(q => q.leaked) : [..._browseQsAll];
        _browseIdx = 0;
        _browseRevealed = {};
        _browseAnswers = {};
        _browseCatStart = {};
        _browseQs.forEach((q, i) => { if (_browseCatStart[q.category] === undefined) _browseCatStart[q.category] = i; });
        _renderBrowseQuestion();
        _renderBrowseCatList();
      });
    }

    const autoRevealBtn = U.el('browseAutoRevealToggle');
    if (autoRevealBtn) {
      const freshAR = autoRevealBtn.cloneNode(true);
      autoRevealBtn.parentNode.replaceChild(freshAR, autoRevealBtn);
      U.setToggle(freshAR, _browseAutoReveal);
      freshAR.addEventListener('click', () => {
        _browseAutoReveal = !_browseAutoReveal;
        U.setToggle(freshAR, _browseAutoReveal);
        _renderBrowseQuestion();
      });
    }

    const ji = U.el('browseJumpInput');
    if (ji) { const f = ji.cloneNode(true); ji.parentNode.replaceChild(f, ji); f.addEventListener('keydown', e => { if (e.key === 'Enter') _browseJump(); }); }
  }

  function _browseJump() {
    const n = parseInt(U.el('browseJumpInput')?.value, 10);
    if (!isNaN(n) && n >= 1 && n <= _browseQs.length) {
      _browseIdx = n - 1;
      _renderBrowseQuestion(); _renderBrowseCatList();
      if (U.el('browseJumpInput')) U.el('browseJumpInput').value = '';
    }
  }

  function _renderBrowseQuestion() {
    const q = _browseQs[_browseIdx];
    if (!q) return;
    const db = St.getDB();
    const catLabel = db?.categories?.find(c => c.id === q.category)?.label || q.category || '';
    const revealed = _browseAutoReveal || !!_browseRevealed[_browseIdx];
    if (_browseAutoReveal) _browseRevealed[_browseIdx] = true;
    const answer = _browseAnswers[_browseIdx];

    if (U.el('browseCatBadge')) U.el('browseCatBadge').textContent = catLabel;
    if (U.el('browseQPos')) U.el('browseQPos').textContent = `Otázka ${_browseIdx + 1} / ${_browseQs.length}`;
    if (U.el('browseCounter')) U.el('browseCounter').textContent = `${_browseIdx + 1} / ${_browseQs.length}`;

    const typeEl = U.el('browseQType');
    if (typeEl) typeEl.innerHTML = `${U.typeLabel(q.type)}<span class="ml-1.5 text-slate-400 dark:text-slate-500">${U.typeHint(q.type) || ''}</span>`;

    const diffEl = U.el('browseQDiff');
    if (diffEl) {
      if (q.difficulty) {
        const cls = { easy: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300', medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300', hard: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' };
        diffEl.className = `text-xs px-2.5 py-1 rounded-full font-medium ${cls[q.difficulty] || ''}`;
        diffEl.textContent = { easy: 'Lehká', medium: 'Střední', hard: 'Těžká' }[q.difficulty] || q.difficulty;
        diffEl.classList.remove('hidden');
      } else diffEl.classList.add('hidden');
    }
    const leakedEl = U.el('browseQLeaked');
    if (leakedEl) leakedEl.classList.toggle('hidden', !q.leaked);

    if (U.el('browseQText')) U.el('browseQText').textContent = q.question;

    const answersArea = U.el('browseAnswersArea');
    if (answersArea) { answersArea.innerHTML = C.renderAnswers(q, answer, revealed); _bindBrowseAnswerEvents(answersArea, q); }

    const feedbackArea = U.el('browseFeedbackArea');
    if (feedbackArea) {
      if (revealed) {
        if (_browseAutoReveal && answer === undefined && q.type !== 'open') {
          if (q.explanation) {
            feedbackArea.innerHTML = `<div class="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-4"><p class="text-sm text-slate-700 dark:text-slate-300">${U.escapeHtml(q.explanation)}</p></div>`;
            feedbackArea.classList.remove('hidden');
          } else { feedbackArea.innerHTML = ''; feedbackArea.classList.add('hidden'); }
        } else {
          feedbackArea.innerHTML = C.renderFeedback(QE.isCorrect(q, answer), q.explanation, q.type);
          feedbackArea.classList.remove('hidden');
        }
      } else { feedbackArea.innerHTML = ''; feedbackArea.classList.add('hidden'); }
    }

    const confirmBtn = U.el('browseConfirmBtn');
    if (confirmBtn) {
      const needsConfirm = !revealed && (q.type === 'multi' || q.type === 'text' || q.type === 'number' || q.type === 'open');
      confirmBtn.classList.toggle('hidden', !needsConfirm);
    }

    const prevBtn = U.el('browsePrevBtn');
    if (prevBtn) prevBtn.disabled = _browseIdx === 0;
  }

  function _bindBrowseAnswerEvents(container, q) {
    if (q.type === 'single' || q.type === 'boolean') {
      container.querySelectorAll('label[data-index], label[data-value]').forEach(label => {
        label.addEventListener('click', ev => {
          if (ev.target.tagName === 'INPUT') return;
          if (_browseRevealed[_browseIdx]) return;
          const input = label.querySelector('input');
          if (!input || input.disabled) return;
          _browseAnswers[_browseIdx] = q.type === 'boolean' ? label.dataset.value : Number(label.dataset.index);
          _browseRevealed[_browseIdx] = true;
          _renderBrowseQuestion();
        });
      });
    } else if (q.type === 'multi') {
      container.querySelectorAll('label[data-index]').forEach(label => {
        label.addEventListener('click', ev => {
          if (ev.target.tagName === 'INPUT') return;
          if (_browseRevealed[_browseIdx]) return;
          const i = Number(label.dataset.index);
          const sel = Array.isArray(_browseAnswers[_browseIdx]) ? [..._browseAnswers[_browseIdx]] : [];
          const pos = sel.indexOf(i);
          if (pos !== -1) sel.splice(pos, 1); else sel.push(i);
          _browseAnswers[_browseIdx] = sel;
          _renderBrowseQuestion();
        });
      });
    } else if (q.type === 'text') {
      const inp = container.querySelector('#txtAnswer');
      if (inp) inp.addEventListener('input', () => { _browseAnswers[_browseIdx] = inp.value; });
    } else if (q.type === 'number') {
      const inp = container.querySelector('#numAnswer');
      if (inp) inp.addEventListener('input', () => { _browseAnswers[_browseIdx] = Number(inp.value); });
    } else if (q.type === 'open') {
      const ta = container.querySelector('#openAnswer');
      if (ta) ta.addEventListener('input', () => { _browseAnswers[_browseIdx] = ta.value; });
    }
  }

  function _renderBrowseCatList() {
    const el = U.el('browseCatList');
    const db = St.getDB();
    if (!el || !db) return;
    const currentCat = _browseQs[_browseIdx]?.category;

    el.innerHTML = (db.categories || [])
      .filter(c => _browseCatStart[c.id] !== undefined)
      .map(c => {
        const firstIdx = _browseCatStart[c.id];
        const indices = _browseQs.reduce((acc, q, i) => { if (q.category === c.id) acc.push(i); return acc; }, []);
        const total = indices.length;
        const answered = indices.filter(i => _browseRevealed[i]).length;
        const pct = total ? Math.round(answered / total * 100) : 0;
        const isCurrent = c.id === currentCat;
        return `<button class="w-full text-left px-2 py-2 rounded-lg text-xs transition-colors ${isCurrent ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'}" data-cat-first="${firstIdx}">
          <div class="truncate leading-snug mb-1.5">${U.escapeHtml(c.label)}</div>
          <div class="flex items-center gap-1.5">
            <div class="flex-1 h-1 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full ${answered === total && total > 0 ? 'bg-emerald-500' : 'bg-orange-400'} rounded-full transition-all" style="width:${pct}%"></div>
            </div>
            <span class="text-slate-400 shrink-0 tabular-nums">${answered}/${total}</span>
          </div>
        </button>`;
      }).join('');

    el.querySelectorAll('[data-cat-first]').forEach(btn => {
      btn.addEventListener('click', () => {
        _browseIdx = Number(btn.dataset.catFirst);
        _renderBrowseQuestion(); _renderBrowseCatList();
      });
    });
  }

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
