(function (window, document) {
  'use strict';
  window.App = window.App || {};
  var App = window.App;
  App.reportRender = App.reportRender || {};
  App.features = App.features || {};

  App.reportRender.recovery = (function () {
    var mountedRoot = null;
    var lastContext = null;
    var controllers = {
      summary: null,
      trends: null
    };

    function resolveRootBundle(root) {
      return {
        root: root,
        summaryRoot: root ? (root.querySelector('.recovery-kpi-grid') || root) : null,
        trendsRoot: root ? (root.querySelector('.recovery-flow-chart-box') || root) : null
      };
    }

    function getRecoverySemantics(context) {
      var overview = context && context.overview ? context.overview : {};
      return {
        label: overview.recoveryLabel || '회수 흐름',
        description: overview.recoveryDescription || '스케줄 기준 예정액과 실제 회수액의 회수 흐름/추세입니다. 실제 현금성 자본 이동을 보여주는 Capital Flow와는 다른 의미 계약입니다.',
        basis: overview.recoveryBasis || 'scheduled-recovery-trend',
        basisText: overview.recoveryBasisText || '스케줄 기준 예정액·실회수 추세',
        flowType: overview.recoveryFlowType || 'recovery-trend',
        weekSemantics: overview.weekSemantics || (context && context.meta ? context.meta.weekSemantics : null)
      };
    }

    function syncRecoverySemantics(root, context) {
      if (!root) return;
      var section = root.querySelector('.overview-panel-recovery-new');
      if (!section) return;

      var semantics = getRecoverySemantics(context);
      var header = section.querySelector('.overview-panel-header');
      var title = section.querySelector('.overview-panel-title');
      if (title) {
        title.textContent = semantics.label || '회수 흐름';
      }
      if (header) {
        var desc = header.querySelector('.report-section-desc[data-role="overview-recovery-desc"]');
        if (!desc) {
          desc = document.createElement('p');
          desc.className = 'report-section-desc';
          desc.setAttribute('data-role', 'overview-recovery-desc');
          header.appendChild(desc);
        }
        desc.textContent = semantics.description || semantics.basisText || '';
      }

      section.setAttribute('data-recovery-basis', semantics.basis || 'scheduled-recovery-trend');
      section.setAttribute('data-recovery-flow-type', semantics.flowType || 'recovery-trend');

      var chartBox = section.querySelector('.recovery-flow-chart-box');
      if (chartBox) {
        chartBox.setAttribute('data-week-anchor', semantics.weekSemantics && semantics.weekSemantics.weekAnchor ? semantics.weekSemantics.weekAnchor : 'monday');
      }
    }

    function bindSummaryController(trendsController, summaryController) {
      if (!trendsController) return;
      if (typeof trendsController.setSummaryController === 'function') {
        trendsController.setSummaryController(summaryController || null);
        return;
      }
      if (App.features && App.features.capitalFlow && typeof App.features.capitalFlow.getState === 'function') {
        var trendState = App.features.capitalFlow.getState();
        if (trendState) trendState.summaryController = summaryController || null;
      }
    }

    function rememberContext(context) {
      if (!context || typeof context !== 'object') return lastContext;
      lastContext = {
        meta: context.meta || null,
        ui: context.ui || null,
        overview: context.overview ? {
          tiles: context.overview.tiles || null,
          recoveryBasis: context.overview.recoveryBasis || null,
          recoveryLabel: context.overview.recoveryLabel || null,
          recoveryDescription: context.overview.recoveryDescription || null,
          recoveryBasisText: context.overview.recoveryBasisText || null,
          recoveryFlowType: context.overview.recoveryFlowType || null,
          weekSemantics: context.overview.weekSemantics || null
        } : null
      };
      return lastContext;
    }

    function mount(root) {
      if (!root) return null;

      var bundle = resolveRootBundle(root);
      var summaryController = null;
      if (App.features.recoverySummary && typeof App.features.recoverySummary.init === 'function') {
        summaryController = App.features.recoverySummary.init(bundle.summaryRoot);
      }

      var trendsController = null;
      if (App.features.capitalFlow && typeof App.features.capitalFlow.init === 'function') {
        var options = summaryController && typeof summaryController.updateFromSeries === 'function'
          ? { summaryController: summaryController }
          : {};
        trendsController = App.features.capitalFlow.init(bundle.trendsRoot, options);
      }

      mountedRoot = root;
      controllers.summary = summaryController;
      controllers.trends = trendsController;
      bindSummaryController(trendsController, summaryController);
      return controllers;
    }

    function ensure(root, context) {
      rememberContext(context);
      syncRecoverySemantics(root, context);
      if (!root) return null;
      if (mountedRoot !== root) {
        return mount(root);
      }

      var bundle = resolveRootBundle(root);
      if (!controllers.summary && App.features.recoverySummary && typeof App.features.recoverySummary.init === 'function') {
        controllers.summary = App.features.recoverySummary.init(bundle.summaryRoot);
      }
      if (!controllers.trends && App.features.capitalFlow && typeof App.features.capitalFlow.init === 'function') {
        var options = controllers.summary && typeof controllers.summary.updateFromSeries === 'function'
          ? { summaryController: controllers.summary }
          : {};
        controllers.trends = App.features.capitalFlow.init(bundle.trendsRoot, options);
      }
      bindSummaryController(controllers.trends, controllers.summary);
      return controllers;
    }

    function update(root, context) {
      rememberContext(context);
      var activeRoot = root || mountedRoot;
      syncRecoverySemantics(activeRoot, context || lastContext);
      var activeControllers = ensure(activeRoot, context || lastContext);
      if (!activeControllers) return null;
      bindSummaryController(activeControllers.trends, activeControllers.summary);
      if (activeControllers.trends && typeof activeControllers.trends.update === 'function') {
        activeControllers.trends.update();
      }
      return activeControllers;
    }

    function render(root, context) {
      return update(root, context);
    }

    function sync(root, context) {
      return update(root, context);
    }

    function init(root, context) {
      return ensure(root, context);
    }

    return {
      init: init,
      ensure: ensure,
      update: update,
      render: render,
      sync: sync,
      renderRecoveryChart: update
    };
  })();
})(window, document);
