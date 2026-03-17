// DebtorDetail DOM Wrapper (SSOT-owned detail renderer)
window.App = window.App || {};
App.debtorDetail = App.debtorDetail || {};
App.debtors = App.debtors || {};

(function () {
  var initialized = false;

  function syncPanel() {
    if (App.debtorPanel && typeof App.debtorPanel.syncFromState === 'function') {
      App.debtorPanel.syncFromState();
    }
  }

  function requestDetailInvalidate(reason) {
    if (App.api && typeof App.api.commit === 'function' && App.ViewKey && App.ViewKey.DEBTOR_DETAIL) {
      App.api.commit({
        reason: reason || 'debtorDetail:refresh',
        invalidate: [App.ViewKey.DEBTOR_DETAIL]
      });
      return;
    }

    if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
      App.api.view.invalidate(App.ViewKey.DEBTOR_DETAIL);
      return;
    }

    if (App.renderCoordinator && typeof App.renderCoordinator.invalidate === 'function' && App.ViewKey) {
      App.renderCoordinator.invalidate(App.ViewKey.DEBTOR_DETAIL);
    }
  }

  function renderDebtorDetailImpl(id) {
    var debtorId = id != null ? String(id) : null;
    if (!debtorId) {
      syncPanel();
      return;
    }

    var panelRoot = document.getElementById('debtor-panel-root');
    if (!panelRoot) {
      syncPanel();
      return;
    }

    var detailRoot = document.getElementById('debtor-detail-root');
    if (!detailRoot || detailRoot.parentNode !== panelRoot) {
      while (panelRoot.firstChild) {
        panelRoot.removeChild(panelRoot.firstChild);
      }
      detailRoot = document.createElement('div');
      detailRoot.id = 'debtor-detail-root';
      panelRoot.appendChild(detailRoot);
    } else {
      while (detailRoot.firstChild) {
        detailRoot.removeChild(detailRoot.firstChild);
      }
    }

    if (App.modules && App.modules.DebtorDetail && typeof App.modules.DebtorDetail.render === 'function') {
      App.modules.DebtorDetail.render(debtorId);
    }

    syncPanel();
  }

  App.debtorDetail.renderImpl = renderDebtorDetailImpl;
  App.debtorDetail._renderImpl = renderDebtorDetailImpl;

  App.debtorDetail.render = (function () {
    var warned = false;
    function warnOnce() {
      if (warned) return;
      warned = true;
      try {
        console.warn('[DEPRECATED] direct debtorDetail.render() called. Use invalidate/commit.');
      } catch (e) {}
    }
    return function (id) {
      warnOnce();

      if (App.api && App.api.view && typeof App.api.view.openDebtorDetail === 'function' && id != null) {
        App.api.view.openDebtorDetail(id);
        return;
      }

      requestDetailInvalidate('debtorDetail:deprecated-render');
    };
  })();
  App.debtorDetail.render._deprecatedInvalidateWrapper = true;

  function renderDebtorDetailFromState() {
    var panel = App.state && App.state.ui && App.state.ui.debtorPanel;
    var mode = panel && panel.mode ? panel.mode : 'list';
    var id = panel && panel.selectedDebtorId != null ? String(panel.selectedDebtorId) : null;

    if (mode !== 'detail' || !id) {
      syncPanel();
      return;
    }

    renderDebtorDetailImpl(id);
  }
  renderDebtorDetailFromState._ls_fromUIState = true;

  App.debtorDetail._renderFromState = renderDebtorDetailFromState;
  App.debtorDetail.requestRefresh = requestDetailInvalidate;

  App.debtorDetail.init = function () {
    if (initialized) return;
    initialized = true;
  };

  App.debtors.openDetail = App.debtors.openDetail || function (id) {
    if (App.api && App.api.view && typeof App.api.view.openDebtorDetail === 'function') {
      App.api.view.openDebtorDetail(id);
      return;
    }
    requestDetailInvalidate('debtorDetail:openDetail');
  };

  App.debtorDetail.show = function () {
    syncPanel();
  };
})();
