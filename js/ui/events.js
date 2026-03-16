(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  App.ui = App.ui || {};

  var initialized = false;
  var rendererRegistered = false;
  var VALID_TABS = {
    debtors: true,
    calendar: true,
    monitoring: true,
    report: true
  };

  function ensureUiContainer() {
    if (!App.state) App.state = {};
    if (!App.state.ui) App.state.ui = {};
    return App.state.ui;
  }

  function sanitizeUiShellState() {
    if (App.stateIO && typeof App.stateIO.sanitizeActiveTabState === 'function') {
      return App.stateIO.sanitizeActiveTabState();
    }
    var ui = ensureUiContainer();
    if (!VALID_TABS[ui.activeTab]) {
      ui.activeTab = 'calendar';
    }
    return ui;
  }

  function getActiveTabValue() {
    var ui = App.state && App.state.ui ? App.state.ui : null;
    return (ui && VALID_TABS[ui.activeTab]) ? ui.activeTab : 'calendar';
  }

  function registerRenderer() {
    if (rendererRegistered) return;
    if (!App.renderCoordinator || !App.ViewKey || !App.ViewKey.UI_SHELL) return;
    if (typeof App.renderCoordinator.register !== 'function') return;
    App.renderCoordinator.register(App.ViewKey.UI_SHELL, renderActiveTab);
    rendererRegistered = true;
  }

  function renderActiveTab() {
    var tab = getActiveTabValue();

    var buttons = document.querySelectorAll('[data-tab]');
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      var isActive = button.getAttribute('data-tab') === tab;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }

    var panels = document.querySelectorAll('.tab-panel');
    for (var j = 0; j < panels.length; j++) {
      var panel = panels[j];
      var panelActive = panel.id === 'tab-' + tab;
      panel.classList.toggle('is-active', panelActive);
      if (panelActive) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', 'hidden');
    }
  }

  function finalizeUiShell(reason) {
    if (App.api && typeof App.api.finalizeBootstrap === 'function') {
      App.api.finalizeBootstrap(reason || 'ui.shell.finalize', { normalizeSelection: false });
      return;
    }
    if (App.api && typeof App.api.finalizeMutation === 'function') {
      App.api.finalizeMutation(reason || 'ui.shell.finalize', { normalizeSelection: false });
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    sanitizeUiShellState();
    registerRenderer();

    var root = document.querySelector('[data-tab-root]');
    if (root) {
      root.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-tab]');
        if (!btn) return;
        var tabName = btn.getAttribute('data-tab');
        setActiveTab(tabName);
      });
    }
  }

  function setActiveTab(tab) {
    if (!VALID_TABS[tab]) return;

    if (App.api && typeof App.api.runUiMutation === 'function') {
      App.api.runUiMutation('ui.setActiveTab', function () {
        var ui = ensureUiContainer();
        ui.activeTab = tab;
      }, { normalizeSelection: false });
      return;
    }

    var ui = ensureUiContainer();
    ui.activeTab = tab;
    finalizeUiShell('ui.setActiveTab.fallback');
  }

  registerRenderer();

  App.ui.events = {
    init: init,
    setActiveTab: setActiveTab,
    renderImpl: renderActiveTab
  };
})(window, document);
