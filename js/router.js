// Navigace mezi views — přepíná viditelnost sekcí, zvýrazňuje sidebar
window.App = window.App || {};

App.Router = (() => {
  const VIEWS = {
    dashboard:    { label: 'Dashboard',       section: 'view-dashboard',   noSidebar: false },
    'quiz-setup': { label: 'Nastavit kvíz',   section: 'view-quiz-setup',  noSidebar: false },
    quiz:         { label: 'Kvíz',            section: 'view-quiz',        noSidebar: false },
    results:      { label: 'Výsledky',        section: 'view-results',     noSidebar: false },
    adaptive:     { label: 'Adaptivní učení', section: 'view-adaptive',    noSidebar: false },
    editor:       { label: 'Správa otázek',   section: 'view-editor',      noSidebar: false },
    stats:        { label: 'Statistiky',      section: 'view-stats',       noSidebar: false },
    'json-editor':{ label: 'JSON Editor',     section: 'view-json-editor', noSidebar: false },
    settings:     { label: 'Nastavení',       section: 'view-settings',    noSidebar: false },
    materials:    { label: 'Studijní materiály', section: 'view-materials', noSidebar: false },
    browse:       { label: 'Procházet otázky',  section: 'view-browse',    noSidebar: false },
    subjects:     { label: 'Výběr předmětu',   section: 'view-subjects',  noSidebar: false },
  };

  let _current = null;
  let _hooks   = {};

  function onEnter(viewId, fn) {
    _hooks[viewId] = fn;
  }

  function navigate(viewId, params, force) {
    const view = VIEWS[viewId];
    if (!view) { console.warn('Unknown view:', viewId); return; }
    if (_current === viewId && !force) return;

    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));

    const section = document.getElementById(view.section);
    if (section) {
      section.classList.remove('hidden');
      section.classList.add('animate-fade-in');
    }

    const bc = document.getElementById('breadcrumb');
    if (bc) bc.textContent = view.label;

    document.querySelectorAll('.nav-item').forEach(btn => {
      const active = btn.dataset.view === viewId;
      btn.classList.toggle('bg-orange-50',           active);
      btn.classList.toggle('dark:bg-orange-900/20',  active);
      btn.classList.toggle('text-orange-700',         active);
      btn.classList.toggle('dark:text-orange-300',    active);
      btn.classList.toggle('text-slate-700',          !active);
      btn.classList.toggle('dark:text-slate-300',     !active);
      const icon = btn.querySelector('svg');
      if (icon) icon.classList.toggle('text-orange-500', active);
    });

    _current = viewId;

    const timerEl = document.getElementById('topbarTimer');
    if (timerEl) {
      timerEl.classList.toggle('hidden', viewId !== 'quiz');
      timerEl.classList.toggle('flex',   viewId === 'quiz');
    }

    if (_hooks[viewId]) _hooks[viewId](params);
  }

  function getCurrent() { return _current; }

  function init() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-view]');
      if (btn) { e.preventDefault(); navigate(btn.dataset.view); }
    });
  }

  return { init, navigate, onEnter, getCurrent, VIEWS };
})();
