(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});

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

    // Save / Load button bindings
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);




