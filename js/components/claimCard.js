// Claim card template component (bootstrap stage)
window.Components = window.Components || {};
window.Components.createClaimCard = function(claim) {
  var el = document.createElement('div');
  el.className = 'claim-card claim-card-template';
  var title = document.createElement('div');
  title.className = 'claim-card-title';
  title.textContent = claim && claim.title ? claim.title : '채권';
  var amount = document.createElement('div');
  amount.className = 'claim-card-amount';
  var value = (claim && (claim.amount || claim.totalAmount)) || 0;
  amount.textContent = value;
  el.appendChild(title);
  el.appendChild(amount);
  return el;
};
