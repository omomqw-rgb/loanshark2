(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  App.ui = App.ui || {};

  function init() {
    var root = document.querySelector('[data-tab-root]');
    if (!root) return;

    root.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-tab]');
      if (!btn) return;
      var tabName = btn.getAttribute('data-tab');
      setActiveTab(tabName);
    });
  }

  function setActiveTab(tab) {
    if (!tab) return;
    if (App.state && App.state.ui && App.state.ui.activeTab !== tab) {
      App.state.ui.activeTab = tab;
    }
    var buttons = document.querySelectorAll('[data-tab]');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (b.getAttribute('data-tab') === tab) b.classList.add('is-active');
      else b.classList.remove('is-active');
    }
    var panels = document.querySelectorAll('.tab-panel');
    for (var j = 0; j < panels.length; j++) {
      var p = panels[j];
      var id = p.id || '';
      if (id === 'tab-' + tab) p.classList.add('is-active');
      else p.classList.remove('is-active');
    }
  }

  App.ui.events = { init: init, setActiveTab: setActiveTab };
})(window, document);
