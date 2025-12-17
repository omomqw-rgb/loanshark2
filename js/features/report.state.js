(function (window) {
  'use strict';
  var App = window.App || (window.App = {});
  App.reportTrendState = App.reportTrendState || { period: 'monthly', dateFrom: null, dateTo: null };
  App.reportRiskState = App.reportRiskState || { dateFrom: null, dateTo: null };
  App.reportPortfolioState = App.reportPortfolioState || { mode: 'loan' };
})(window);
