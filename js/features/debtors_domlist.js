// DebtorList DOM Render Integration (SSOT-owned list renderer)
window.App = window.App || {};
App.debtors = App.debtors || {};

(function () {
  'use strict';

  var domInitialized = false;

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
      activeOnly: true,
      perPage: 15
    };
  }

  function normalizePositiveInt(value, fallbackValue) {
    var n = Number(value);
    if (!isFinite(n)) return fallbackValue;
    n = Math.floor(n);
    if (n < 1) return fallbackValue;
    return n;
  }

  function normalizeViewMode(value, fallbackValue) {
    return (value === 'loan' || value === 'claim' || value === 'risk' || value === 'all')
      ? value
      : fallbackValue;
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
    panel.page = normalizePositiveInt(panel.page, defaults.page);
    panel.viewMode = normalizeViewMode(panel.viewMode, defaults.viewMode);
    panel.activeOnly = (typeof panel.activeOnly === 'boolean') ? panel.activeOnly : defaults.activeOnly;
    panel.perPage = normalizePositiveInt(panel.perPage, defaults.perPage);
    return panel;
  }

  function requestDebtorListRefresh(reason) {
    if (App.api && typeof App.api.commit === 'function' && App.ViewKey && App.ViewKey.DEBTOR_LIST) {
      App.api.commit({
        reason: reason || 'debtorList:refresh',
        invalidate: [App.ViewKey.DEBTOR_LIST]
      });
      return;
    }
    if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
      App.api.view.invalidate(App.ViewKey.DEBTOR_LIST);
      return;
    }
    try {
      console.warn('[DebtorList] invalidate path unavailable for DEBTOR_LIST');
    } catch (e) {}
  }

  function syncPanelVisibility() {
    if (App.debtorPanel && typeof App.debtorPanel.syncFromState === 'function') {
      App.debtorPanel.syncFromState();
    }
  }

  function clearLegacyDebtorState() {
    if (!App.debtors) return;
    if (Object.prototype.hasOwnProperty.call(App.debtors, 'state')) {
      try {
        delete App.debtors.state;
      } catch (e) {
        App.debtors.state = undefined;
      }
    }
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

  function matchesViewMode(d, viewMode) {
    if (!d) return false;
    if (viewMode === 'loan') {
      return ((d.loanCount != null) ? d.loanCount : 0) > 0;
    }
    if (viewMode === 'claim') {
      return ((d.claimCount != null) ? d.claimCount : 0) > 0;
    }
    if (viewMode === 'risk') {
      return !!d.hasOverdueSchedule;
    }
    return true;
  }

  function matchesSearchQuery(d, lowerQuery) {
    if (!lowerQuery) return true;
    if (!d || !d.name) return false;
    return String(d.name).toLowerCase().indexOf(lowerQuery) !== -1;
  }

  function selectFilteredDebtors(panel, fullList) {
    panel = panel || ensurePanelState();
    fullList = Array.isArray(fullList) ? fullList : getDerivedDebtors();
    var lowerQuery = String(panel.searchQuery || '').trim().toLowerCase();
    var activeOnly = (panel.activeOnly !== false);
    var viewMode = normalizeViewMode(panel.viewMode, 'all');
    var out = [];

    for (var i = 0; i < fullList.length; i++) {
      var d = fullList[i];
      if (!d) continue;
      if (activeOnly && !d.hasAliveSchedule) continue;
      if (!matchesViewMode(d, viewMode)) continue;
      if (!matchesSearchQuery(d, lowerQuery)) continue;
      out.push(d);
    }

    return out;
  }

  function getPaginationMeta(panel, filteredCount) {
    panel = panel || ensurePanelState();
    filteredCount = Number(filteredCount || 0);
    var perPage = normalizePositiveInt(panel.perPage, 15);
    var totalPages = Math.max(1, Math.ceil(filteredCount / perPage));
    var page = normalizePositiveInt(panel.page, 1);
    if (page > totalPages) {
      page = totalPages;
      panel.page = page;
    }
    return {
      perPage: perPage,
      totalPages: totalPages,
      page: page,
      filteredCount: filteredCount
    };
  }

  function selectPaginatedDebtors(panel, filteredList) {
    var meta = getPaginationMeta(panel, Array.isArray(filteredList) ? filteredList.length : 0);
    var start = (meta.page - 1) * meta.perPage;
    var end = start + meta.perPage;
    return {
      meta: meta,
      items: (Array.isArray(filteredList) ? filteredList : []).slice(start, end)
    };
  }

  function getDomRefs() {
    return {
      root: document.getElementById('debtor-list-root'),
      searchInput: document.querySelector('.dlist-search-input'),
      addBtn: document.querySelector('.dlist-add-btn'),
      prevBtn: document.querySelector('.dlist-page-prev'),
      nextBtn: document.querySelector('.dlist-page-next'),
      pageLabel: document.querySelector('.dlist-page-label'),
      viewBtns: document.querySelectorAll('.dlist-view-btn[data-view]'),
      activeToggleBtn: document.querySelector('[data-role="dlist-active-toggle"]')
    };
  }

  function syncSearchInputUI(panel, refs) {
    refs = refs || getDomRefs();
    if (!refs.searchInput) return;
    var nextValue = String(panel.searchQuery || '');
    if (refs.searchInput.value !== nextValue) {
      refs.searchInput.value = nextValue;
    }
  }

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

  function syncFilterControls(panel, refs) {
    refs = refs || getDomRefs();
    syncSearchInputUI(panel, refs);
    if (typeof App.debtors._setViewModeUI === 'function') {
      App.debtors._setViewModeUI(panel.viewMode);
    }
    if (typeof App.debtors._setActiveOnlyUI === 'function') {
      App.debtors._setActiveOnlyUI(!!panel.activeOnly);
    }
  }

  function updatePaginationUI(meta, refs) {
    refs = refs || getDomRefs();
    if (!refs.pageLabel) return;
    refs.pageLabel.textContent = String(meta.page) + ' / ' + String(meta.totalPages);
    if (refs.prevBtn) refs.prevBtn.disabled = (meta.page <= 1);
    if (refs.nextBtn) refs.nextBtn.disabled = (meta.page >= meta.totalPages);
  }

  App.debtors._updatePaginationUI = function (meta) {
    var panel = ensurePanelState();
    if (!meta) {
      var filtered = selectFilteredDebtors(panel, getDerivedDebtors());
      meta = getPaginationMeta(panel, filtered.length);
    }
    updatePaginationUI(meta, getDomRefs());
  };

  App.debtors.updateFilteredList = function () {
    return selectFilteredDebtors(ensurePanelState(), getDerivedDebtors());
  };

  function renderListFromState() {
    clearLegacyDebtorState();

    var refs = getDomRefs();
    var root = refs.root;
    if (!root) {
      syncPanelVisibility();
      return;
    }

    var panel = ensurePanelState();
    var filtered = selectFilteredDebtors(panel, getDerivedDebtors());
    var paginated = selectPaginatedDebtors(panel, filtered);

    root.innerHTML = '';
    for (var i = 0; i < paginated.items.length; i++) {
      root.appendChild(App.debtors.renderItem(paginated.items[i]));
    }

    syncFilterControls(panel, refs);
    updatePaginationUI(paginated.meta, refs);
    syncPanelVisibility();
  }
  renderListFromState._ls_fromUIState = true;

  App.debtors.renderListImpl = renderListFromState;
  App.debtors._renderListFromState = renderListFromState;

  App.debtors.renderList = (function () {
    var warned = false;
    function warnOnce() {
      if (warned) return;
      warned = true;
      try {
        console.warn('[DEPRECATED] direct debtorList.renderList() called. Use commit/invalidate instead.');
      } catch (e) {}
    }
    // Legacy bridge only: keep external callers from breaking while routing them
    // back into invalidate/commit instead of direct DOM rendering.
    var wrapper = function () {
      warnOnce();
      requestDebtorListRefresh('debtorList:deprecated-renderList');
    };
    wrapper._deprecatedInvalidateWrapper = true;
    return wrapper;
  })();

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

  function bindSearchInput(refs) {
    if (!refs.searchInput) return;
    refs.searchInput.addEventListener('input', function () {
      var panel = ensurePanelState();
      panel.searchQuery = String(refs.searchInput.value || '').trim();
      panel.page = 1;
      requestDebtorListRefresh('debtorList:search');
    });
  }

  function bindAddButton(refs) {
    if (!refs.addBtn) return;
    refs.addBtn.addEventListener('click', function () {
      if (App.features && App.features.debtors && typeof App.features.debtors.openDebtorModal === 'function') {
        App.features.debtors.openDebtorModal('create', null);
      }
    });
  }

  function bindViewButtons(refs) {
    var viewBtns = refs.viewBtns;
    if (!viewBtns || !viewBtns.length) return;
    for (var i = 0; i < viewBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var panel = ensurePanelState();
          panel.viewMode = normalizeViewMode(btn.getAttribute('data-view') || 'all', 'all');
          panel.page = 1;
          requestDebtorListRefresh('debtorList:viewMode:' + panel.viewMode);
        });
      })(viewBtns[i]);
    }
  }

  function bindActiveToggle(refs) {
    if (!refs.activeToggleBtn) return;
    refs.activeToggleBtn.addEventListener('click', function () {
      var panel = ensurePanelState();
      panel.activeOnly = !panel.activeOnly;
      panel.page = 1;
      requestDebtorListRefresh('debtorList:activeOnly:' + String(panel.activeOnly));
    });
  }

  function bindPagination(refs) {
    if (refs.prevBtn) {
      refs.prevBtn.addEventListener('click', function () {
        var panel = ensurePanelState();
        if (panel.page > 1) {
          panel.page -= 1;
          requestDebtorListRefresh('debtorList:page:' + String(panel.page));
        }
      });
    }

    if (refs.nextBtn) {
      refs.nextBtn.addEventListener('click', function () {
        var panel = ensurePanelState();
        var filtered = selectFilteredDebtors(panel, getDerivedDebtors());
        var meta = getPaginationMeta(panel, filtered.length);
        if (meta.page < meta.totalPages) {
          panel.page = meta.page + 1;
          requestDebtorListRefresh('debtorList:page:' + String(panel.page));
        }
      });
    }
  }

  App.debtors.requestListRefresh = requestDebtorListRefresh;

  App.debtors.initDom = function () {
    clearLegacyDebtorState();
    var panel = ensurePanelState();
    var refs = getDomRefs();

    if (!domInitialized) {
      domInitialized = true;
      bindSearchInput(refs);
      bindAddButton(refs);
      bindViewButtons(refs);
      bindActiveToggle(refs);
      bindPagination(refs);
    }

    syncFilterControls(panel, refs);
    App.debtors._updatePaginationUI();
    syncPanelVisibility();
  };
})();
