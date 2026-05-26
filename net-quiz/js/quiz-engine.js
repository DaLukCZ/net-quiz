// Kvíz session — stav testu, navigace, vyhodnocení odpovědí
window.App = window.App || {};

App.QuizEngine = (() => {

  let _session = null;

  function isCorrect(question, answer) {
    if (answer === undefined || answer === null || answer === '') return false;

    switch (question.type) {
      case 'single':
      case 'image': {
        const correctIdx = question.answers.findIndex(a => a.correct);
        return answer === correctIdx;
      }
      case 'multi': {
        const sel = Array.isArray(answer) ? [...answer].sort() : [];
        const correct = question.answers
          .map((a, i) => a.correct ? i : -1)
          .filter(i => i !== -1)
          .sort();
        return JSON.stringify(sel) === JSON.stringify(correct);
      }
      case 'boolean': {
        let expected;
        if (question.answers && question.answers.length) {
          const trueA = question.answers.find(a => a.text === 'true' || a.text === 'Pravda');
          const falseA = question.answers.find(a => a.text === 'false' || a.text === 'Nepravda');
          if (trueA || falseA) {
            expected = (trueA && trueA.correct) ? 'true' : 'false';
          } else {
            expected = question.answers[0]?.correct ? 'true' : 'false';
          }
        } else {
          expected = String(question.correct ?? 'true');
        }
        return String(answer) === expected;
      }
      case 'number': {
        const expected = question.correct ?? question.answers?.[0]?.text;
        return Number(answer) === Number(expected);
      }
      case 'text': {
        const expected = question.correct ?? question.answers?.[0]?.text;
        if (expected === undefined || expected === null) return false;
        const normalized = String(answer).trim().toLowerCase();
        const candidates = Array.isArray(expected) ? expected : [expected];
        return candidates.some(e => String(e).trim().toLowerCase() === normalized);
      }
      case 'fillcode': {
        if (!Array.isArray(answer)) return false;
        const blanks = question.blanks || [];
        if (answer.length !== blanks.length) return false;
        return answer.every((a, i) => a === blanks[i]);
      }
      case 'open':
        return true;
      default:
        return false;
    }
  }

  function start(questions, options = {}) {
    const config = {
      mode: options.mode || 'study',
      instantFeedback: options.mode === 'study',
      totalQuestions: questions.length,
    };

    _session = {
      config,
      questions,
      currentIndex: 0,
      answers: {},
      revealed: {},
      skipped: new Set(),
      paused: false,
      finished: false,
      startedAt: Date.now(),
    };

    return _session;
  }

  function getSession() { return _session; }
  function getQuestion(i) { return _session ? _session.questions[i ?? _session.currentIndex] : null; }
  function getCurrentIndex() { return _session ? _session.currentIndex : 0; }
  function getAnswer(i) { return _session ? _session.answers[i ?? _session.currentIndex] : undefined; }
  function isRevealed(i) { return _session ? !!_session.revealed[i ?? _session.currentIndex] : false; }

  function setAnswer(answer) {
    if (!_session || _session.finished) return;
    _session.answers[_session.currentIndex] = answer;
    _session.skipped.delete(_session.currentIndex);
  }

  function reveal() {
    if (!_session) return;
    _session.revealed[_session.currentIndex] = true;
  }

  function skip() {
    if (!_session) return;
    const i = _session.currentIndex;
    _session.skipped.add(i);
    delete _session.answers[i];
  }

  function goTo(i) {
    if (!_session) return false;
    if (i < 0 || i >= _session.questions.length) return false;
    _session.currentIndex = i;
    return true;
  }

  function next() { return goTo(_session.currentIndex + 1); }
  function prev() { return goTo(_session.currentIndex - 1); }

  function togglePause() {
    if (!_session) return;
    _session.paused = !_session.paused;
    return _session.paused;
  }

  function navStatus(i) {
    if (!_session) return 'default';
    if (i === _session.currentIndex) return 'current';
    if (_session.skipped.has(i)) return 'skipped';
    if (_session.answers[i] !== undefined) {
      if (_session.revealed[i]) {
        return isCorrect(_session.questions[i], _session.answers[i]) ? 'answered' : 'wrong';
      }
      return 'answered';
    }
    return 'default';
  }

  function scoreQuestion(question, answer) {
    if (answer === undefined || answer === null || answer === '') return 0;
    switch (question.type) {
      case 'single':
      case 'image':
      case 'boolean':
      case 'number':
      case 'text':
        return isCorrect(question, answer) ? 1 : 0;
      case 'multi': {
        const sel = Array.isArray(answer) ? answer : [];
        const correctIndices = question.answers
          .map((a, i) => a.correct ? i : -1)
          .filter(i => i !== -1);
        const numCorrect = correctIndices.length;
        if (numCorrect === 0) return 0;
        const pointPerCorrect = 1 / numCorrect;
        let score = 0;
        for (const i of sel) {
          if (question.answers[i]?.correct) score += pointPerCorrect;
          else score -= 0.5;
        }
        return Math.max(0, Math.min(1, score));
      }
      case 'fillcode': {
        if (!Array.isArray(answer)) return 0;
        const blanks = question.blanks || [];
        if (!blanks.length) return 0;
        const correct = answer.reduce((sum, a, i) => sum + (a === blanks[i] ? 1 : 0), 0);
        return correct / blanks.length;
      }
      default:
        return 0;
    }
  }

  function submit() {
    if (!_session) return null;
    _session.finished = true;

    let correctCount = 0;
    let wrongCount = 0;
    let openCount = 0;
    let totalScore = 0;
    const skippedCount = _session.skipped.size;

    const details = _session.questions.map((q, i) => {
      const ans = _session.answers[i];
      const answered = ans !== undefined;
      const skipped = _session.skipped.has(i);
      const correct = answered && !skipped ? isCorrect(q, ans) : null;
      const qScore = answered && !skipped && q.type !== 'open' ? scoreQuestion(q, ans) : 0;
      const isOpen = q.type === 'open';

      if (isOpen && answered) openCount++;
      else if (correct === true) correctCount++;
      else if (correct === false) wrongCount++;

      if (!isOpen && answered && !skipped) totalScore += qScore;

      return { question: q, answer: ans, correct, score: qScore, skipped, index: i };
    });

    const scoreable = _session.questions.filter(q => q.type !== 'open').length;
    const pct = scoreable > 0 ? Math.round((totalScore / scoreable) * 100) : 0;

    return {
      mode: _session.config.mode,
      totalQuestions: _session.questions.length,
      scorePercent: pct,
      correct: correctCount,
      wrong: wrongCount,
      skipped: skippedCount,
      openAnswered: openCount,
      totalScore,
      details,
      finishedAt: Date.now(),
    };
  }

  function destroy() {
    _session = null;
  }

  return {
    isCorrect, start,
    getSession, getQuestion, getCurrentIndex, getAnswer, isRevealed,
    setAnswer, reveal, skip,
    goTo, next, prev, togglePause,
    navStatus, submit, destroy,
  };
})();
