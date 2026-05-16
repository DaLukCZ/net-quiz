// Kvíz session — stav testu, navigace, vyhodnocení odpovědí
window.App = window.App || {};

App.QuizEngine = (() => {

  let _session = null;
  let _timerInterval = null;

  function isCorrect(question, answer) {
    if (answer === undefined || answer === null || answer === '') return false;

    switch (question.type) {
      case 'single': {
        const correctIdx = question.answers.findIndex(a => a.correct);
        return answer === correctIdx;
      }
      case 'multi': {
        const sel     = Array.isArray(answer) ? [...answer].sort() : [];
        const correct = question.answers
          .map((a, i) => a.correct ? i : -1)
          .filter(i => i !== -1)
          .sort();
        return JSON.stringify(sel) === JSON.stringify(correct);
      }
      case 'boolean': {
        let expected;
        if (question.answers && question.answers.length) {
          const trueA  = question.answers.find(a => a.text === 'true'  || a.text === 'Pravda');
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
      case 'open':
        return true;
      default:
        return false;
    }
  }

  function start(questions, options = {}) {
    const config = {
      mode:            options.mode || 'study',
      instantFeedback: options.mode === 'study',
      showTimer:       options.showTimer !== false,
      totalQuestions:  questions.length,
    };

    _session = {
      config,
      questions,
      currentIndex: 0,
      answers:  {},
      revealed: {},
      flagged:  new Set(),
      skipped:  new Set(),
      elapsedSeconds: 0,
      paused:   false,
      finished: false,
      startedAt: Date.now(),
    };

    if (config.showTimer) _startTimer();
    return _session;
  }

  function _startTimer() {
    clearInterval(_timerInterval);
    _timerInterval = setInterval(() => {
      if (_session && !_session.paused && !_session.finished) {
        _session.elapsedSeconds++;
        _notifyTimer();
      }
    }, 1000);
  }

  let _timerCallback = null;
  function onTimer(fn) { _timerCallback = fn; }
  function _notifyTimer() { if (_timerCallback) _timerCallback(_session.elapsedSeconds); }

  function getSession()      { return _session; }
  function getQuestion(i)    { return _session ? _session.questions[i ?? _session.currentIndex] : null; }
  function getCurrentIndex() { return _session ? _session.currentIndex : 0; }
  function getAnswer(i)      { return _session ? _session.answers[i ?? _session.currentIndex] : undefined; }
  function isRevealed(i)     { return _session ? !!_session.revealed[i ?? _session.currentIndex] : false; }
  function isFlagged(i)      { return _session ? _session.flagged.has(i ?? _session.currentIndex) : false; }

  function setAnswer(answer) {
    if (!_session || _session.finished) return;
    _session.answers[_session.currentIndex] = answer;
    _session.skipped.delete(_session.currentIndex);
  }

  function reveal() {
    if (!_session) return;
    _session.revealed[_session.currentIndex] = true;
  }

  function toggleFlag() {
    if (!_session) return;
    const i = _session.currentIndex;
    if (_session.flagged.has(i)) _session.flagged.delete(i);
    else _session.flagged.add(i);
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
    if (i === _session.currentIndex)   return 'current';
    if (_session.flagged.has(i))       return 'flagged';
    if (_session.skipped.has(i))       return 'skipped';
    if (_session.answers[i] !== undefined) {
      if (_session.revealed[i]) {
        return isCorrect(_session.questions[i], _session.answers[i]) ? 'answered' : 'wrong';
      }
      return 'answered';
    }
    return 'default';
  }

  function submit() {
    if (!_session) return null;
    clearInterval(_timerInterval);
    _session.finished = true;

    let correctCount = 0;
    let wrongCount   = 0;
    let openCount    = 0;
    const skippedCount = _session.skipped.size;

    const details = _session.questions.map((q, i) => {
      const ans     = _session.answers[i];
      const answered = ans !== undefined;
      const skipped  = _session.skipped.has(i);
      const correct  = answered && !skipped ? isCorrect(q, ans) : null;
      const isOpen   = q.type === 'open';

      if (isOpen && answered) openCount++;
      else if (correct === true)  correctCount++;
      else if (correct === false) wrongCount++;

      return { question: q, answer: ans, correct, skipped, flagged: _session.flagged.has(i), index: i };
    });

    const scoreable = _session.questions.filter(q => q.type !== 'open').length;
    const pct = scoreable > 0 ? Math.round((correctCount / scoreable) * 100) : 0;

    return {
      mode:           _session.config.mode,
      totalQuestions: _session.questions.length,
      scorePercent:   pct,
      correct:        correctCount,
      wrong:          wrongCount,
      skipped:        skippedCount,
      openAnswered:   openCount,
      elapsedSeconds: _session.elapsedSeconds,
      details,
      finishedAt:     Date.now(),
    };
  }

  function destroy() {
    clearInterval(_timerInterval);
    _session = null;
    _timerCallback = null;
  }

  return {
    isCorrect, start, onTimer,
    getSession, getQuestion, getCurrentIndex, getAnswer, isRevealed, isFlagged,
    setAnswer, reveal, toggleFlag, skip,
    goTo, next, prev, togglePause,
    navStatus, submit, destroy,
  };
})();
