// Helpers — stateless utility funkce bez vedlejších efektů
window.App = window.App || {};

App.Utils = (() => {

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function truncate(str, maxLen = 90) {
    if (!str) return '';
    const s = String(str);
    return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
  }

  const TYPE_META = {
    single:  { label: 'Single',  cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
    multi:   { label: 'Multi',   cls: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800' },
    boolean: { label: 'Bool',    cls: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800' },
    number:  { label: 'Number',  cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
    text:    { label: 'Text',    cls: 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800' },
    open:    { label: 'Open',    cls: 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-gray-700' },
  };

  const DIFF_META = {
    easy:   { label: 'Lehká',   cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
    medium: { label: 'Střední', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
    hard:   { label: 'Těžká',   cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
  };

  function typeBadge(type) {
    const t = TYPE_META[type] || TYPE_META.open;
    return `<span class="inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${t.cls}">${t.label}</span>`;
  }

  function difficultyBadge(diff) {
    if (!diff) return '<span class="text-xs text-slate-400">—</span>';
    const d = DIFF_META[diff];
    if (!d) return '<span class="text-xs text-slate-400">—</span>';
    return `<span class="inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${d.cls}">${d.label}</span>`;
  }

  function typeLabel(type) {
    const map = { single: 'Single choice', multi: 'Multi choice', boolean: 'Boolean', number: 'Number', text: 'Text', open: 'Otevřená', image: 'Poznej obrázek' };
    return map[type] || type;
  }

  function typeHint(type) {
    const map = {
      single:  'Vyber jednu správnou odpověď',
      multi:   'Vyber všechny správné odpovědi',
      boolean: 'Pravda nebo nepravda?',
      number:  'Zadej číslo',
      text:    'Zadej text',
      open:    'Napiš vlastní odpověď',
      image:   'Vyber správný popis obrázku',
    };
    return map[type] || '';
  }

  function scoreGradient(pct) {
    if (pct >= 85) return 'from-emerald-500 to-emerald-700';
    if (pct >= 60) return 'from-orange-500 to-orange-700';
    if (pct >= 40) return 'from-amber-500 to-amber-700';
    return 'from-red-500 to-red-700';
  }

  function gradeLabel(pct) {
    if (pct >= 90) return 'Výborně! 🎉';
    if (pct >= 75) return 'Velmi dobře';
    if (pct >= 60) return 'Dobře';
    if (pct >= 50) return 'Dostatečně';
    return 'Nedostatečně';
  }

  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const colors = {
      success: 'bg-emerald-600',
      error:   'bg-red-600',
      info:    'bg-slate-800 dark:bg-slate-700',
      warning: 'bg-amber-500',
    };
    const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto ${colors[type] || colors.info} text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 translate-y-2 opacity-0 transition-all duration-200 max-w-xs`;
    toast.innerHTML = `<span class="shrink-0 text-base">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.remove('translate-y-2', 'opacity-0'); });
    setTimeout(() => {
      toast.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function generateId() {
    return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function debounce(fn, delay = 250) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  function el(id) { return document.getElementById(id); }

  function setToggle(btn, value) {
    if (!btn) return;
    const knob = btn.querySelector('.toggle-knob');
    btn.setAttribute('aria-checked', String(value));
    if (value) {
      btn.classList.remove('bg-slate-200');
      btn.classList.add('bg-orange-500');
      if (knob) { knob.classList.add('translate-x-4'); knob.classList.remove('translate-x-0'); }
    } else {
      btn.classList.remove('bg-orange-500');
      btn.classList.add('bg-slate-200');
      if (knob) knob.classList.remove('translate-x-4');
    }
  }

  function getToggle(btn) {
    return btn ? btn.getAttribute('aria-checked') === 'true' : false;
  }

  return {
    shuffle, formatTime, escapeHtml, truncate,
    typeBadge, difficultyBadge, typeLabel, typeHint,
    scoreGradient, gradeLabel,
    showToast, downloadJSON, generateId, debounce,
    el, setToggle, getToggle,
  };
})();
