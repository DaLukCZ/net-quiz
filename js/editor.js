// Editor otázek — tabulka, CRUD, vyhledávání, stránkování, drag & drop
window.App = window.App || {};

App.Editor = (() => {
  const U = App.Utils;

  // Stav filtrů, řazení a stránkování
  const state = {
    search: '',
    typeFilter: '',
    catFilter: '',
    sortKey: 'id',
    sortDir: 1,    // 1 = asc, -1 = desc
    page: 0,
    pageSize: 25,
    selected: new Set(),
    editingId: null,   // null = new, string = editing
    deleteId: null,
  };

  // Filtrovaný seznam (cache — přepočítá se jen při refresh)
  let _filtered = [];

  // Init
  function init() {
    _bindControls();
    render();
  }

  function refresh() {
    _rebuildFiltered();
    _renderTable();
    _renderPagination();
    _updateBulkBar();
  }

  function render() {
    _populateCategoryFilter();
    refresh();
  }

  function _populateCategoryFilter() {
    const db = App.State.getDB();
    const sel = U.el('editorCatFilter');
    if (!sel || !db) return;
    const cats = db.categories || [];
    sel.innerHTML = '<option value="">Všechny kategorie</option>' +
      cats.map(c => `<option value="${U.escapeHtml(c.id)}">${U.escapeHtml(c.label)}</option>`).join('');
  }

  function _bindControls() {
    const searchInput = U.el('editorSearch');
    if (searchInput) {
      searchInput.addEventListener('input', U.debounce(() => {
        state.search = searchInput.value.trim().toLowerCase();
        state.page = 0;
        refresh();
      }, 200));
    }

    const typeFilter = U.el('editorTypeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', () => {
        state.typeFilter = typeFilter.value;
        state.page = 0;
        refresh();
      });
    }

    const catFilter = U.el('editorCatFilter');
    if (catFilter) {
      catFilter.addEventListener('change', () => {
        state.catFilter = catFilter.value;
        state.page = 0;
        refresh();
      });
    }

    // Sort headers
    document.querySelectorAll('#editorTable [data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) state.sortDir *= -1;
        else { state.sortKey = key; state.sortDir = 1; }
        refresh();
      });
    });

    // Select all
    const selAll = U.el('editorSelectAll');
    if (selAll) {
      selAll.addEventListener('change', () => {
        if (selAll.checked) _filtered.slice(state.page * state.pageSize, (state.page + 1) * state.pageSize).forEach(q => state.selected.add(q.id));
        else _filtered.slice(state.page * state.pageSize, (state.page + 1) * state.pageSize).forEach(q => state.selected.delete(q.id));
        _renderTable();
        _updateBulkBar();
      });
    }

    // Pagination
    U.el('editorPagPrev')?.addEventListener('click', () => { if (state.page > 0) { state.page--; refresh(); } });
    U.el('editorPagNext')?.addEventListener('click', () => {
      const maxPage = Math.max(0, Math.ceil(_filtered.length / state.pageSize) - 1);
      if (state.page < maxPage) { state.page++; refresh(); }
    });

    // Add button
    U.el('editorAddBtn')?.addEventListener('click', () => _openModal(null));

    // Import / Export
    U.el('editorImportBtn')?.addEventListener('click', () => U.el('jsonImportInput')?.click());
    U.el('editorExportBtn')?.addEventListener('click', () => {
      const db = App.State.getDB();
      if (db) U.downloadJSON(db, 'questions.json');
    });

    // File import
    U.el('jsonImportInput')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed.questions) throw new Error('Chybí pole questions');
        App.State.setDB(parsed);
        refresh();
        U.showToast('Import úspěšný — ' + parsed.questions.length + ' otázek', 'success');
      } catch (err) {
        U.showToast('Import selhal: ' + err.message, 'error');
      }
      e.target.value = '';
    });

    // Bulk actions
    U.el('editorBulkDelete')?.addEventListener('click', _bulkDelete);
    U.el('editorBulkClearSel')?.addEventListener('click', () => { state.selected.clear(); _renderTable(); _updateBulkBar(); });

    // Modal events
    U.el('modalClose')?.addEventListener('click', _closeModal);
    U.el('modalCancelBtn')?.addEventListener('click', _closeModal);
    U.el('questionModalBackdrop')?.addEventListener('click', _closeModal);
    U.el('modalSaveBtn')?.addEventListener('click', _saveQuestion);
    U.el('addAnswerBtn')?.addEventListener('click', _addAnswerRow);

    // Dynamic type change in form
    U.el('form-type')?.addEventListener('change', _updateAnswerSection);

    // Delete modal
    U.el('deleteModalCancel')?.addEventListener('click', () => _closeDeleteModal());
    U.el('deleteModalConfirm')?.addEventListener('click', _confirmDelete);
  }

  function _rebuildFiltered() {
    const db = App.State.getDB();
    if (!db || !db.questions) { _filtered = []; return; }

    let qs = db.questions;

    if (state.typeFilter) qs = qs.filter(q => q.type === state.typeFilter);
    if (state.catFilter)  qs = qs.filter(q => q.category === state.catFilter);
    if (state.search) {
      const s = state.search;
      qs = qs.filter(q =>
        (q.question || '').toLowerCase().includes(s) ||
        (q.category || '').toLowerCase().includes(s) ||
        (q.id || '').toLowerCase().includes(s) ||
        (q.tags || []).some(t => t.toLowerCase().includes(s))
      );
    }

    // Sort
    qs = [...qs].sort((a, b) => {
      let av = a[state.sortKey] ?? '';
      let bv = b[state.sortKey] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return -1 * state.sortDir;
      if (av > bv) return 1 * state.sortDir;
      return 0;
    });

    _filtered = qs;
  }

  function _renderTable() {
    const tbody = U.el('editorTableBody');
    if (!tbody) return;
    const db = App.State.getDB();
    const cats = db?.categories || [];

    if (!_filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-16 text-center text-slate-400">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <p class="font-medium">Žádné otázky</p>
        <p class="text-sm mt-1">Přidej otázky nebo uprav filtry.</p>
      </td></tr>`;
      return;
    }

    const start = state.page * state.pageSize;
    const page  = _filtered.slice(start, start + state.pageSize);
    const catMap = Object.fromEntries(cats.map(c => [c.id, c.label]));

    tbody.innerHTML = page.map(q => {
      const catLabel = catMap[q.category] || q.category || '—';
      const checked  = state.selected.has(q.id);
      return `
        <tr class="table-row hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors" data-id="${U.escapeHtml(q.id)}">
          <td class="px-4 py-3"><input type="checkbox" class="row-check rounded accent-orange-500" data-id="${U.escapeHtml(q.id)}" ${checked ? 'checked' : ''}></td>
          <td class="px-4 py-3 text-xs text-slate-400 font-mono">${U.escapeHtml(String(q.id || '').slice(0, 12))}</td>
          <td class="px-4 py-3">${U.typeBadge(q.type)}</td>
          <td class="px-4 py-3"><span class="text-xs font-medium text-orange-600 dark:text-orange-400">${U.escapeHtml(catLabel)}</span></td>
          <td class="px-4 py-3">${U.difficultyBadge(q.difficulty)}</td>
          <td class="px-4 py-3 max-w-xs">
            <p class="text-sm text-slate-700 dark:text-slate-300 truncate">${U.escapeHtml(U.truncate(q.question, 80))}</p>
            ${q.tags?.length ? `<div class="flex gap-1 mt-1 flex-wrap">${q.tags.map(t => `<span class="text-xs bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">${U.escapeHtml(t)}</span>`).join('')}</div>` : ''}
          </td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-1">
              <button class="action-edit p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-600 transition-colors" data-id="${U.escapeHtml(q.id)}" title="Upravit">
                <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button class="action-dupe p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-400 hover:text-amber-600 transition-colors" data-id="${U.escapeHtml(q.id)}" title="Duplikovat">
                <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              </button>
              <button class="action-delete p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 transition-colors" data-id="${U.escapeHtml(q.id)}" title="Smazat">
                <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    // Row checkbox events
    tbody.querySelectorAll('.row-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id;
        if (cb.checked) state.selected.add(id);
        else state.selected.delete(id);
        _updateBulkBar();
      });
    });

    // Action button events
    tbody.querySelectorAll('.action-edit').forEach(btn => {
      btn.addEventListener('click', () => _openModal(btn.dataset.id));
    });
    tbody.querySelectorAll('.action-dupe').forEach(btn => {
      btn.addEventListener('click', () => _duplicateQuestion(btn.dataset.id));
    });
    tbody.querySelectorAll('.action-delete').forEach(btn => {
      btn.addEventListener('click', () => _openDeleteModal(btn.dataset.id));
    });
  }

  function _renderPagination() {
    const total   = _filtered.length;
    const maxPage = Math.max(0, Math.ceil(total / state.pageSize) - 1);
    const start   = state.page * state.pageSize + 1;
    const end     = Math.min((state.page + 1) * state.pageSize, total);

    const info = U.el('editorPagInfo');
    if (info) info.textContent = total ? `Zobrazuji ${start}–${end} z ${total}` : 'Žádné výsledky';

    const prev = U.el('editorPagPrev');
    const next = U.el('editorPagNext');
    if (prev) prev.disabled = state.page === 0;
    if (next) next.disabled = state.page >= maxPage;

    const pages = U.el('editorPagPages');
    if (!pages) return;
    const totalPages = maxPage + 1;
    let html = '';
    for (let i = 0; i < Math.min(totalPages, 7); i++) {
      const p = totalPages <= 7 ? i : (i === 6 ? maxPage : i);
      const active = p === state.page;
      html += `<button class="pag-btn w-8 h-8 rounded-lg text-xs font-medium ${active ? 'bg-orange-500 text-white' : 'border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-600 dark:text-slate-400'} transition-colors" data-page="${p}">${p + 1}</button>`;
    }
    pages.innerHTML = html;
    pages.querySelectorAll('.pag-btn').forEach(btn => {
      btn.addEventListener('click', () => { state.page = Number(btn.dataset.page); refresh(); });
    });
  }

  function _updateBulkBar() {
    const bar = U.el('editorBulkBar');
    const cnt = U.el('editorBulkCount');
    if (!bar) return;
    const n = state.selected.size;
    if (n > 0) {
      bar.classList.remove('hidden');
      bar.classList.add('flex');
      if (cnt) cnt.textContent = n + ' vybráno';
    } else {
      bar.classList.add('hidden');
      bar.classList.remove('flex');
    }
  }

  // CRUD
  function _duplicateQuestion(id) {
    const db = App.State.getDB();
    if (!db) return;
    const q = db.questions.find(q => q.id === id);
    if (!q) return;
    const dupe = { ...q, answers: q.answers ? q.answers.map(a => ({ ...a })) : undefined, id: undefined };
    App.DB.upsertQuestion(dupe);
    refresh();
    U.showToast('Otázka duplikována', 'success');
  }

  function _bulkDelete() {
    if (!state.selected.size) return;
    if (!confirm(`Smazat ${state.selected.size} otázek? Akce je nevratná.`)) return;
    App.DB.deleteQuestions([...state.selected]);
    state.selected.clear();
    state.page = 0;
    refresh();
    U.showToast('Otázky smazány', 'success');
  }

  // Modál
  function _openModal(id) {
    state.editingId = id;
    const modal = U.el('questionModal');
    if (!modal) return;

    // Populate category select
    const db = App.State.getDB();
    const cats = db?.categories || [];
    const catSel = U.el('form-category');
    if (catSel) {
      catSel.innerHTML = cats.map(c => `<option value="${U.escapeHtml(c.id)}">${U.escapeHtml(c.label)}</option>`).join('');
    }

    if (id) {
      // Edit mode
      U.el('modalTitle').textContent = 'Upravit otázku';
      const q = db.questions.find(q => q.id === id);
      if (q) _fillForm(q);
    } else {
      // Create mode
      U.el('modalTitle').textContent = 'Přidat otázku';
      U.el('questionForm')?.reset();
      _updateAnswerSection();
    }

    U.el('formValidation')?.classList.add('hidden');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function _closeModal() {
    const modal = U.el('questionModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    state.editingId = null;
  }

  function _fillForm(q) {
    const f = (id, val) => { const el = U.el(id); if (el) el.value = val ?? ''; };
    f('form-type', q.type);
    f('form-category', q.category || '');
    f('form-difficulty', q.difficulty || '');
    f('form-time', q.timeEstimate || '');
    f('form-question', q.question);
    f('form-explanation', q.explanation || '');
    f('form-tags', (q.tags || []).join(', '));
    _updateAnswerSection(q);
  }

  function _updateAnswerSection(existingQ) {
    const type = U.el('form-type')?.value;
    const section = U.el('form-answers-section');
    const list    = U.el('form-answers-list');
    const addBtn  = U.el('addAnswerBtn');
    if (!section || !list) return;

    const hiddenTypes = ['boolean', 'open'];
    if (hiddenTypes.includes(type)) {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');
    if (addBtn) addBtn.style.display = (type === 'number' || type === 'text') ? 'none' : '';

    list.innerHTML = '';

    if (type === 'number' || type === 'text') {
      // Single correct answer field
      const val = existingQ ? (existingQ.correct ?? existingQ.answers?.[0]?.text ?? '') : '';
      list.innerHTML = `
        <div class="flex items-center gap-2">
          <input type="text" class="answer-correct-val flex-1 border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" placeholder="Správná hodnota…" value="${U.escapeHtml(String(val))}">
        </div>`;
      return;
    }

    // Single / Multi — render answer rows
    const answers = existingQ?.answers || [{ text: '', correct: false }];
    answers.forEach((a, i) => _addAnswerRow(null, a, i));
    if (!existingQ) _addAnswerRow(); // 2nd empty row by default
  }

  function _addAnswerRow(e, existingAnswer, existingIndex) {
    const list = U.el('form-answers-list');
    if (!list) return;
    const isMulti = U.el('form-type')?.value === 'multi';
    const idx = list.querySelectorAll('.answer-row').length;
    const val = existingAnswer ? U.escapeHtml(existingAnswer.text) : '';
    const chk = existingAnswer?.correct ? 'checked' : '';

    const row = document.createElement('div');
    row.className = 'answer-row flex items-center gap-2 group';
    row.innerHTML = `
      <span class="drag-handle text-slate-300 dark:text-gray-600 cursor-grab select-none px-1">⠿</span>
      <input type="text" class="flex-1 border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" placeholder="Text odpovědi…" value="${val}">
      <label class="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0 cursor-pointer">
        <input type="${isMulti ? 'checkbox' : 'radio'}" name="answer-correct" class="accent-orange-500 correct-mark" ${chk}>
        Správná
      </label>
      <button type="button" class="remove-answer p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>`;
    row.querySelector('.remove-answer').addEventListener('click', () => {
      if (list.querySelectorAll('.answer-row').length > 1) row.remove();
    });
    list.appendChild(row);
    _setupDragDrop(list);
  }

  function _setupDragDrop(list) {
    // Simple drag-to-reorder for answer rows
    let dragSrc = null;
    list.querySelectorAll('.drag-handle').forEach(handle => {
      const row = handle.closest('.answer-row');
      row.draggable = true;
      row.addEventListener('dragstart', () => { dragSrc = row; row.classList.add('opacity-50'); });
      row.addEventListener('dragend', () => { dragSrc = null; row.classList.remove('opacity-50'); list.querySelectorAll('.answer-row').forEach(r => r.classList.remove('drag-over')); });
      row.addEventListener('dragover', e => { e.preventDefault(); if (row !== dragSrc) row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => {
        e.preventDefault(); row.classList.remove('drag-over');
        if (dragSrc && dragSrc !== row) list.insertBefore(dragSrc, row);
      });
    });
  }

  function _saveQuestion() {
    const validation = U.el('formValidation');
    if (validation) validation.classList.add('hidden');

    const type        = U.el('form-type')?.value;
    const category    = U.el('form-category')?.value;
    const difficulty  = U.el('form-difficulty')?.value;
    const timeEst     = U.el('form-time')?.value;
    const question    = U.el('form-question')?.value?.trim();
    const explanation = U.el('form-explanation')?.value?.trim();
    const tagsRaw     = U.el('form-tags')?.value?.trim();

    if (!question) { _showFormError('Otázka nesmí být prázdná.'); return; }
    if (!category) { _showFormError('Vyberte kategorii.'); return; }

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    let answers;
    if (type === 'boolean') {
      answers = undefined;
    } else if (type === 'number' || type === 'text') {
      const val = U.el('form-answers-list')?.querySelector('.answer-correct-val')?.value?.trim();
      if (!val) { _showFormError('Zadejte správnou odpověď.'); return; }
      answers = [{ text: val, correct: true }];
    } else if (type !== 'open') {
      const rows = U.el('form-answers-list')?.querySelectorAll('.answer-row') || [];
      answers = Array.from(rows).map(row => ({
        text: row.querySelector('input[type="text"]')?.value?.trim() || '',
        correct: !!row.querySelector('.correct-mark')?.checked,
      }));
      if (answers.some(a => !a.text)) { _showFormError('Všechny odpovědi musí mít text.'); return; }
      if (!answers.some(a => a.correct)) { _showFormError('Označte alespoň jednu správnou odpověď.'); return; }
    }

    const db = App.State.getDB();
    if (!db) return;

    const qObj = {
      id:          state.editingId || undefined,
      type, category,
      difficulty:  difficulty || undefined,
      timeEstimate: timeEst ? Number(timeEst) : undefined,
      question, answers,
      explanation: explanation || undefined,
      tags:        tags.length ? tags : undefined,
    };

    App.DB.upsertQuestion(qObj);
    _closeModal();
    refresh();
    U.showToast(state.editingId ? 'Otázka aktualizována' : 'Otázka přidána', 'success');
  }

  function _showFormError(msg) {
    const el = U.el('formValidation');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  }

  // Delete
  function _openDeleteModal(id) {
    state.deleteId = id;
    const modal = U.el('deleteModal');
    if (!modal) return;
    const db = App.State.getDB();
    const q = db?.questions.find(q => q.id === id);
    const text = U.el('deleteModalText');
    if (text && q) text.textContent = U.truncate(q.question, 60);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function _closeDeleteModal() {
    const modal = U.el('deleteModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    state.deleteId = null;
  }

  function _confirmDelete() {
    if (!state.deleteId) return;
    App.DB.deleteQuestion(state.deleteId);
    _closeDeleteModal();
    refresh();
    U.showToast('Otázka smazána', 'info');
  }

  return { init, render, refresh };
})();
