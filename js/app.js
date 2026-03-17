(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  var initialized = false;

  function bindSaveLoadButtons() {
    var localSaveBtn = document.getElementById('local-save-btn');
    if (localSaveBtn && App.local && typeof App.local.save === 'function') {
      localSaveBtn.addEventListener('click', function () {
        App.local.save();
      });
    }

    var localLoadTrigger = document.getElementById('local-load-trigger');
    var localLoadInput = document.getElementById('local-load-file');
    if (localLoadTrigger && localLoadInput && App.local && typeof App.local.load === 'function') {
      localLoadTrigger.addEventListener('click', function () {
        localLoadInput.click();
      });
      localLoadInput.addEventListener('change', function (e) {
        var files = e.target && e.target.files ? e.target.files : null;
        if (files && files.length) {
          App.local.load(files[0]);
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
  }


  function registerViewRenderers() {
    if (!App || !App.renderCoordinator || typeof App.renderCoordinator.register !== 'function') return;
    if (!App.ViewKey) return;

    // Debtor list
    if (App.debtors && typeof App.debtors._renderListFromState === 'function') {
      App.renderCoordinator.register(App.ViewKey.DEBTOR_LIST, App.debtors._renderListFromState);
    } else if (App.debtors && typeof App.debtors.renderList === 'function') {
      App.renderCoordinator.register(App.ViewKey.DEBTOR_LIST, function () { App.debtors.renderList(); });
    }

    // Debtor detail
    if (App.debtorDetail && typeof App.debtorDetail._renderFromState === 'function') {
      App.renderCoordinator.register(App.ViewKey.DEBTOR_DETAIL, App.debtorDetail._renderFromState);
    }

    // Calendar
    if (App.features && App.features.calendar && typeof App.features.calendar.renderImpl === 'function') {
      App.renderCoordinator.register(App.ViewKey.CALENDAR, App.features.calendar.renderImpl);
    }

    // Monitoring
    if (App.features && App.features.monitoring && typeof App.features.monitoring.renderImpl === 'function') {
      App.renderCoordinator.register(App.ViewKey.MONITORING, App.features.monitoring.renderImpl);
    }

    // Report
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

    bindSaveLoadButtons();

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
