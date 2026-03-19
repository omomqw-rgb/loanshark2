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
      var section = root ? (root.querySelector('.overview-panel-recovery-new') || root) : null;
      return {
        root: root,
        section: section,
        summaryRoot: section ? (section.querySelector('.recovery-kpi-grid') || section) : null,
        trendsRoot: section ? (section.querySelector('.recovery-flow-chart-box') || section) : null
      };
    }

    function getRecoverySemantics(context) {
      var recovery = context && context.recovery ? context.recovery : {};
      var metaWeek = context && context.meta ? context.meta.weekSemantics : null;
      return {
        label: recovery.label || '회수 흐름',
        description: recovery.description || '스케줄 기준 예정액과 실제 회수액의 회수 흐름/추세입니다. 실제 현금성 자본 이동을 보여주는 Capital Flow와는 다른 의미 계약입니다.',
        basis: recovery.basis || 'scheduled-recovery-trend',
        basisText: recovery.basisText || '스케줄 기준 예정액·실회수 추세',
        flowType: recovery.flowType || 'recovery-trend',
        weekSemantics: recovery.weekSemantics || metaWeek || null
      };
    }

    function ensureTextHost(parent, selector, tagName, className, dataRole) {
      if (!parent) return null;
      var node = parent.querySelector(selector);
      if (node) return node;
      node = document.createElement(tagName || 'div');
      if (className) node.className = className;
      if (dataRole) node.setAttribute('data-role', dataRole);
      parent.appendChild(node);
      return node;
    }

    function ensureHeaderCopy(section) {
      if (!section) return null;
      var header = ensureTextHost(section, '[data-role="recovery-header"]', 'div', 'overview-panel-header recovery-section-header', 'recovery-header');
      var main = ensureTextHost(header, '[data-role="recovery-header-main"]', 'div', 'recovery-header-main', 'recovery-header-main');
      var copy = ensureTextHost(main, '[data-role="recovery-header-copy"]', 'div', 'recovery-header-copy', 'recovery-header-copy');
      var title = ensureTextHost(copy, '[data-role="recovery-title"]', 'h3', 'overview-panel-title recovery-section-title', 'recovery-title');
      var meta = ensureTextHost(copy, '[data-role="recovery-header-meta"]', 'div', 'recovery-header-meta', 'recovery-header-meta');
      var desc = ensureTextHost(meta, '[data-role="recovery-description"]', 'p', 'report-section-desc recovery-section-desc', 'recovery-description');
      var basis = ensureTextHost(meta, '[data-role="recovery-basis"]', 'p', 'report-section-desc report-section-meta-note recovery-section-basis', 'recovery-basis');
      if (desc.parentNode !== meta) meta.appendChild(desc);
      if (basis.parentNode !== meta) meta.appendChild(basis);
      return {
        header: header,
        main: main,
        copy: copy,
        meta: meta,
        title: title,
        desc: desc,
        basis: basis
      };
    }

    function syncRecoverySemantics(root, context) {
      if (!root) return;
      var bundle = resolveRootBundle(root);
      var section = bundle.section;
      if (!section) return;

      var semantics = getRecoverySemantics(context || lastContext || {});
      var hosts = ensureHeaderCopy(section);
      if (!hosts) return;

      hosts.title.textContent = semantics.label || '회수 흐름';
      hosts.desc.textContent = semantics.description || '';
      hosts.basis.textContent = semantics.basisText || '';

      if (hosts.desc.textContent) {
        hosts.desc.removeAttribute('hidden');
      } else {
        hosts.desc.setAttribute('hidden', 'hidden');
      }
      if (hosts.basis.textContent) {
        hosts.basis.removeAttribute('hidden');
      } else {
        hosts.basis.setAttribute('hidden', 'hidden');
      }
      if (hosts.meta) {
        if (hosts.desc.textContent || hosts.basis.textContent) {
          hosts.meta.removeAttribute('hidden');
        } else {
          hosts.meta.setAttribute('hidden', 'hidden');
        }
      }
      if (hosts.copy) {
        hosts.copy.setAttribute('data-recovery-flow-type', semantics.flowType || 'recovery-trend');
        hosts.copy.setAttribute('data-recovery-basis', semantics.basis || 'scheduled-recovery-trend');
      }

      section.setAttribute('data-recovery-basis', semantics.basis || 'scheduled-recovery-trend');
      section.setAttribute('data-recovery-flow-type', semantics.flowType || 'recovery-trend');
      if (hosts.header) {
        hosts.header.setAttribute('data-recovery-basis', semantics.basis || 'scheduled-recovery-trend');
        hosts.header.setAttribute('data-recovery-flow-type', semantics.flowType || 'recovery-trend');
      }

      var weekAnchor = semantics.weekSemantics && semantics.weekSemantics.weekAnchor
        ? semantics.weekSemantics.weekAnchor
        : 'monday';
      section.setAttribute('data-week-anchor', weekAnchor);
      var chartBox = section.querySelector('.recovery-flow-chart-box');
      if (chartBox) {
        chartBox.setAttribute('data-week-anchor', weekAnchor);
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
        recovery: context.recovery ? {
          basis: context.recovery.basis || null,
          label: context.recovery.label || null,
          description: context.recovery.description || null,
          basisText: context.recovery.basisText || null,
          flowType: context.recovery.flowType || null,
          weekSemantics: context.recovery.weekSemantics || null
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
