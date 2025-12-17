(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  App.ui = App.ui || {};

  function clearRoot(id) {
    var el = document.getElementById(id);
    if (el) {
      el.innerHTML = '';
    }
  }

  function init() {
    // v246: DebtorDetail / Calendar / Monitoring 영역은 JS가 직접 렌더링하므로,
    // 초기화 시 기존 템플릿 콘텐츠를 비워 둔다.
    clearRoot('debtor-panel-root');
    clearRoot('calendar-root');
    clearRoot('monitoring-root');

    // Report Overview는 index.html에 직접 정의된 레이아웃을 사용하므로
    // report-root는 초기화 단계에서 비우지 않는다.
    // (Overview KPI의 값 교체는 report.js(updateOverviewKPI)에서 수행)
  }

  App.ui.layout = { init: init };
})(window, document);
