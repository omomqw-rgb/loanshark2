// Loan card template component (bootstrap stage)
// This does NOT change existing behavior yet.
// Later, Debtors.renderLoanList can opt-in to use this.
window.Components = window.Components || {};
window.Components.createLoanCard = function(loan) {
  var el = document.createElement('div');
  el.className = 'loan-card loan-card-template';
  // Minimal placeholder; real layout will be filled in later patches.
  var title = document.createElement('div');
  title.className = 'loan-card-title';
  title.textContent = loan && loan.title ? loan.title : (loan && loan.debtorName ? loan.debtorName : '대출');
  var amount = document.createElement('div');
  amount.className = 'loan-card-amount';
  var value = (loan && (loan.totalRepayAmount || loan.principal || loan.amount)) || 0;
  amount.textContent = value;
  el.appendChild(title);
  el.appendChild(amount);
  return el;
};
