
// DebtorDetail DOM Wrapper (v133)
window.App = window.App || {};
App.debtorDetail = App.debtorDetail || {};


// Stage 6: preserve the original DOM rendering implementation,
// but deprecate the external render() entrypoint.
App.debtorDetail.renderImpl = function(id){
   var debtorId = id != null ? String(id) : null;
   if (!debtorId) return;

   // locate panel root
   var panelRoot = document.getElementById('debtor-panel-root');
   if (!panelRoot) return;

   // clear existing content
   while (panelRoot.firstChild) {
      panelRoot.removeChild(panelRoot.firstChild);
   }

   // create detail root for DebtorDetail engine
   var detailRoot = document.createElement('div');
   detailRoot.id = 'debtor-detail-root';
   panelRoot.appendChild(detailRoot);

   // call v126-style DebtorDetail engine
   if (App.modules && App.modules.DebtorDetail && typeof App.modules.DebtorDetail.render === 'function') {
      App.modules.DebtorDetail.render(debtorId);
   }

   // ensure side panel shows detail view
   if (App.debtorPanel && typeof App.debtorPanel.showDetail === 'function') {
      App.debtorPanel.showDetail();
   }

   // emit compatibility event
   if (typeof document !== 'undefined' && document.dispatchEvent) {
      document.dispatchEvent(new Event('detail-render-complete'));
   }
};

App.debtorDetail._renderImpl = App.debtorDetail.renderImpl;

// @deprecated Stage 6: direct render() is deprecated. Use invalidate/commit pipeline.
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

      // Keep v001 UX: if an id is provided, navigate to that detail via the view API.
      if (App.api && App.api.view && typeof App.api.view.openDebtorDetail === 'function' && id != null) {
         App.api.view.openDebtorDetail(id);
         return;
      }

      // Otherwise, just invalidate the current detail view.
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

// Stage 2+: Register a no-arg renderer that renders based on current UI selection.
// (Keeps renderImpl unchanged; ensures invalidate-only pipeline works.)
if (App.renderCoordinator && App.ViewKey && App.ViewKey.DEBTOR_DETAIL) {
   var __renderDebtorDetailFromState = function () {
      var id = App.state && App.state.ui && App.state.ui.debtorPanel && App.state.ui.debtorPanel.selectedDebtorId;
      if (id == null) return;
      if (App.debtorDetail && typeof App.debtorDetail.renderImpl === 'function') {
         App.debtorDetail.renderImpl(String(id));
      }
   };
   __renderDebtorDetailFromState._ls_fromUIState = true;
   App.renderCoordinator.register(App.ViewKey.DEBTOR_DETAIL, __renderDebtorDetailFromState);
}

// wrap existing openDetail call if exists
App.debtors = App.debtors || {};
App.debtors.openDetail = App.debtors.openDetail || function(id){
    if(App.debtorDetail.render){
        App.debtorDetail.render(id);
    }
};

// NEW: ensure DOM visibility controlled by debtorPanel
App.debtorDetail.show = function(){
   if(App.debtorPanel && App.debtorPanel.showDetail){
      App.debtorPanel.showDetail();
   }
};

// NEW: simple binding to detect detail render completion
// (Assumes detail engine writes into #debtor-panel-root)
document.addEventListener("detail-render-complete", function(){
   App.debtorDetail.show();
});
