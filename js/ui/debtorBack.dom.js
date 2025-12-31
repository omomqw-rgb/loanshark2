document.addEventListener("click", function(e){
  // v205: debtor-back-to-list + v126 debtor-list-mode 둘 다 지원
  var b = e.target.closest("[data-action='debtor-back-to-list'], [data-action='debtor-list-mode']");
  if(!b) return;

  // Stage 3: Navigation boundary via App.api.view
  if (window.App && App.api && App.api.view && typeof App.api.view.openDebtorList === 'function') {
    App.api.view.openDebtorList();
  }
});