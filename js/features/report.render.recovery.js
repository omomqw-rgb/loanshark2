(function (window, document) {
  'use strict';
  window.App = window.App || {};
  var App = window.App;
  App.reportRender = App.reportRender || {};
  App.features = App.features || {};

  App.reportRender.recovery = (function () {

    function init(root) {
      if (!root) return null;

      var summaryRoot = root.querySelector('.recovery-kpi-grid') || root;
      var trendsRoot = root.querySelector('.recovery-flow-chart-box') || root;

      var summaryController = null;
      if (App.features.recoverySummary && typeof App.features.recoverySummary.init === 'function') {
        summaryController = App.features.recoverySummary.init(summaryRoot);
      }

      var trendsController = null;
      if (App.features.capitalFlow && typeof App.features.capitalFlow.init === 'function') {
        var options = summaryController && typeof summaryController.updateFromSeries === 'function'
          ? { summaryController: summaryController }
          : {};
        trendsController = App.features.capitalFlow.init(trendsRoot, options);
      }

      return {
        summary: summaryController,
        trends: trendsController
      };
    }

    return {
      init: init,
      renderRecoveryChart: init
    };
  })();
})(window, document);
