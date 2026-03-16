(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  var CURRENT_APP_VERSION = 'v3.2.21_backup_restore_guard_hotfix';
  App.meta = App.meta || {};
  if (typeof App.meta.version !== 'string' || !App.meta.version.trim()) {
    App.meta.version = CURRENT_APP_VERSION;
  }

  function finalizeInitialRender() {
    if (App.stateIO && typeof App.stateIO.sanitizeUIState === 'function') {
      App.stateIO.sanitizeUIState();
    }

    if (App.api && typeof App.api.finalizeBootstrap === 'function') {
      App.api.finalizeBootstrap('app.init', { normalizeSelection: true });
      return;
    }

    if (App.api && typeof App.api.finalizeMutation === 'function') {
      App.api.finalizeMutation('app.init', { normalizeSelection: true });
    }
  }

  function init() {
    if (App.ui && App.ui.layout && App.ui.layout.init) {
      App.ui.layout.init();
    }
    if (App.ui && App.ui.events && App.ui.events.init) {
      App.ui.events.init();
    }
    if (App.features && App.features.debtors && App.features.debtors.init) {
      App.features.debtors.init();
    }
    if (App.features && App.features.calendar && App.features.calendar.init) {
      App.features.calendar.init();
    }
    if (App.features && App.features.monitoring && App.features.monitoring.init) {
      App.features.monitoring.init();
    }
    if (App.features && App.features.report && App.features.report.init) {
      App.features.report.init();
    }
    if (App.auth && App.auth.init) {
      App.auth.init();
    }

    var localSaveBtn = document.getElementById('local-save-btn');
    if (localSaveBtn && App.local && typeof App.local.save === 'function') {
      localSaveBtn.addEventListener('click', function () {
        App.local.save();
      });
    }

    var localLoadTrigger = document.getElementById('local-load-trigger');
    var localLoadInput = document.getElementById('local-load-file');
    if (localLoadInput) {
      localLoadInput.setAttribute('accept', '.json,application/json');
    }
    if (localLoadTrigger && localLoadInput && App.local && typeof App.local.load === 'function') {
      localLoadTrigger.addEventListener('click', function () {
        localLoadInput.click();
      });
      localLoadInput.addEventListener('change', function (e) {
        var files = e.target && e.target.files ? e.target.files : null;
        if (files && files.length) {
          Promise.resolve(App.local.load(files[0]))
            .catch(function () {})
            .finally(function () {
              try { localLoadInput.value = ''; } catch (err) {}
            });
        }
      });
    }

    var cloudSaveBtn = document.getElementById('cloud-save-btn');
    if (cloudSaveBtn && App.data && typeof App.data.saveToSupabase === 'function') {
      cloudSaveBtn.addEventListener('click', function () {
        App.data.saveToSupabase();
      });
    }

    var cloudLoadBtn = document.getElementById('cloud-load-btn');
    if (cloudLoadBtn && App.data && typeof App.data.loadAllFromSupabase === 'function') {
      cloudLoadBtn.addEventListener('click', function () {
        App.data.loadAllFromSupabase();
      });
    }

    finalizeInitialRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
