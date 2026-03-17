(function (window) {
  'use strict';

  var App = window.App || (window.App = {});
  var portfolioProxy = null;

  function isObject(value) {
    return !!value && typeof value === 'object';
  }

  function cloneDefaultReportState() {
    if (App && typeof App.getDefaultReportState === 'function') {
      return App.getDefaultReportState();
    }
    return {
      activeSection: 'overview',
      portfolioMode: 'loan',
      trend: {
        period: 'monthly',
        dateFrom: null,
        dateTo: null
      },
      risk: {
        dateFrom: null,
        dateTo: null
      },
      legendVisibility: {
        capitalflow: {
          velocity: true,
          inflow: true,
          outflow: true,
          net: true
        }
      }
    };
  }

  function normalizeDateValue(value) {
    return (typeof value === 'string' && value) ? value : null;
  }

  function normalizeLegendBoolean(value, fallbackValue) {
    return (typeof value === 'boolean') ? value : !!fallbackValue;
  }

  function sanitizeLegendGroup(defaultGroup, currentGroup) {
    var out = {};
    var source = isObject(currentGroup) ? currentGroup : {};
    for (var key in defaultGroup) {
      if (!Object.prototype.hasOwnProperty.call(defaultGroup, key)) continue;
      out[key] = normalizeLegendBoolean(source[key], defaultGroup[key]);
    }
    return out;
  }

  function sanitizeLegendVisibility(defaults, legendVisibility) {
    var defaultLegend = isObject(defaults && defaults.legendVisibility) ? defaults.legendVisibility : {};
    var source = isObject(legendVisibility) ? legendVisibility : {};
    var out = {};
    for (var groupKey in defaultLegend) {
      if (!Object.prototype.hasOwnProperty.call(defaultLegend, groupKey)) continue;
      out[groupKey] = sanitizeLegendGroup(defaultLegend[groupKey], source[groupKey]);
    }
    return out;
  }

  function ensureReportState() {
    var defaults = cloneDefaultReportState();

    App.state = App.state || {};
    App.state.ui = App.state.ui || {};
    if (!isObject(App.state.ui.report)) {
      App.state.ui.report = defaults;
      return App.state.ui.report;
    }

    var report = App.state.ui.report;
    report.activeSection = (report.activeSection === 'statistics' || report.activeSection === 'capitalflow' || report.activeSection === 'risk' || report.activeSection === 'overview')
      ? report.activeSection
      : defaults.activeSection;
    report.portfolioMode = (report.portfolioMode === 'claim' || report.portfolioMode === 'loan')
      ? report.portfolioMode
      : defaults.portfolioMode;

    if (!isObject(report.trend)) {
      report.trend = defaults.trend;
    }
    report.trend.period = (typeof report.trend.period === 'string' && report.trend.period)
      ? report.trend.period
      : defaults.trend.period;
    report.trend.dateFrom = normalizeDateValue(report.trend.dateFrom);
    report.trend.dateTo = normalizeDateValue(report.trend.dateTo);

    if (!isObject(report.risk)) {
      report.risk = defaults.risk;
    }
    report.risk.dateFrom = normalizeDateValue(report.risk.dateFrom);
    report.risk.dateTo = normalizeDateValue(report.risk.dateTo);

    report.legendVisibility = sanitizeLegendVisibility(defaults, report.legendVisibility);

    return report;
  }

  function getPortfolioProxy() {
    if (portfolioProxy) return portfolioProxy;

    portfolioProxy = {};
    try {
      Object.defineProperty(portfolioProxy, 'mode', {
        configurable: true,
        enumerable: true,
        get: function () {
          return ensureReportState().portfolioMode;
        },
        set: function (value) {
          ensureReportState().portfolioMode = (value === 'claim') ? 'claim' : 'loan';
        }
      });
    } catch (e) {
      portfolioProxy.mode = ensureReportState().portfolioMode;
    }

    return portfolioProxy;
  }

  App.reportState = App.reportState || {};
  App.reportState.ensure = ensureReportState;
  App.reportState.get = ensureReportState;
  App.reportState.getActiveSection = function () {
    return ensureReportState().activeSection;
  };
  App.reportState.setActiveSection = function (value) {
    ensureReportState().activeSection = (value === 'statistics' || value === 'capitalflow' || value === 'risk' || value === 'overview')
      ? value
      : 'overview';
  };
  App.reportState.getPortfolioMode = function () {
    return ensureReportState().portfolioMode;
  };
  App.reportState.setPortfolioMode = function (value) {
    ensureReportState().portfolioMode = (value === 'claim') ? 'claim' : 'loan';
  };
  App.reportState.getTrend = function () {
    return ensureReportState().trend;
  };
  App.reportState.setTrendPeriod = function (value) {
    ensureReportState().trend.period = (typeof value === 'string' && value) ? value : 'monthly';
  };
  App.reportState.setTrendRange = function (dateFrom, dateTo) {
    var trend = ensureReportState().trend;
    trend.dateFrom = normalizeDateValue(dateFrom);
    trend.dateTo = normalizeDateValue(dateTo);
  };
  App.reportState.getRisk = function () {
    return ensureReportState().risk;
  };
  App.reportState.setRiskRange = function (dateFrom, dateTo) {
    var risk = ensureReportState().risk;
    risk.dateFrom = normalizeDateValue(dateFrom);
    risk.dateTo = normalizeDateValue(dateTo);
  };
  App.reportState.getLegendGroup = function (groupKey) {
    var report = ensureReportState();
    var defaults = cloneDefaultReportState();
    var defaultLegend = isObject(defaults.legendVisibility) ? defaults.legendVisibility : {};
    var resolvedGroupKey = Object.prototype.hasOwnProperty.call(defaultLegend, groupKey) ? groupKey : 'capitalflow';
    report.legendVisibility = sanitizeLegendVisibility(defaults, report.legendVisibility);
    return report.legendVisibility[resolvedGroupKey];
  };
  App.reportState.getLegendVisibility = function (groupKey, seriesKey) {
    var group = App.reportState.getLegendGroup(groupKey);
    if (!Object.prototype.hasOwnProperty.call(group, seriesKey)) return true;
    return group[seriesKey] !== false;
  };
  App.reportState.setLegendVisibility = function (groupKey, seriesKey, value) {
    var group = App.reportState.getLegendGroup(groupKey);
    if (!Object.prototype.hasOwnProperty.call(group, seriesKey)) return;
    group[seriesKey] = (typeof value === 'boolean') ? value : !!value;
  };
  App.reportState.toggleLegendVisibility = function (groupKey, seriesKey) {
    var group = App.reportState.getLegendGroup(groupKey);
    if (!Object.prototype.hasOwnProperty.call(group, seriesKey)) return true;
    group[seriesKey] = !group[seriesKey];
    return group[seriesKey];
  };

  try {
    Object.defineProperty(App, 'reportTrendState', {
      configurable: true,
      enumerable: true,
      get: function () {
        return ensureReportState().trend;
      },
      set: function (value) {
        if (!isObject(value)) return;
        var trend = ensureReportState().trend;
        if (typeof value.period === 'string' && value.period) trend.period = value.period;
        if (Object.prototype.hasOwnProperty.call(value, 'dateFrom')) trend.dateFrom = normalizeDateValue(value.dateFrom);
        if (Object.prototype.hasOwnProperty.call(value, 'dateTo')) trend.dateTo = normalizeDateValue(value.dateTo);
      }
    });

    Object.defineProperty(App, 'reportRiskState', {
      configurable: true,
      enumerable: true,
      get: function () {
        return ensureReportState().risk;
      },
      set: function (value) {
        if (!isObject(value)) return;
        var risk = ensureReportState().risk;
        if (Object.prototype.hasOwnProperty.call(value, 'dateFrom')) risk.dateFrom = normalizeDateValue(value.dateFrom);
        if (Object.prototype.hasOwnProperty.call(value, 'dateTo')) risk.dateTo = normalizeDateValue(value.dateTo);
      }
    });

    Object.defineProperty(App, 'reportPortfolioState', {
      configurable: true,
      enumerable: true,
      get: function () {
        return getPortfolioProxy();
      },
      set: function (value) {
        if (!isObject(value)) return;
        if (Object.prototype.hasOwnProperty.call(value, 'mode')) {
          ensureReportState().portfolioMode = (value.mode === 'claim') ? 'claim' : 'loan';
        }
      }
    });
  } catch (e) {
    App.reportTrendState = ensureReportState().trend;
    App.reportRiskState = ensureReportState().risk;
    App.reportPortfolioState = getPortfolioProxy();
  }

  ensureReportState();
})(window);
