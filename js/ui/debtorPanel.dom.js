// Debtor sidepanel control (SSOT syncFromState)
window.App = window.App || {};
App.debtorPanel = App.debtorPanel || {};

(function () {
  'use strict';

  var initialized = false;

  function cloneDefaultPanelState() {
    if (App && typeof App.getDefaultDebtorPanelState === 'function') {
      return App.getDefaultDebtorPanelState();
    }
    return {
      mode: 'list',
      selectedDebtorId: null,
      searchQuery: '',
      page: 1,
      viewMode: 'all',
      activeOnly: false,
      perPage: 15
    };
  }

  function ensurePanelState() {
    var defaults = cloneDefaultPanelState();

    App.state = App.state || {};
    App.state.ui = App.state.ui || {};
    if (!App.state.ui.debtorPanel || typeof App.state.ui.debtorPanel !== 'object') {
      App.state.ui.debtorPanel = defaults;
      return App.state.ui.debtorPanel;
    }

    var panel = App.state.ui.debtorPanel;
    panel.mode = (panel.mode === 'detail') ? 'detail' : 'list';
    panel.selectedDebtorId = (panel.selectedDebtorId == null || panel.selectedDebtorId === '')
      ? null
      : String(panel.selectedDebtorId);
    panel.searchQuery = (typeof panel.searchQuery === 'string') ? panel.searchQuery : defaults.searchQuery;
    panel.page = (typeof panel.page === 'number' && isFinite(panel.page) && panel.page > 0) ? Math.floor(panel.page) : defaults.page;
    panel.viewMode = (panel.viewMode === 'loan' || panel.viewMode === 'claim' || panel.viewMode === 'risk' || panel.viewMode === 'all')
      ? panel.viewMode
      : defaults.viewMode;
    panel.activeOnly = (panel.activeOnly === true);
    panel.perPage = (typeof panel.perPage === 'number' && isFinite(panel.perPage) && panel.perPage > 0)
      ? Math.floor(panel.perPage)
      : defaults.perPage;
    return panel;
  }

  function getElements() {
    return {
      panel: document.getElementById('debtor-sidepanel'),
      search: document.querySelector('.dlist-topbar'),
      filterbar: document.querySelector('.dlist-filterbar'),
      pagination: document.querySelector('.dlist-pagination'),
      list: document.getElementById('debtor-list-root'),
      detail: document.getElementById('debtor-panel-root')
    };
  }

  App.debtorPanel.syncFromState = function () {
    var panelState = ensurePanelState();
    var els = getElements();

    var mode = (panelState.mode === 'detail') ? 'detail' : 'list';
    var showList = (mode === 'list');

    if (els.search) els.search.style.display = showList ? '' : 'none';
    if (els.filterbar) els.filterbar.style.display = showList ? '' : 'none';
    if (els.pagination) els.pagination.style.display = showList ? '' : 'none';
    if (els.list) els.list.style.display = showList ? '' : 'none';
    if (els.detail) els.detail.style.display = showList ? 'none' : 'block';
  };

  App.debtorPanel.init = function () {
    var panel = document.getElementById('debtor-sidepanel');
    if (!panel) return;

    if (!initialized) {
      initialized = true;
      var header = panel.querySelector('.debtor-sidepanel-header');
      if (header) {
        header.addEventListener('click', function () {
          var isCollapsed = panel.classList.contains('is-collapsed');

          if (isCollapsed) {
            panel.classList.remove('is-collapsed');
            panel.classList.add('is-expanded');
          } else {
            panel.classList.remove('is-expanded');
            panel.classList.add('is-collapsed');
          }

          var aside = document.querySelector('.side');
          if (aside) {
            if (panel.classList.contains('is-collapsed')) {
              aside.classList.add('is-collapsed');
            } else {
              aside.classList.remove('is-collapsed');
            }
          }
        });
      }
    }

    App.debtorPanel.syncFromState();
  };

  App.debtorPanel.showList = function () {
    var panelState = ensurePanelState();
    panelState.mode = 'list';
    App.debtorPanel.syncFromState();
  };

  App.debtorPanel.showDetail = function () {
    var panelState = ensurePanelState();
    panelState.mode = 'detail';
    App.debtorPanel.syncFromState();
  };
})();
