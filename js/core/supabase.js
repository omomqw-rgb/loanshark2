(function (window) {
  'use strict';
  var App = window.App || (window.App = {});

  var SUPABASE_URL = "https://etbuvbsvrxbbkidwdhrs.supabase.co";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0YnV2YnN2cnhiYmtpZHdkaHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NDg0MDgsImV4cCI6MjA4MTUyNDQwOH0.MFGnoeqZ0m6WFjdLb3NFrqgQ6hPzApVOPb-tTdfuMIA"; // anon or service role key

  if (window.supabase && typeof window.supabase.createClient === 'function') {
    App.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.warn('[Supabase] Global supabase client is not available.');
    App.supabase = null;
  }


  // Stage 6.1: Guard helpers for cloud operations (prevent unauthenticated access).
  App.supabaseGuard = App.supabaseGuard || {};
  App.supabaseGuard.getUserId = function () {
    return (App.user && App.user.id) ? App.user.id : null;
  };
  App.supabaseGuard.requireLogin = function (actionLabel) {
    var userId = (App.user && App.user.id) ? App.user.id : null;
    if (!userId) {
      try {
        console.warn('[Supabase] ' + (actionLabel || 'Action') + ' blocked: not authenticated.');
      } catch (e) {}
      if (typeof App.showToast === 'function') {
        App.showToast("로그인이 필요합니다.");
      }
      return null;
    }
    return userId;
  };
})(window);
