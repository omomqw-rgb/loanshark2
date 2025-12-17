// Debtor sidepanel control (v146 rebuilt)
window.App = window.App || {};
App.debtorPanel = App.debtorPanel || {};

App.debtorPanel.init = function() {
  var panel = document.getElementById('debtor-sidepanel');
  if (!panel) return;
  var header = panel.querySelector('.debtor-sidepanel-header');
  if (!header) return;

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
};

App.debtorPanel.showList = function() {
  var search = document.querySelector('.dlist-topbar');
  var pagination = document.querySelector('.dlist-pagination');
  var list = document.getElementById('debtor-list-root');
  var detail = document.getElementById('debtor-panel-root');

  if (search) search.style.display = '';
  if (pagination) pagination.style.display = '';
  if (list) list.style.display = '';
  if (detail) detail.style.display = 'none';
};

App.debtorPanel.showDetail = function() {

  var search = document.querySelector('.dlist-topbar');
  var pagination = document.querySelector('.dlist-pagination');
  var list = document.getElementById('debtor-list-root');
  var detail = document.getElementById('debtor-panel-root');

  if (search) search.style.display = 'none';
  if (pagination) pagination.style.display = 'none';
  if (list) list.style.display = 'none';
  if (detail) detail.style.display = 'block';

};

document.addEventListener('DOMContentLoaded', function () {
  if (App.debtorPanel && typeof App.debtorPanel.init === 'function') {
    App.debtorPanel.init();
  }
});