const DDInfo = {
  create(ctx) {
    const card = document.createElement('div');
    card.className = 'dd-card dd-info-card';
    card.setAttribute('data-dd-section','info');

    const grid = document.createElement('div');
    grid.className = 'dd-info-grid';

    const rows = [
      ['성별', ctx.debtor.gender || '-', '생년월일', ctx.debtor.birth || '-'],
      ['지역', ctx.debtor.region || '-', '직장', ctx.debtor.job || '-'],
      ['Mobile', ctx.debtor.phone || '-', 'RiskTier', ctx.debtor.riskTier || 'B']
    ];

    rows.forEach(function (r, idx) {
      const l1 = document.createElement('div');
      l1.className = 'label';
      l1.textContent = r[0];

      const v1 = document.createElement('div');
      v1.className = 'value';
      v1.textContent = r[1];

      const l2 = document.createElement('div');
      l2.className = 'label';
      l2.textContent = r[2];

      const v2 = document.createElement('div');
      v2.className = 'value';
      v2.textContent = r[3];

      // RiskTier 강조 스타일
      if (idx === 2) {
        v2.className += ' dd-risktier-value';
      }

      grid.append(l1, v1, l2, v2);
    });

    // 메모 행 추가
    const noteLabel = document.createElement('div');
    noteLabel.className = 'label';
    noteLabel.textContent = '메모';

    const noteValue = document.createElement('div');
    noteValue.className = 'value';
    const rawNote = ctx.debtor && ctx.debtor.note != null ? String(ctx.debtor.note).trim() : '';
    noteValue.textContent = rawNote ? rawNote : '-';

    // 메모 값은 남은 컬럼을 모두 차지하도록 확장
    noteValue.style.gridColumn = '2 / 5';

    grid.append(noteLabel, noteValue);

    card.append(grid);
    return card;
  }
};
