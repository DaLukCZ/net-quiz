// Aplikační stav — in-memory databáze otázek + lokální nastavení zařízení
// Vše je uloženo v localStorage.
window.App = window.App || {};

App.State = (() => {
  const DEFAULT_SETTINGS = {
    defaultCount:      20,
    randomize:         true,
    instantFeedback:   true,
    darkMode:          false,
    defaultMode:       'study',
    defaultSubject:    'site',
  };

  let _db       = null; // { questions, categories } — načteno z DB při výběru předmětu
  let _settings = { ...DEFAULT_SETTINGS };

  function init() {
    try {
      const s = localStorage.getItem('nq_settings');
      if (s) _settings = { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
    } catch (_) {}
  }

  function _saveSettings() {
    localStorage.setItem('nq_settings', JSON.stringify(_settings));
  }

  return {
    init,

    getDB:  ()   => _db,
    setDB:  (db) => { _db = db; },

    getSetting:  (key)        => _settings[key],
    setSetting:  (key, value) => { _settings[key] = value; _saveSettings(); },
    getSettings: ()           => ({ ..._settings }),
  };
})();
