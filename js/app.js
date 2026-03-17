(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  var initialized = false;

  function getDisplayVersionShort() {
    var full = (App.meta && typeof App.meta.version === 'string' && App.meta.version) ? App.meta.version : 'unknown-version';
    var m = /^v\d+(?:\.\d+){0,3}/.exec(full);
    return m ? m[0] : String(full);
  }

  function syncAppVersionUi() {
    var shortVersion = getDisplayVersionShort();
    var brandEl = document.getElementById('app-brand-version');
    if (brandEl) {
      brandEl.textContent = 'Loan Shark ' + shortVersion;
    }
    document.title = 'Loan Shark ' + shortVersion;
  }

  function closeJsonMenu() {
    var btn = document.getElementById('json-btn');
    var menu = document.getElementById('json-menu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
  }

  function toggleJsonMenu() {
    var btn = document.getElementById('json-btn');
    var menu = document.getElementById('json-menu');
    if (!btn || !menu) return;
    var nextHidden = !menu.hidden;
    menu.hidden = nextHidden;
    btn.setAttribute('aria-expanded', nextHidden ? 'false' : 'true');
  }

  function bindSnapshotControls() {
    var saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (App.data && typeof App.data.saveSnapshotToSupabase === 'function') {
          App.data.saveSnapshotToSupabase();
        }
      });
    }

    var loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        if (App.snapshots && typeof App.snapshots.openLoadModal === 'function') {
          App.snapshots.openLoadModal();
        }
      });
    }

    var jsonBtn = document.getElementById('json-btn');
    if (jsonBtn) {
      jsonBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleJsonMenu();
      });
    }

    var exportBtn = document.getElementById('json-export-action');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        closeJsonMenu();
        if (App.jsonIO && typeof App.jsonIO.exportSnapshot === 'function') {
          App.jsonIO.exportSnapshot();
        }
      });
    }

    var importActionBtn = document.getElementById('json-import-action');
    var importInput = document.getElementById('json-import-file');
    if (importActionBtn && importInput) {
      importActionBtn.addEventListener('click', function () {
        closeJsonMenu();
        importInput.value = '';
        importInput.click();
      });
      importInput.addEventListener('change', function (e) {
        var files = e && e.target && e.target.files ? e.target.files : null;
        if (files && files.length && App.jsonIO && typeof App.jsonIO.importSnapshot === 'function') {
          App.jsonIO.importSnapshot(files[0]);
        }
        importInput.value = '';
      });
    }

    document.addEventListener('click', function (event) {
      var root = event.target && event.target.closest ? event.target.closest('.json-menu-root') : null;
      if (!root) {
        closeJsonMenu();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event && event.key === 'Escape') {
        closeJsonMenu();
        if (App.snapshots && typeof App.snapshots.closeLoadModal === 'function') {
          App.snapshots.closeLoadModal();
        }
      }
    });
  }

  function registerViewRenderers() {
    if (!App || !App.renderCoordinator || typeof App.renderCoordinator.register !== 'function') return;
    if (!App.ViewKey) return;

    if (App.debtors && typeof App.debtors._renderListFromState === 'function') {
      App.renderCoordinator.register(App.ViewKey.DEBTOR_LIST, App.debtors._renderListFromState);
    } else if (App.debtors && typeof App.debtors.renderList === 'function') {
      App.renderCoordinator.register(App.ViewKey.DEBTOR_LIST, function () { App.debtors.renderList(); });
    }

    if (App.debtorDetail && typeof App.debtorDetail._renderFromState === 'function') {
      App.renderCoordinator.register(App.ViewKey.DEBTOR_DETAIL, App.debtorDetail._renderFromState);
    }

    if (App.features && App.features.calendar && typeof App.features.calendar.renderImpl === 'function') {
      App.renderCoordinator.register(App.ViewKey.CALENDAR, App.features.calendar.renderImpl);
    }

    if (App.features && App.features.monitoring && typeof App.features.monitoring.renderImpl === 'function') {
      App.renderCoordinator.register(App.ViewKey.MONITORING, App.features.monitoring.renderImpl);
    }

    if (App.features && App.features.report && typeof App.features.report.renderImpl === 'function') {
      App.renderCoordinator.register(App.ViewKey.REPORT, App.features.report.renderImpl);
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    if (App.renderCoordinator && typeof App.renderCoordinator.enable === 'function') {
      App.renderCoordinator.enable();
    }

    registerViewRenderers();

    if (App.ui && App.ui.layout && App.ui.layout.init) {
      App.ui.layout.init();
    }
    if (App.ui && App.ui.events && App.ui.events.init) {
      App.ui.events.init();
    }
    if (App.debtorPanel && App.debtorPanel.init) {
      App.debtorPanel.init();
    }
    if (App.ui && App.ui.mobile && App.ui.mobile.init) {
      App.ui.mobile.init();
    }

    if (App.features && App.features.debtors && App.features.debtors.init) {
      App.features.debtors.init();
    }
    if (App.debtors && App.debtors.initDom) {
      App.debtors.initDom();
    }
    if (App.debtorDetail && App.debtorDetail.init) {
      App.debtorDetail.init();
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

    bindSnapshotControls();
    syncAppVersionUi();

    if (App.snapshotStatus && typeof App.snapshotStatus.init === 'function') {
      App.snapshotStatus.init();
    }

    if (App.api && typeof App.api.commitAll === 'function') {
      App.api.commitAll('app:init');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
