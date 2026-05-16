// UI renderery — vracejí HTML stringy, nikdy nevolají DOM přímo
window.App = window.App || {};

App.Components = (() => {
  const U = App.Utils;

  const ICON = {
    check: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`,
    cross: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`,
  };

  const ANSWER_BASE = 'answer-option group flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer select-none transition-all duration-150';
  const ANSWER_STATES = {
    default:  'border-slate-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10',
    selected: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    correct:  'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 cursor-default',
    wrong:    'border-red-400 bg-red-50 dark:bg-red-900/20 cursor-default',
    missed:   'border-amber-400 bg-amber-50 dark:bg-amber-900/20 cursor-default',
  };

  function answerClass(state) {
    return `${ANSWER_BASE} ${ANSWER_STATES[state] || ANSWER_STATES.default}`;
  }

  function letterBadge(i, state) {
    const letter = String.fromCharCode(65 + i);
    if (state === 'correct') return `<span class="shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">${letter}</span>`;
    if (state === 'wrong')   return `<span class="shrink-0 w-6 h-6 rounded-full bg-red-400 text-white flex items-center justify-center text-xs font-bold">${letter}</span>`;
    if (state === 'selected') return `<span class="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">${letter}</span>`;
    return `<span class="shrink-0 w-6 h-6 rounded-full border-2 border-slate-300 dark:border-gray-600 text-slate-400 dark:text-slate-500 flex items-center justify-center text-xs font-bold group-hover:border-orange-400 group-hover:text-orange-500 transition-colors">${letter}</span>`;
  }

  function renderSingleChoice(question, sessionAnswer, revealed) {
    return question.answers.map((a, i) => {
      let state = 'default';
      if (revealed) {
        if (a.correct)              state = 'correct';
        else if (sessionAnswer === i) state = 'wrong';
      } else if (sessionAnswer === i) {
        state = 'selected';
      }
      const disabled = revealed ? 'pointer-events-none' : '';
      return `
        <label class="${answerClass(state)} ${disabled}" data-index="${i}">
          <input type="radio" name="sq" value="${i}" class="sr-only" ${sessionAnswer === i ? 'checked' : ''} ${revealed ? 'disabled' : ''}>
          ${letterBadge(i, state)}
          <span class="flex-1 text-sm leading-relaxed pt-0.5 ${state === 'correct' ? 'font-semibold text-emerald-700 dark:text-emerald-300' : state === 'wrong' ? 'text-red-700 dark:text-red-300' : ''}">${U.escapeHtml(a.text)}</span>
          ${!revealed ? `<kbd class="shrink-0 inline-flex items-center justify-center w-5 h-5 text-xs font-mono border border-slate-200 dark:border-gray-700 text-slate-300 dark:text-slate-600 rounded bg-white dark:bg-gray-800 group-hover:text-slate-500 group-hover:border-slate-400 transition-colors">${i + 1}</kbd>` : ''}
          ${state === 'correct' ? `<span class="shrink-0 text-emerald-500">${ICON.check}</span>` : ''}
          ${state === 'wrong'   ? `<span class="shrink-0 text-red-400">${ICON.cross}</span>` : ''}
        </label>`;
    }).join('');
  }

  function renderMultiChoice(question, sessionAnswer, revealed) {
    const sel = Array.isArray(sessionAnswer) ? sessionAnswer : [];
    return question.answers.map((a, i) => {
      let state = 'default';
      if (revealed) {
        if (a.correct && sel.includes(i))  state = 'correct';
        else if (a.correct)                state = 'missed';
        else if (sel.includes(i))          state = 'wrong';
      } else if (sel.includes(i)) {
        state = 'selected';
      }
      const checked  = sel.includes(i);
      const checkBox = checked
        ? `<span class="shrink-0 w-5 h-5 rounded border-2 border-orange-500 bg-orange-500 flex items-center justify-center text-white">${ICON.check}</span>`
        : `<span class="shrink-0 w-5 h-5 rounded border-2 border-slate-300 dark:border-gray-600 group-hover:border-orange-400 transition-colors"></span>`;
      const disabled = revealed ? 'pointer-events-none' : '';
      return `
        <label class="${answerClass(state)} ${disabled}" data-index="${i}">
          <input type="checkbox" value="${i}" class="sr-only mq" ${checked ? 'checked' : ''} ${revealed ? 'disabled' : ''}>
          ${revealed && (state === 'correct' || state === 'missed')
            ? `<span class="shrink-0 w-5 h-5 rounded border-2 ${state === 'correct' ? 'border-emerald-500 bg-emerald-500' : 'border-amber-400 bg-amber-400'} flex items-center justify-center text-white">${ICON.check}</span>`
            : checkBox}
          <span class="flex-1 text-sm leading-relaxed pt-0.5 ${state === 'correct' ? 'font-semibold text-emerald-700 dark:text-emerald-300' : state === 'missed' ? 'font-semibold text-amber-700 dark:text-amber-300' : state === 'wrong' ? 'text-red-700 dark:text-red-300' : ''}">${U.escapeHtml(a.text)}</span>
          ${state === 'missed' ? '<span class="shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">správná</span>' : ''}
          ${state === 'wrong'  ? `<span class="shrink-0 text-red-400">${ICON.cross}</span>` : ''}
        </label>`;
    }).join('');
  }

  function renderBoolean(question, sessionAnswer, revealed) {
    // Detekuje správnou hodnotu z různých formátů schématu
    let correctVal;
    if (question.answers && question.answers.length) {
      const trueAns  = question.answers.find(a => a.text === 'true'  || a.text === 'Pravda' || a.text === 'True');
      const falseAns = question.answers.find(a => a.text === 'false' || a.text === 'Nepravda' || a.text === 'False');
      if (trueAns || falseAns) {
        correctVal = (trueAns && trueAns.correct) ? 'true' : 'false';
      } else {
        const first = question.answers[0];
        correctVal  = first && first.correct ? 'true' : 'false';
      }
    } else {
      correctVal = String(question.correct ?? 'true');
    }

    return ['true', 'false'].map(val => {
      const label = val === 'true' ? 'Pravda' : 'Nepravda';
      let state = 'default';
      if (revealed) {
        if (val === correctVal)                 state = 'correct';
        else if (val === String(sessionAnswer)) state = 'wrong';
      } else if (val === String(sessionAnswer)) {
        state = 'selected';
      }
      const icon = val === 'true'
        ? `<span class="shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-bold text-sm">T</span>`
        : `<span class="shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-sm">F</span>`;
      const disabled = revealed ? 'pointer-events-none' : '';
      return `
        <label class="${answerClass(state)} items-center ${disabled}" data-value="${val}">
          <input type="radio" name="bq" value="${val}" class="sr-only" ${String(sessionAnswer) === val ? 'checked' : ''} ${revealed ? 'disabled' : ''}>
          ${icon}
          <span class="font-semibold text-sm">${label}</span>
          ${!revealed ? `<kbd class="ml-auto inline-flex items-center justify-center w-5 h-5 text-xs font-mono border border-slate-200 dark:border-gray-700 text-slate-300 dark:text-slate-600 rounded bg-white dark:bg-gray-800 group-hover:text-slate-500 group-hover:border-slate-400 transition-colors">${val === 'true' ? 1 : 2}</kbd>` : ''}
          ${state === 'correct' ? `<span class="ml-auto text-emerald-500">${ICON.check}</span>` : ''}
          ${state === 'wrong'   ? `<span class="ml-auto text-red-400">${ICON.cross}</span>` : ''}
        </label>`;
    }).join('');
  }

  function renderNumberInput(question, sessionAnswer, revealed) {
    const correctVal = question.correct ?? question.answers?.[0]?.text;
    return `
      <div class="space-y-3">
        <input type="number" id="numAnswer"
          value="${sessionAnswer != null ? U.escapeHtml(String(sessionAnswer)) : ''}"
          class="w-full border-2 ${revealed ? 'border-slate-200 dark:border-gray-700 opacity-60' : 'border-slate-200 dark:border-gray-700 focus:border-orange-400'} bg-white dark:bg-gray-800 rounded-xl px-4 py-3 text-base focus:outline-none transition-colors"
          placeholder="Zadejte číslo…" ${revealed ? 'disabled' : ''}>
        ${revealed ? `<div class="flex items-center gap-2 text-sm"><span class="text-slate-500">Správná odpověď:</span><strong class="text-emerald-600 dark:text-emerald-400">${U.escapeHtml(String(correctVal))}</strong></div>` : ''}
      </div>`;
  }

  function renderTextInput(question, sessionAnswer, revealed) {
    const correctVal = question.correct ?? question.answers?.[0]?.text;
    return `
      <div class="space-y-3">
        <input type="text" id="txtAnswer"
          value="${sessionAnswer != null ? U.escapeHtml(String(sessionAnswer)) : ''}"
          class="w-full border-2 ${revealed ? 'border-slate-200 dark:border-gray-700 opacity-60' : 'border-slate-200 dark:border-gray-700 focus:border-orange-400'} bg-white dark:bg-gray-800 rounded-xl px-4 py-3 text-base focus:outline-none transition-colors"
          placeholder="Zadejte odpověď…" ${revealed ? 'disabled' : ''}>
        ${revealed ? `<div class="flex items-center gap-2 text-sm"><span class="text-slate-500">Správná odpověď:</span><strong class="text-emerald-600 dark:text-emerald-400">${U.escapeHtml(String(correctVal))}</strong></div>` : ''}
      </div>`;
  }

  function renderOpenInput(question, sessionAnswer, revealed) {
    return `
      <div class="space-y-3">
        <textarea id="openAnswer" rows="4"
          class="w-full border-2 ${revealed ? 'border-slate-200 dark:border-gray-700 opacity-70' : 'border-slate-200 dark:border-gray-700 focus:border-orange-400'} bg-white dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors resize-none"
          placeholder="Napište svou odpověď…" ${revealed ? 'disabled' : ''}>${sessionAnswer != null ? U.escapeHtml(String(sessionAnswer)) : ''}</textarea>
        ${revealed ? '<p class="text-xs text-slate-400 italic">Otevřená otázka — porovnej svou odpověď sám.</p>' : ''}
      </div>`;
  }

  function renderAnswers(question, sessionAnswer, revealed) {
    switch (question.type) {
      case 'single':  return renderSingleChoice(question, sessionAnswer, revealed);
      case 'multi':   return renderMultiChoice(question, sessionAnswer, revealed);
      case 'boolean': return renderBoolean(question, sessionAnswer, revealed);
      case 'number':  return renderNumberInput(question, sessionAnswer, revealed);
      case 'text':    return renderTextInput(question, sessionAnswer, revealed);
      case 'open':    return renderOpenInput(question, sessionAnswer, revealed);
      default:        return `<p class="text-slate-400 text-sm">Neznámý typ otázky: ${U.escapeHtml(question.type)}</p>`;
    }
  }

  function renderFeedback(isCorrect, explanation, questionType) {
    if (questionType === 'open') {
      return `
        <div class="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
          <div class="font-semibold text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-2">ℹ Otevřená otázka</div>
          <p class="text-sm text-blue-600 dark:text-blue-400">Porovnej svou odpověď s referenční odpovědí výše.</p>
          ${explanation ? `<p class="mt-2 text-sm text-slate-700 dark:text-slate-300 border-t border-blue-200 dark:border-blue-800 pt-2">${U.escapeHtml(explanation)}</p>` : ''}
        </div>`;
    }
    const border = isCorrect
      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
    const icon  = isCorrect
      ? `<span class="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">${ICON.check}</span>`
      : `<span class="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">${ICON.cross}</span>`;
    const title = isCorrect
      ? '<span class="font-semibold text-emerald-700 dark:text-emerald-300">Správně!</span>'
      : '<span class="font-semibold text-red-700 dark:text-red-300">Špatně</span>';
    return `
      <div class="rounded-xl border p-4 ${border}">
        <div class="flex items-center gap-2 mb-1">${icon}${title}</div>
        ${explanation ? `<p class="text-sm text-slate-700 dark:text-slate-300 mt-1">${U.escapeHtml(explanation)}</p>` : ''}
      </div>`;
  }

  function navBtnClass(status) {
    const base = 'w-8 h-8 rounded-lg border text-xs font-bold transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-300';
    const s = {
      current:  `${base} bg-orange-500 border-orange-600 text-white shadow-sm`,
      answered: `${base} bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 text-emerald-700 dark:text-emerald-300`,
      flagged:  `${base} bg-amber-100 dark:bg-amber-900/40 border-amber-400 text-amber-700 dark:text-amber-300`,
      wrong:    `${base} bg-red-100 dark:bg-red-900/40 border-red-400 text-red-700 dark:text-red-300`,
      skipped:  `${base} bg-slate-100 dark:bg-gray-800 border-slate-300 dark:border-gray-600 text-slate-500 line-through`,
      default:  `${base} bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:border-orange-300`,
    };
    return s[status] || s.default;
  }

  function categoryChip(cat, count) {
    return `
      <div class="cat-pill flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 hover:border-orange-300 transition-colors cursor-pointer" data-cat="${U.escapeHtml(cat.id)}">
        <span class="text-sm font-medium">${U.escapeHtml(cat.label)}</span>
        ${count !== undefined ? `<span class="text-xs bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-semibold">${count}</span>` : ''}
      </div>`;
  }

  function resultReviewCard(q, answer, isCorrect, index) {
    const icon = isCorrect
      ? `<span class="shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">${ICON.check}</span>`
      : `<span class="shrink-0 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">${ICON.cross}</span>`;
    const border = isCorrect ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800';
    return `
      <div class="border rounded-xl p-4 ${border}">
        <div class="flex items-start gap-3">
          ${icon}
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="text-xs text-slate-400">#${index + 1}</span>
              ${U.typeBadge(q.type)}
              ${q.category ? `<span class="text-xs text-orange-600 dark:text-orange-400 font-medium">${U.escapeHtml(q.category)}</span>` : ''}
            </div>
            <p class="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">${U.escapeHtml(q.question)}</p>
            ${q.explanation ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">${U.escapeHtml(q.explanation)}</p>` : ''}
          </div>
        </div>
      </div>`;
  }

  return {
    renderAnswers, renderFeedback,
    navBtnClass, categoryChip, resultReviewCard,
  };
})();
