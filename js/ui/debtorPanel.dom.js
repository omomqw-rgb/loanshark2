// Debtor sidepanel control (SSOT syncFromState)
window.App = window.App || {};
App.debtorPanel = App.debtorPanel || {};

(function () {
  var initialized = false;

  function ensurePanelState() {
    App.state = App.state || {};
    App.state.ui = App.state.ui || {};
    App.state.ui.debtorPanel = App.state.ui.debtorPanel || {
      mode: 'list',
      selectedDebtorId: null,
      searchQuery: '',
      page: 1
    };
    return App.state.ui.debtorPanel;
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
    var ui = ensurePanelState();
    var els = getElements();

    var mode = (ui && ui.mode === 'detail') ? 'detail' : 'list';
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
    var ui = ensurePanelState();
    ui.mode = 'list';
    App.debtorPanel.syncFromState();
  };

  App.debtorPanel.showDetail = function () {
    var ui = ensurePanelState();
    ui.mode = 'detail';
    App.debtorPanel.syncFromState();
  };
})();
