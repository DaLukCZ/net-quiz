// Spaced Repetition System — SM-2 inspirovaný algoritmus pro adaptivní učení
// O(1) lookups přes Map, žádná reaktivita, žádné deep watchery.
// Persistenci zajišťuje db.js (Supabase) — zde jen in-memory cache.
window.App = window.App || {};

App.SRS = (() => {
  const DAY_MS       = 86_400_000;
  const MIN_EASE     = 1.3;
  const INIT_EASE    = 2.5;
  const NEW_PRIORITY = 10;
  const RECENCY_GAP  = 90_000; // 90s — stejná otázka se nezopakuje hned za sebou

  let _states = new Map(); // Map<questionId, LearningState>

  // Načti pole stavů (vrácených z App.DB.loadSRSStates) do in-memory mapy.
  // Voláno jednou po výběru předmětu, dříve než se zobrazí první otázka.
  function loadStates(statesArray) {
    _states = new Map();
    for (const s of statesArray) {
      _states.set(s.questionId, s);
    }
  }

  // Vymaž cache (při odhlášení nebo přepnutí předmětu).
  function reset() {
    _states = new Map();
  }

  function getState(id) {
    return _states.has(id) ? _states.get(id) : _defaultState(id);
  }

  function _defaultState(id) {
    return {
      questionId:       id,
      timesSeen:        0,
      timesCorrect:     0,
      timesWrong:       0,
      confidenceLevel:  0,
      lastSeenAt:       0,
      nextReviewAt:     0,
      easeFactor:       INIT_EASE,
      streak:           0,
      manualRating:     0,
      intervalDays:     0,
    };
  }

  // SM-2 update po hodnocení uživatele (rating 1–5).
  // wasCorrect pochází z QuizEngine.isCorrect(); u otevřených otázek = (rating >= 3).
  function updateAfterRating(id, rating, wasCorrect) {
    const s   = { ...getState(id) }; // klon, nikdy nemutujeme Map hodnotu přímo
    const now = Date.now();

    s.timesSeen++;
    s.lastSeenAt   = now;
    s.manualRating = rating;

    if (wasCorrect) s.timesCorrect++;
    else            s.timesWrong++;

    if (rating < 3) {
      // Neúspěch — reset na 1 den, penalizace ease.
      // Neresetujeme ease úplně, aby se zabránilo "ease hell" efektu.
      s.streak       = 0;
      s.intervalDays = 1;
      s.easeFactor   = Math.max(MIN_EASE, s.easeFactor - (rating === 1 ? 0.3 : 0.2));
    } else {
      // Úspěch — SM-2 postup.
      // delta drží ease v přirozeném rozsahu:
      //   rating 5 → +0.10 | rating 4 → +0.00 | rating 3 → −0.14
      s.streak++;
      const delta  = 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02);
      s.easeFactor = Math.max(MIN_EASE, s.easeFactor + delta);

      // První dvě opakování mají pevný interval (bootstrapping).
      if (s.timesSeen === 1) {
        s.intervalDays = 1;
      } else if (s.timesSeen === 2) {
        s.intervalDays = rating >= 4 ? 4 : 1;
      } else {
        s.intervalDays = Math.max(1, Math.round(s.intervalDays * s.easeFactor));
      }
    }

    s.intervalDays    = Math.min(180, Math.max(1, s.intervalDays));
    s.nextReviewAt    = now + s.intervalDays * DAY_MS;
    s.confidenceLevel = Math.min(5, s.streak);

    _states.set(id, s);
    return s; // caller předá stav do App.DB.saveSRSState()
  }

  // Priority score — vyšší = urgentněji opakovat.
  // Voláno v těsné smyčce (jednou pro každou otázku v poolu) → musí být O(1).
  function computePriority(state, now, recentlyShownAt) {
    if (recentlyShownAt > 0 && (now - recentlyShownAt) < RECENCY_GAP) return -9999;
    if (state.timesSeen === 0) return NEW_PRIORITY + Math.random() * 2;

    const overdueDays = (now - state.nextReviewAt) / DAY_MS;
    const errorRate   = state.timesWrong / state.timesSeen;

    if (overdueDays < 0) {
      // Ještě není due — malé záporné skóre, ale problematické karty dostanou
      // drobný bonus, aby se občas ukázaly jako "refresh" i mimo plán.
      return overdueDays * 0.1 + errorRate * 0.5;
    }

    return Math.min(overdueDays, 30) * 1.5   // cap 30d aby stará karta neovládla celou session
         + errorRate * 2
         - state.confidenceLevel * 0.3;
  }

  // Vybere nejlépe prioritizovanou otázku z poolu — O(n) scan, O(1) extra space.
  function selectNext(pool, shownThisSession, mode) {
    if (!pool.length) return null;
    const now = Date.now();
    return mode === 'cram'
      ? _selectCram(pool, shownThisSession, now)
      : _selectAdaptive(pool, shownThisSession, now);
  }

  function _selectAdaptive(pool, shownThisSession, now) {
    let best      = null;
    let bestScore = -Infinity;
    for (const q of pool) {
      const score = computePriority(getState(q.id), now, shownThisSession.get(q.id) || 0);
      if (score > bestScore) { bestScore = score; best = q; }
    }
    return best;
  }

  // Cram mode: ignoruje plánování, zaměřuje se na nejhorší accuracy.
  // Ideální před zkouškou kde na intervaly není čas.
  function _selectCram(pool, shownThisSession, now) {
    let best     = null;
    let worstAcc = Infinity;
    for (const q of pool) {
      const shown = shownThisSession.get(q.id) || 0;
      if (shown > 0 && (now - shown) < RECENCY_GAP) continue;
      const s   = getState(q.id);
      const acc = s.timesSeen === 0 ? -1 : s.timesCorrect / s.timesSeen;
      if (acc < worstAcc) { worstAcc = acc; best = q; }
    }
    // Všechny nedávno zobrazeny — náhodný výběr jako záchrana
    if (!best) best = pool[Math.floor(Math.random() * pool.length)];
    return best;
  }

  // Souhrnné statistiky pro zobrazení v UI — volá se jen při renderu, ne hot path.
  function getStats(questionIds) {
    const now = Date.now();
    let newCount = 0, seen = 0, mastered = 0, struggling = 0, dueNow = 0;
    for (const id of questionIds) {
      const s = getState(typeof id === 'string' ? id : id.id);
      if (s.timesSeen === 0) { newCount++; continue; }
      seen++;
      if (s.streak >= 4 && s.confidenceLevel >= 4) mastered++;
      if (s.timesWrong > s.timesCorrect)            struggling++;
      if (s.nextReviewAt <= now)                    dueNow++;
    }
    return { total: questionIds.length, newCount, seen, mastered, struggling, dueNow };
  }

  // Náhled příštího intervalu pro daný hypotetický rating — zobrazuje se pod tlačítky.
  function previewNextInterval(id, hypotheticalRating) {
    const s = { ...getState(id) };
    if (hypotheticalRating < 3) return 1;
    if (s.timesSeen === 0) return 1;
    if (s.timesSeen === 1) return hypotheticalRating >= 4 ? 4 : 1;
    const delta   = 0.1 - (5 - hypotheticalRating) * (0.08 + (5 - hypotheticalRating) * 0.02);
    const newEase = Math.max(MIN_EASE, s.easeFactor + delta);
    return Math.min(180, Math.max(1, Math.round(s.intervalDays * newEase)));
  }

  function isSuspiciouslyFast(answerMs) {
    return answerMs < 2000;
  }

  // Falešné sebevědomí: rating ≥ 4 ale historie říká opak.
  function isFalseConfidence(state, newRating) {
    return newRating >= 4 && state.timesSeen >= 3 && state.timesWrong > state.timesCorrect;
  }

  return {
    loadStates, reset,
    getState, updateAfterRating,
    computePriority, selectNext,
    getStats, previewNextInterval,
    isSuspiciouslyFast, isFalseConfidence,
  };
})();
