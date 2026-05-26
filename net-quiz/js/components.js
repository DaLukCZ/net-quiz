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
    default: 'border-slate-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10',
    selected: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    correct: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 cursor-default',
    wrong: 'border-red-400 bg-red-50 dark:bg-red-900/20 cursor-default',
    missed: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 cursor-default',
  };

  function answerClass(state) {
    return `${ANSWER_BASE} ${ANSWER_STATES[state] || ANSWER_STATES.default}`;
  }

  function letterBadge(i, state) {
    const letter = String.fromCharCode(65 + i);
    if (state === 'correct') return `<span class="shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">${letter}</span>`;
    if (state === 'wrong') return `<span class="shrink-0 w-6 h-6 rounded-full bg-red-400 text-white flex items-center justify-center text-xs font-bold">${letter}</span>`;
    if (state === 'selected') return `<span class="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">${letter}</span>`;
    return `<span class="shrink-0 w-6 h-6 rounded-full border-2 border-slate-300 dark:border-gray-600 text-slate-400 dark:text-slate-500 flex items-center justify-center text-xs font-bold group-hover:border-orange-400 group-hover:text-orange-500 transition-colors">${letter}</span>`;
  }

  function renderSingleChoice(question, sessionAnswer, revealed) {
    return question.answers.map((a, i) => {
      let state = 'default';
      if (revealed) {
        if (a.correct) state = 'correct';
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
          ${state === 'wrong' ? `<span class="shrink-0 text-red-400">${ICON.cross}</span>` : ''}
        </label>`;
    }).join('');
  }

  function renderMultiChoice(question, sessionAnswer, revealed) {
    const sel = Array.isArray(sessionAnswer) ? sessionAnswer : [];
    return question.answers.map((a, i) => {
      let state = 'default';
      if (revealed) {
        if (a.correct && sel.includes(i)) state = 'correct';
        else if (a.correct) state = 'missed';
        else if (sel.includes(i)) state = 'wrong';
      } else if (sel.includes(i)) {
        state = 'selected';
      }
      const checked = sel.includes(i);
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
          ${state === 'wrong' ? `<span class="shrink-0 text-red-400">${ICON.cross}</span>` : ''}
        </label>`;
    }).join('');
  }

  function renderBoolean(question, sessionAnswer, revealed) {
    // Detekuje správnou hodnotu z různých formátů schématu
    let correctVal;
    if (question.answers && question.answers.length) {
      const trueAns = question.answers.find(a => a.text === 'true' || a.text === 'Pravda' || a.text === 'True');
      const falseAns = question.answers.find(a => a.text === 'false' || a.text === 'Nepravda' || a.text === 'False');
      if (trueAns || falseAns) {
        correctVal = (trueAns && trueAns.correct) ? 'true' : 'false';
      } else {
        const first = question.answers[0];
        correctVal = first && first.correct ? 'true' : 'false';
      }
    } else {
      correctVal = String(question.correct ?? 'true');
    }

    return ['true', 'false'].map(val => {
      const label = val === 'true' ? 'Pravda' : 'Nepravda';
      let state = 'default';
      if (revealed) {
        if (val === correctVal) state = 'correct';
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
          ${state === 'wrong' ? `<span class="ml-auto text-red-400">${ICON.cross}</span>` : ''}
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
    const raw = question.answer;
    const bullets = raw ? (Array.isArray(raw) ? raw : [raw]) : null;
    return `
      <div class="space-y-3">
        <textarea id="openAnswer" rows="4"
          class="w-full border-2 ${revealed ? 'border-slate-200 dark:border-gray-700 opacity-70' : 'border-slate-200 dark:border-gray-700 focus:border-orange-400'} bg-white dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors resize-none"
          placeholder="Napište svou odpověď…" ${revealed ? 'disabled' : ''}>${sessionAnswer != null ? U.escapeHtml(String(sessionAnswer)) : ''}</textarea>
        ${revealed && bullets ? `
          <div class="bg-slate-50 dark:bg-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-700">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Modelová odpověď</p>
            <ul class="space-y-1.5">
              ${bullets.map(b => `<li class="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2"><span class="text-orange-500 shrink-0 mt-0.5">•</span><span>${U.escapeHtml(b)}</span></li>`).join('')}
            </ul>
          </div>` : ''}
      </div>`;
  }

  function renderFillCode(question, sessionAnswer, revealed) {
    const blanks = question.blanks || [];
    const answers = Array.isArray(sessionAnswer) ? sessionAnswer : [];
    const allWords = Array.isArray(question.wordbank) ? question.wordbank : [...blanks];

    const parts = String(question.code || '').split(/(___\d+___)/);
    const codeHtml = parts.map(part => {
      const m = part.match(/^___(\d+)___$/);
      if (!m) return U.escapeHtml(part);
      const idx = parseInt(m[1]) - 1;
      const filled = answers[idx] != null ? answers[idx] : null;
      if (revealed) {
        const correct = filled === blanks[idx];
        if (correct && filled != null) {
          return `<span class="fillcode-reveal-correct">${U.escapeHtml(filled)}</span>`;
        }
        return (filled != null ? `<span class="fillcode-reveal-wrong">${U.escapeHtml(filled)}</span>` : `<span class="fillcode-reveal-empty">(prázdné)</span>`)
          + `<span class="fillcode-reveal-solution">${U.escapeHtml(blanks[idx] ?? '')}</span>`;
      }
      return filled != null
        ? `<span class="fillcode-blank fillcode-filled" data-blank="${idx}">${U.escapeHtml(filled)}</span>`
        : `<span class="fillcode-blank fillcode-empty" data-blank="${idx}"></span>`;
    }).join('');

    return `
      <div class="fillcode-wrapper space-y-4">
        <div class="rounded-xl overflow-hidden border border-slate-700 dark:border-gray-700">
          <div class="bg-slate-800 dark:bg-gray-800 px-4 py-2 flex items-center gap-2 border-b border-slate-700 dark:border-gray-700">
            <div class="flex gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red-500/70"></span><span class="w-2.5 h-2.5 rounded-full bg-yellow-500/70"></span><span class="w-2.5 h-2.5 rounded-full bg-green-500/70"></span></div>
            <span class="text-xs text-slate-400 font-mono ml-1">code</span>
          </div>
          <pre class="bg-slate-900 dark:bg-gray-950 text-slate-100 text-sm font-mono leading-relaxed p-4 overflow-x-auto whitespace-pre-wrap">${codeHtml}</pre>
        </div>
        ${!revealed ? `
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Vyber slovo → klikni na mezeru v kódu. Kliknutím na vyplněnou mezeru ji vyčistíš.</p>
            <div class="flex flex-wrap gap-2">
              ${allWords.map((w, wi) => `<button class="fillcode-word font-mono text-xs font-semibold px-3 py-1.5 rounded-lg border-2 border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 transition-all hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20" data-word="${U.escapeHtml(w)}" data-wi="${wi}">${U.escapeHtml(w)}</button>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  }

  function renderAnswers(question, sessionAnswer, revealed) {
    switch (question.type) {
      case 'single':
      case 'image': return renderSingleChoice(question, sessionAnswer, revealed);
      case 'multi': return renderMultiChoice(question, sessionAnswer, revealed);
      case 'boolean': return renderBoolean(question, sessionAnswer, revealed);
      case 'number': return renderNumberInput(question, sessionAnswer, revealed);
      case 'text': return renderTextInput(question, sessionAnswer, revealed);
      case 'open': return renderOpenInput(question, sessionAnswer, revealed);
      case 'fillcode': return renderFillCode(question, sessionAnswer, revealed);
      default: return `<p class="text-slate-400 text-sm">Neznámý typ otázky: ${U.escapeHtml(question.type)}</p>`;
    }
  }

  function renderFeedback(isCorrect, explanation, questionType) {
    if (questionType === 'open') {
      return `
        <div class="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
          <div class="font-semibold text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-2">ℹ Otevřená otázka</div>
          <p class="text-sm text-blue-600 dark:text-blue-400">Porovnej svou odpověď s modelovou odpovědí výše.</p>
          ${explanation ? `<p class="mt-2 text-sm text-slate-700 dark:text-slate-300 border-t border-blue-200 dark:border-blue-800 pt-2">${U.escapeHtml(explanation)}</p>` : ''}
        </div>`;
    }
    const border = isCorrect
      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
    const icon = isCorrect
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
      current: `${base} bg-orange-500 border-orange-600 text-white shadow-sm`,
      answered: `${base} bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 text-emerald-700 dark:text-emerald-300`,
      wrong: `${base} bg-red-100 dark:bg-red-900/40 border-red-400 text-red-700 dark:text-red-300`,
      skipped: `${base} bg-slate-100 dark:bg-gray-800 border-slate-300 dark:border-gray-600 text-slate-500 line-through`,
      default: `${base} bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:border-orange-300`,
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

  function resultReviewCard(q, answer, isCorrect, index, score) {
    const isOpen = q.type === 'open';
    const icon = isOpen
      ? `<span class="shrink-0 w-6 h-6 rounded-full bg-blue-400 text-white flex items-center justify-center text-xs font-bold">?</span>`
      : isCorrect
        ? `<span class="shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">${ICON.check}</span>`
        : `<span class="shrink-0 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">${ICON.cross}</span>`;
    const border = isOpen
      ? 'border-blue-200 dark:border-blue-800'
      : isCorrect ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800';
    const modelBullets = isOpen && q.answer
      ? (Array.isArray(q.answer) ? q.answer : [q.answer])
      : null;
    return `
      <div class="border rounded-xl p-4 ${border}" data-review-idx="${index}">
        <div class="flex items-start gap-3">
          <span class="review-icon-${index}">${icon}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="text-xs text-slate-400">#${index + 1}</span>
              ${U.typeBadge(q.type)}
              ${q.category ? `<span class="text-xs text-orange-600 dark:text-orange-400 font-medium">${U.escapeHtml(q.category)}</span>` : ''}
              ${!isOpen && score !== undefined ? `<span class="ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${score === 1 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : score > 0 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}">${parseFloat(score.toFixed(2))} / 1 b</span>` : ''}
            </div>
            <p class="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug mt-1">${U.escapeHtml(q.question)}</p>
            ${q.type !== 'open'
              ? `<div class="flex gap-3 items-start mt-3">
                  ${q.type === 'image' && q.image ? `<img src="${U.escapeHtml(q.image)}" alt="" class="quiz-img shrink-0 w-36 min-h-16 max-h-40 object-contain rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800">` : ''}
                  <div class="flex-1 space-y-2">${renderAnswers(q, answer, true)}</div>
                 </div>`
              : ''}
            ${isOpen && answer ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 bg-slate-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5 italic">"${U.escapeHtml(String(answer))}"</p>` : ''}
            ${modelBullets ? `
              <div class="mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-800">
                <p class="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Modelová odpověď</p>
                <ul class="space-y-0.5">
                  ${modelBullets.map(b => `<li class="text-xs text-slate-600 dark:text-slate-300 flex gap-1.5"><span class="text-orange-500 shrink-0">•</span>${U.escapeHtml(b)}</li>`).join('')}
                </ul>
              </div>` : ''}
            ${isOpen && answer != null ? `
              <div class="mt-2.5 open-rate-group" data-idx="${index}">
                <p class="text-xs text-slate-400 dark:text-slate-500 mb-1.5">Ohodnoť svou odpověď (0–1 bod):</p>
                <div class="flex gap-1.5">
                  ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(p => `<button class="open-self-rate flex-1 text-xs font-bold py-1.5 rounded-lg border-2 border-slate-300 dark:border-gray-600 text-slate-500 dark:text-slate-400 hover:border-orange-400 hover:text-orange-600 transition-colors" data-idx="${index}" data-pts="${p}">${p}</button>`).join('')}
                </div>
              </div>` : ''}
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
