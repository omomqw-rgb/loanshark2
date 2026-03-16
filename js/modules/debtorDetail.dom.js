// DebtorDetail DOM Wrapper (SSOT-owned detail renderer)
window.App = window.App || {};
App.debtorDetail = App.debtorDetail || {};
App.debtors = App.debtors || {};

(function () {
  var initialized = false;
  var rendererRegistered = false;

  function syncPanel() {
    if (App.debtorPanel && typeof App.debtorPanel.syncFromState === 'function') {
      App.debtorPanel.syncFromState();
    }
  }

  function ensureRendererRegistered() {
    if (rendererRegistered) return;
    if (!(App.renderCoordinator && App.ViewKey && App.ViewKey.DEBTOR_DETAIL)) return;
    App.renderCoordinator.register(App.ViewKey.DEBTOR_DETAIL, renderDebtorDetailFromState);
    rendererRegistered = true;
  }

  App.debtorDetail.renderImpl = function (id) {
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
  };

  App.debtorDetail._renderImpl = App.debtorDetail.renderImpl;

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

      if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
        App.api.view.invalidate(App.ViewKey.DEBTOR_DETAIL);
        return;
      }
      if (App.renderCoordinator && typeof App.renderCoordinator.invalidate === 'function' && App.ViewKey) {
        App.renderCoordinator.invalidate(App.ViewKey.DEBTOR_DETAIL);
      }
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

    if (App.debtorDetail && typeof App.debtorDetail.renderImpl === 'function') {
      App.debtorDetail.renderImpl(id);
      return;
    }

    syncPanel();
  }
  renderDebtorDetailFromState._ls_fromUIState = true;

  App.debtorDetail.init = function () {
    if (initialized) return;
    initialized = true;
    ensureRendererRegistered();
  };

  App.debtors.openDetail = App.debtors.openDetail || function (id) {
    if (App.debtorDetail && typeof App.debtorDetail.render === 'function') {
      App.debtorDetail.render(id);
    }
  };

  App.debtorDetail.show = function () {
    syncPanel();
  };
})();
