
// DebtorList DOM Render Integration (SSOT-owned list renderer)
window.App = window.App || {};
App.debtors = App.debtors || {};

(function () {
  var rendererRegistered = false;

  App.debtors.state = App.debtors.state || {
    query: '',
    page: 1,
    perPage: 15,
    viewMode: 'all',
    activeOnly: true,
    filteredList: []
  };

  function ensurePanelState() {
    App.state = App.state || {};
    App.state.ui = App.state.ui || {};
    App.state.ui.debtorPanel = App.state.ui.debtorPanel || {
      mode: 'list',
      selectedDebtorId: null,
      page: 1,
      searchQuery: ''
    };
    return App.state.ui.debtorPanel;
  }

  function invalidateList() {
    if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
      App.api.view.invalidate(App.ViewKey.DEBTOR_LIST);
      return;
    }
    try {
      console.warn('[DebtorList] invalidate path unavailable for DEBTOR_LIST');
    } catch (e) {}
  }

  function getDerivedDebtors() {
    if (App.derived && Array.isArray(App.derived.debtors)) {
      return App.derived.debtors;
    }
    if (App.data && Array.isArray(App.data.debtors)) {
      return App.data.debtors;
    }
    return [];
  }

  App.debtors.updateFilteredList = function () {
    var st = App.debtors.state || {};
    var panel = ensurePanelState();
    var q = String(panel.searchQuery || st.query || '').toLowerCase();
    st.query = panel.searchQuery || '';

    var full = getDerivedDebtors();
    var viewMode = st.viewMode || 'all';
    var activeOnly = (st.activeOnly !== false);

    var out = full.filter(function (d) {
      if (!d) return false;

      if (activeOnly && !d.hasAliveSchedule) return false;

      if (viewMode === 'loan') {
        var loanCnt = (d.loanCount != null) ? d.loanCount : 0;
        if (!(loanCnt > 0)) return false;
      } else if (viewMode === 'claim') {
        var claimCnt = (d.claimCount != null) ? d.claimCount : 0;
        if (!(claimCnt > 0)) return false;
      } else if (viewMode === 'risk') {
        if (!d.hasOverdueSchedule) return false;
      }

      if (q) {
        if (!d.name) return false;
        return String(d.name).toLowerCase().indexOf(q) !== -1;
      }
      return true;
    });

    st.filteredList = out;
  };

  App.debtors.renderList = function () {
    var root = document.getElementById('debtor-list-root');
    if (!root) {
      if (App.debtorPanel && typeof App.debtorPanel.syncFromState === 'function') {
        App.debtorPanel.syncFromState();
      }
      return;
    }

    var st = App.debtors.state || {};
    var panel = ensurePanelState();
    var perPage = st.perPage || 15;
    var page = (typeof panel.page === 'number' && isFinite(panel.page) && panel.page > 0) ? panel.page : 1;
    st.page = page;
    panel.page = page;

    root.innerHTML = '';

    var start = (page - 1) * perPage;
    var end = start + perPage;
    var list = (st.filteredList || []).slice(start, end);

    for (var i = 0; i < list.length; i++) {
      root.appendChild(App.debtors.renderItem(list[i]));
    }

    if (typeof App.debtors._updatePaginationUI === 'function') {
      App.debtors._updatePaginationUI();
    }

    if (App.debtorPanel && typeof App.debtorPanel.syncFromState === 'function') {
      App.debtorPanel.syncFromState();
    }
  };

  App.debtors.renderItem = function (d) {
    var wrap = document.createElement('div');
    wrap.className = 'dlist-item';

    var colLeft = document.createElement('div');
    colLeft.className = 'dlist-col-left';

    var bullet = document.createElement('span');
    bullet.className = 'dlist-bullet';

    var name = document.createElement('span');
    name.className = 'dlist-name';
    name.textContent = d && d.name ? d.name : '';

    colLeft.appendChild(bullet);
    colLeft.appendChild(name);

    var colCenter = document.createElement('div');
    colCenter.className = 'dlist-col-center';

    var counts = document.createElement('span');
    counts.className = 'dlist-counts';

    var loanCnt = (d && d.loanCount != null) ? d.loanCount : 0;
    var claimCnt = (d && d.claimCount != null) ? d.claimCount : 0;
    counts.textContent = 'L' + loanCnt + ' · C' + claimCnt;

    colCenter.appendChild(counts);

    var colRight = document.createElement('div');
    colRight.className = 'dlist-col-right';

    var statusDot = document.createElement('span');
    statusDot.className = 'dlist-status-dot';

    var hasAliveSchedule = !!(d && d.hasAliveSchedule);
    var hasOverdueSchedule = !!(d && d.hasOverdueSchedule);

    if (!hasAliveSchedule) {
      statusDot.className += ' dlist-status--inactive';
    } else if (hasOverdueSchedule) {
      statusDot.className += ' dlist-status--active-overdue';
    } else {
      statusDot.className += ' dlist-status--active-ok';
    }

    colRight.appendChild(statusDot);

    wrap.appendChild(colLeft);
    wrap.appendChild(colCenter);
    wrap.appendChild(colRight);

    wrap.addEventListener('click', function () {
      var id = (d && d.id != null) ? String(d.id) : null;
      if (!id) return;
      if (App.api && App.api.view && typeof App.api.view.openDebtorDetail === 'function') {
        App.api.view.openDebtorDetail(id);
      }
    });

    return wrap;
  };

  App.debtors._setViewModeUI = function (mode) {
    var btns = document.querySelectorAll('.dlist-view-btn[data-view]');
    if (!btns || !btns.length) return;
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var v = b.getAttribute('data-view') || 'all';
      if (v === mode) {
        b.classList.add('active');
        b.classList.add('is-active');
        b.setAttribute('aria-selected', 'true');
      } else {
        b.classList.remove('active');
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      }
    }
  };


  function ensureRendererRegistered() {
    if (rendererRegistered) return;
    if (!(App.renderCoordinator && App.ViewKey && App.ViewKey.DEBTOR_LIST)) return;
    var renderListFromState = function () {
      if (App.debtors && typeof App.debtors.updateFilteredList === 'function') {
        App.debtors.updateFilteredList();
      }
      if (App.debtors && typeof App.debtors.renderList === 'function') {
        App.debtors.renderList();
      }
    };
    renderListFromState._ls_fromUIState = true;
    App.renderCoordinator.register(App.ViewKey.DEBTOR_LIST, renderListFromState);
    rendererRegistered = true;
  }

  App.debtors._setActiveOnlyUI = function (isOn) {
    var btn = document.querySelector('[data-role="dlist-active-toggle"]');
    if (!btn) return;
    if (isOn) {
      btn.classList.add('is-on');
      btn.classList.remove('is-off');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('is-on');
      btn.classList.add('is-off');
      btn.setAttribute('aria-pressed', 'false');
    }
  };

  App.debtors.initDom = function () {
    if (App.debtors._initializedDom) {
      if (App.debtorPanel && typeof App.debtorPanel.syncFromState === 'function') {
        App.debtorPanel.syncFromState();
      }
      return;
    }
    App.debtors._initializedDom = true;

    ensureRendererRegistered();

    var panel = ensurePanelState();
    App.debtors.state.query = panel.searchQuery || '';
    App.debtors.state.page = panel.page || 1;

    var searchInput = document.querySelector('.dlist-search-input');
    var addBtn = document.querySelector('.dlist-add-btn');
    var prevBtn = document.querySelector('.dlist-page-prev');
    var nextBtn = document.querySelector('.dlist-page-next');
    var pageLabel = document.querySelector('.dlist-page-label');
    var viewBtns = document.querySelectorAll('.dlist-view-btn[data-view]');
    var activeToggleBtn = document.querySelector('[data-role="dlist-active-toggle"]');

    if (searchInput) {
      searchInput.value = panel.searchQuery || '';
      searchInput.addEventListener('input', function () {
        var ui = ensurePanelState();
        ui.searchQuery = searchInput.value.trim();
        ui.page = 1;
        App.debtors.state.query = ui.searchQuery;
        App.debtors.state.page = 1;
        invalidateList();
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (App.features && App.features.debtors &&
            typeof App.features.debtors.openDebtorModal === 'function') {
          App.features.debtors.openDebtorModal('create', null);
        }
      });
    }

    if (viewBtns && viewBtns.length) {
      for (var vb = 0; vb < viewBtns.length; vb++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var mode = btn.getAttribute('data-view') || 'all';
            App.debtors.state.viewMode = mode;

            if (typeof App.debtors._setViewModeUI === 'function') {
              App.debtors._setViewModeUI(mode);
            }

            var ui = ensurePanelState();
            ui.page = 1;
            App.debtors.state.page = 1;
            invalidateList();
          });
        })(viewBtns[vb]);
      }
    }

    if (activeToggleBtn) {
      activeToggleBtn.addEventListener('click', function () {
        var st = App.debtors.state || {};
        st.activeOnly = !st.activeOnly;

        if (typeof App.debtors._setActiveOnlyUI === 'function') {
          App.debtors._setActiveOnlyUI(!!st.activeOnly);
        }

        var ui = ensurePanelState();
        ui.page = 1;
        st.page = 1;
        invalidateList();
      });
    }

    var updatePaginationUI = function () {
      if (!pageLabel) return;
      var st = App.debtors.state || {};
      var ui = ensurePanelState();
      var totalPages = Math.max(1, Math.ceil((st.filteredList || []).length / (st.perPage || 15)));
      var page = (typeof ui.page === 'number' && isFinite(ui.page) && ui.page > 0) ? ui.page : 1;
      if (page > totalPages) {
        page = totalPages;
        ui.page = page;
      }
      st.page = page;

      pageLabel.textContent = page + ' / ' + totalPages;
      if (prevBtn) {
        prevBtn.disabled = (page <= 1);
      }
      if (nextBtn) {
        nextBtn.disabled = (page >= totalPages);
      }
    };

    App.debtors._updatePaginationUI = updatePaginationUI;

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        var ui = ensurePanelState();
        if (ui.page > 1) {
          ui.page -= 1;
          App.debtors.state.page = ui.page;
          invalidateList();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        var ui = ensurePanelState();
        var st = App.debtors.state || {};
        var totalPages = Math.max(1, Math.ceil((st.filteredList || []).length / (st.perPage || 15)));
        if (ui.page < totalPages) {
          ui.page += 1;
          App.debtors.state.page = ui.page;
          invalidateList();
        }
      });
    }

    if (!App.debtors.state.viewMode) App.debtors.state.viewMode = 'all';
    if (typeof App.debtors.state.activeOnly !== 'boolean') App.debtors.state.activeOnly = true;

    if (typeof App.debtors._setViewModeUI === 'function') {
      App.debtors._setViewModeUI(App.debtors.state.viewMode);
    }
    if (typeof App.debtors._setActiveOnlyUI === 'function') {
      App.debtors._setActiveOnlyUI(!!App.debtors.state.activeOnly);
    }

    if (App.debtorPanel && typeof App.debtorPanel.syncFromState === 'function') {
      App.debtorPanel.syncFromState();
    }
  };
})();
