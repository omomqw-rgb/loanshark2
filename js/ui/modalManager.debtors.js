(function (window, document) {
  'use strict';

  var App = window.App || (window.App = window.App || {});
  App.modalManager = App.modalManager || {};
  var Modal = App.modalManager;

  // 공용 유틸 (필요 시 최초 한 번만 생성)
  var util = App.util || (App.util = {
    escapeHTML: function (str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },
    formatDate: function (dateStr) {
      if (!dateStr) return '';
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    },
    formatCurrency: function (num) {
      var n = Number(num || 0);
      if (!isFinite(n)) n = 0;
      return n.toLocaleString('ko-KR');
    }
  });

  var SCHEDULE_STATUS_OPTIONS = [
    { value: 'PLANNED', label: '예정' },
    { value: 'PAID', label: '완납' },
    { value: 'PARTIAL', label: '부분납' },
    { value: 'OVERDUE', label: '미납' }
  ];

  // 모달 UI 전용: "사실상 완납" 판정 (status/저장/도메인 로직 변경 없음)
  function isFullyPaidUI(s) {
    const total = Number(s.amount || 0);
    const paid  = Number(s.partialPaidAmount || 0);
    return total > 0 && paid >= total;
  }

  var modalInitialized = false;

  function ensureModalEvents() {
    if (!modalInitialized) {
      attachModalEvents();
    }
  }

  function attachModalEvents() {
    var modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;

    modalInitialized = true;

    modalRoot.addEventListener('click', function (event) {
      var t = event.target;
      if (t.closest('[data-action="modal-close"]')) {
        closeModal();
        return;
      }
    });

    modalRoot.addEventListener('submit', function (event) {
      var form = event.target;
      if (!form.matches('[data-role="modal-form"]')) return;
      event.preventDefault();

      var kind = form.getAttribute('data-modal-kind');
      var api = App.features && App.features.debtorsHandlers;
      // Stage 4A: schedule 저장은 App.api.domain.schedule 경유로 처리한다.
      // (기존 handlers는 다른 모달 종류에만 사용)
      if (!api && !(kind === 'schedule-loan' || kind === 'schedule-claim')) return;

      if (kind === 'debtor-create') {
        if (App.api && App.api.domain && App.api.domain.debtor && typeof App.api.domain.debtor.createFromForm === 'function') {
          App.api.domain.debtor.createFromForm(form);
        } else if (api && api.handleDebtorCreate) {
          api.handleDebtorCreate(form);
        }
      } else if (kind === 'debtor-edit') {
        if (App.api && App.api.domain && App.api.domain.debtor && typeof App.api.domain.debtor.editFromForm === 'function') {
          App.api.domain.debtor.editFromForm(form);
        } else if (api && api.handleDebtorEdit) {
          api.handleDebtorEdit(form);
        }
      } else if (kind === 'loan-create' && api.handleLoanCreate) {
        api.handleLoanCreate(form);
      } else if (kind === 'loan-edit' && api.handleLoanEdit) {
        api.handleLoanEdit(form);
      } else if (kind === 'claim-create' && api.handleClaimCreate) {
        api.handleClaimCreate(form);
      } else if (kind === 'claim-edit' && api.handleClaimEdit) {
        api.handleClaimEdit(form);
      } else if (kind === 'schedule-loan') {
        if (App.api && App.api.domain && App.api.domain.schedule && typeof App.api.domain.schedule.saveLoanFromForm === 'function') {
          App.api.domain.schedule.saveLoanFromForm(form);
        } else if (api && api.handleLoanScheduleSave) {
          // Fallback (should not happen after Stage 4A)
          api.handleLoanScheduleSave(form);
        }
      } else if (kind === 'schedule-claim') {
        if (App.api && App.api.domain && App.api.domain.schedule && typeof App.api.domain.schedule.saveClaimFromForm === 'function') {
          App.api.domain.schedule.saveClaimFromForm(form);
        } else if (api && api.handleClaimScheduleSave) {
          // Fallback (should not happen after Stage 4A)
          api.handleClaimScheduleSave(form);
        }
      }
    });

    modalRoot.addEventListener('input', function (event) {
      var el = event.target;
      var form = el.closest('[data-role="modal-form"]');
      if (!form) return;

      var kind = form.getAttribute('data-modal-kind');

      // schedule-loan 전용: partial 금액 입력 시 "사실상 완납" UI 상태를 즉시 반영한다.
      if (kind === 'schedule-loan' && el.matches('input[data-partial-id]')) {
        var tr = el.closest('tr');
        if (tr) {
          tr.classList.remove('is-paid', 'is-overdue', 'is-partial', 'is-planned');

          var sid = el.getAttribute('data-partial-id');
          var select = sid ? form.querySelector('select[data-schedule-id="' + sid + '"]') : null;
          var st = select ? String(select.value || '').toUpperCase() : 'PLANNED';

          var sObj = sid ? findScheduleById(sid) : null;
          var sUI = {
            amount: (sObj && sObj.amount) || 0,
            partialPaidAmount: el.value
          };

          if (st === 'PAID' || isFullyPaidUI(sUI)) {
            tr.classList.add('is-paid');
          } else if (st === 'PARTIAL') {
            tr.classList.add('is-partial');
          } else if (st === 'OVERDUE') {
            tr.classList.add('is-overdue');
          } else {
            tr.classList.add('is-planned');
          }
        }
        return;
      }

      var api = App.features && App.features.debtorsHandlers;
      if (!api) return;

      if ((kind === 'loan-create' || kind === 'loan-edit') && api.handleLoanInputs) {
        api.handleLoanInputs(el, form);
      }
    });

    modalRoot.addEventListener('change', function (event) {
      var el = event.target;
      var form = el.closest('[data-role="modal-form"]');
      if (!form) return;

      var kind = form.getAttribute('data-modal-kind');

      // schedule-loan / schedule-claim: UI 전용 row 상태 클래스 즉시 동기화
      if (kind === 'schedule-loan' || kind === 'schedule-claim') {
        if (el.matches('select[data-schedule-id]')) {
          // 상태 변경 시 row(tr)에 즉시 반영: 기존 is-* 제거 후 UI 기준으로 is-* 부착
          var tr = el.closest('tr');
          if (tr) {
            tr.classList.remove('is-paid', 'is-overdue', 'is-partial', 'is-planned');

            var sid = el.getAttribute('data-schedule-id');
            var st = String(el.value || '').toUpperCase();

            var sObj = sid ? findScheduleById(sid) : null;
            // 기본은 저장된 schedule 값을 기준으로 판단 (데이터/도메인 로직 변경 없음)
            var sForUI = sObj || { amount: 0, partialPaidAmount: 0 };

            // schedule-loan + PARTIAL 선택 시에는 현재 입력값을 우선 반영 (저장과 무관하게 UI만 즉시)
            if (kind === 'schedule-loan' && st === 'PARTIAL' && sid) {
              var pInput = form.querySelector('input[data-partial-id="' + sid + '"]');
              if (pInput) {
                sForUI = {
                  amount: (sObj && sObj.amount) || 0,
                  partialPaidAmount: pInput.value === '' ? ((sObj && sObj.partialPaidAmount) || 0) : pInput.value
                };
              }
            }

            if (st === 'PAID' || isFullyPaidUI(sForUI)) {
              tr.classList.add('is-paid');
            } else if (st === 'PARTIAL') {
              tr.classList.add('is-partial');
            } else if (st === 'OVERDUE') {
              tr.classList.add('is-overdue');
            } else {
              tr.classList.add('is-planned');
            }
          }

          // schedule-loan 전용: PARTIAL 입력 필드 표시/숨김
          if (kind === 'schedule-loan') {
            var sid2 = el.getAttribute('data-schedule-id');
            var input = form.querySelector('input[data-partial-id="' + sid2 + '"]');
            if (input) {
              if (el.value === 'PARTIAL') {
                input.style.display = 'block';
              } else {
                input.style.display = 'none';
                input.value = '';
              }
            }
          }
        } else if (kind === 'schedule-loan' && el.matches('input[data-partial-id]')) {
          // 일부 브라우저에서 input[type=number]는 change 이벤트로만 잡히는 케이스가 있어 보완한다.
          var tr2 = el.closest('tr');
          if (tr2) {
            tr2.classList.remove('is-paid', 'is-overdue', 'is-partial', 'is-planned');

            var sid3 = el.getAttribute('data-partial-id');
            var select2 = sid3 ? form.querySelector('select[data-schedule-id="' + sid3 + '"]') : null;
            var st2 = select2 ? String(select2.value || '').toUpperCase() : 'PLANNED';

            var sObj2 = sid3 ? findScheduleById(sid3) : null;
            var sUI2 = {
              amount: (sObj2 && sObj2.amount) || 0,
              partialPaidAmount: el.value
            };

            if (st2 === 'PAID' || isFullyPaidUI(sUI2)) {
              tr2.classList.add('is-paid');
            } else if (st2 === 'PARTIAL') {
              tr2.classList.add('is-partial');
            } else if (st2 === 'OVERDUE') {
              tr2.classList.add('is-overdue');
            } else {
              tr2.classList.add('is-planned');
            }
          }
        }
        return;
      }

      var api = App.features && App.features.debtorsHandlers;
      if (!api) return;

      if (kind === 'loan-create' || kind === 'loan-edit') {
        if (el.name === 'loan-cycle-type' && api.updateLoanCycleVisibility) {
          api.updateLoanCycleVisibility(form);
        } else if (api.handleLoanInputs) {
          api.handleLoanInputs(el, form);
        }
      } else if (kind === 'claim-create' || kind === 'claim-edit') {
        if (el.name === 'claim-cycle-type' && api.updateClaimCycleVisibility) {
          api.updateClaimCycleVisibility(form);
        }
      }
    });
  }

  function openDebtorModal(mode, debtor) {
    ensureModalEvents();

    var modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;

    var isCreate = (mode === 'create');
    var title = isCreate ? '채무자 추가' : '채무자 수정';
    var formKind = isCreate ? 'debtor-create' : 'debtor-edit';

    debtor = debtor || {};

    var name = debtor.name || '';
    var note = debtor.note || '';

    var phone = isCreate ? '' : (debtor.phone || '');
    var gender = isCreate ? '' : (debtor.gender || '');
    var birth = isCreate ? '' : (debtor.birth || '');
    var region = isCreate ? '' : (debtor.region || '');
    var job = isCreate ? '' : (debtor.job || '');

    var riskTierAuto = '';
    var riskTierManual = '';

    if (!isCreate) {
      if (debtor.riskTierAuto != null && debtor.riskTierAuto !== '') {
        riskTierAuto = debtor.riskTierAuto;
      } else if (debtor.riskTier != null && debtor.riskTier !== '') {
        riskTierAuto = debtor.riskTier;
      } else {
        riskTierAuto = 'B';
      }
      riskTierManual = debtor.riskTierManual || '';
    }

    while (modalRoot.firstChild) {
      modalRoot.removeChild(modalRoot.firstChild);
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var modal = document.createElement('div');
    modal.className = 'modal';
    backdrop.appendChild(modal);

    var header = document.createElement('div');
    header.className = 'modal-header';
    modal.appendChild(header);

    var titleEl = document.createElement('div');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    var headerCloseBtn = document.createElement('button');
    headerCloseBtn.type = 'button';
    headerCloseBtn.className = 'btn-icon';
    headerCloseBtn.setAttribute('data-action', 'modal-close');
    headerCloseBtn.textContent = '×';
    header.appendChild(headerCloseBtn);

    var form = document.createElement('form');
    form.setAttribute('data-role', 'modal-form');
    form.setAttribute('data-modal-kind', formKind);
    if (!isCreate && debtor && debtor.id != null) {
      form.setAttribute('data-debtor-id', String(debtor.id));
    }
    modal.appendChild(form);

    var body = document.createElement('div');
    body.className = 'modal-body';
    form.appendChild(body);

    function createFieldRow(labelText, inputElement) {
      var row = document.createElement('div');
      row.className = 'form-row';

      var field = document.createElement('div');
      field.className = 'field-text';

      var labelEl = document.createElement('label');
      labelEl.textContent = labelText;
      field.appendChild(labelEl);

      field.appendChild(inputElement);
      row.appendChild(field);
      body.appendChild(row);
    }

    // 이름 (create / edit 공통)
    var nameInput = document.createElement('input');
    nameInput.name = 'debtor-name';
    nameInput.type = 'text';
    nameInput.required = true;
    nameInput.value = name || '';
    createFieldRow('이름', nameInput);

    if (!isCreate) {
      // 연락처
      var phoneInput = document.createElement('input');
      phoneInput.name = 'debtor-phone';
      phoneInput.type = 'text';
      phoneInput.value = phone || '';
      createFieldRow('연락처', phoneInput);

      // 성별
      var genderInput = document.createElement('input');
      genderInput.name = 'debtor-gender';
      genderInput.type = 'text';
      genderInput.value = gender || '';
      createFieldRow('성별', genderInput);

      // 생년월일
      var birthInput = document.createElement('input');
      birthInput.name = 'debtor-birth';
      birthInput.type = 'date';
      birthInput.value = birth || '';
      createFieldRow('생년월일', birthInput);

      // 지역
      var regionInput = document.createElement('input');
      regionInput.name = 'debtor-region';
      regionInput.type = 'text';
      regionInput.value = region || '';
      createFieldRow('지역', regionInput);

      // 직장
      var jobInput = document.createElement('input');
      jobInput.name = 'debtor-job';
      jobInput.type = 'text';
      jobInput.value = job || '';
      createFieldRow('직장', jobInput);

      // RiskTier 자동 등급 (표시 전용)
      var riskAutoInput = document.createElement('input');
      riskAutoInput.name = 'debtor-riskTier-auto';
      riskAutoInput.type = 'text';
      riskAutoInput.value = riskTierAuto || '';
      riskAutoInput.readOnly = true;
      riskAutoInput.disabled = true;
      createFieldRow('자동 등급', riskAutoInput);

      // RiskTier 수동 등급 (선택)
      var riskManualSelect = document.createElement('select');
      riskManualSelect.name = 'debtor-riskTier-manual';

      var tiers = ['', 'A', 'B', 'C', 'D', 'E'];
      var tierLabels = ['자동 기준 사용', 'A', 'B', 'C', 'D', 'E'];
      for (var i = 0; i < tiers.length; i++) {
        var opt = document.createElement('option');
        opt.value = tiers[i];
        opt.textContent = tierLabels[i];
        if (tiers[i] === (riskTierManual || '')) {
          opt.selected = true;
        }
        riskManualSelect.appendChild(opt);
      }

      createFieldRow('수동 등급', riskManualSelect);
    }

    // 메모 (create / edit 공통)
    var noteInput = document.createElement('input');
    noteInput.name = 'debtor-note';
    noteInput.type = 'text';
    noteInput.value = note || '';
    createFieldRow('메모', noteInput);

    var actions = document.createElement('div');
    actions.className = 'modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-cancel btn-sm';
    cancelBtn.setAttribute('data-action', 'modal-close');
    cancelBtn.textContent = '취소';
    actions.appendChild(cancelBtn);

    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary btn-sm';
    submitBtn.textContent = '저장';
    actions.appendChild(submitBtn);

    form.appendChild(actions);

    modalRoot.appendChild(backdrop);
  }

function openLoanModal(mode, context) {
    ensureModalEvents();

    var modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;

    var loan = context && context.loan ? context.loan : null;
    var debtorId = context && context.debtorId ? context.debtorId : (loan ? loan.debtorId : null);
    if (!debtorId) return;

    var title = (mode === 'create') ? '대출 카드 추가' : '대출 카드 수정';
    var principal = loan ? loan.principal : '';
    var rate = loan ? loan.interestRate : '';
    var total = loan ? loan.totalRepayAmount : '';
    var count = loan ? loan.installmentCount : 10;
    var cycleType = loan ? (loan.cycleType || 'day') : 'day';
    var dayInterval = loan ? (loan.dayInterval || 7) : 7;
    var weekDay = (loan && (loan.weekDay === 0 || loan.weekDay)) ? loan.weekDay : '';
    var startDate = loan ? (loan.startDate || '') : '';
    var formKind = (mode === 'create') ? 'loan-create' : 'loan-edit';

    while (modalRoot.firstChild) {
      modalRoot.removeChild(modalRoot.firstChild);
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var modal = document.createElement('div');
    modal.className = 'modal';
    backdrop.appendChild(modal);

    var header = document.createElement('div');
    header.className = 'modal-header';
    modal.appendChild(header);

    var titleEl = document.createElement('div');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    var headerCloseBtn = document.createElement('button');
    headerCloseBtn.type = 'button';
    headerCloseBtn.className = 'btn-icon';
    headerCloseBtn.setAttribute('data-action', 'modal-close');
    headerCloseBtn.textContent = '×';
    header.appendChild(headerCloseBtn);

    var form = document.createElement('form');
    form.setAttribute('data-role', 'modal-form');
    form.setAttribute('data-modal-kind', formKind);
    form.setAttribute('data-last-edited', '');
    if (loan && loan.id != null) {
      form.setAttribute('data-loan-id', String(loan.id));
    }
    form.setAttribute('data-debtor-id', String(debtorId));
    modal.appendChild(form);

    var body = document.createElement('div');
    body.className = 'modal-body';
    form.appendChild(body);

    function createRow() {
      var row = document.createElement('div');
      row.className = 'form-row';
      return row;
    }

    function createField(labelText) {
      var field = document.createElement('div');
      field.className = 'field-text';
      var labelEl = document.createElement('label');
      labelEl.textContent = labelText;
      field.appendChild(labelEl);
      return field;
    }

    var row1 = createRow();
    var fieldPrincipal = createField('대출원금');
    var principalInput = document.createElement('input');
    principalInput.name = 'loan-principal';
    principalInput.type = 'number';
    principalInput.min = '0';
    var principalStr = principal || '';
    principalInput.value = principalStr === '' ? '' : String(principalStr);
    fieldPrincipal.appendChild(principalInput);
    row1.appendChild(fieldPrincipal);
    body.appendChild(row1);

    var row2 = createRow();
    var fieldRate = createField('이자율(%)');
    var rateInput = document.createElement('input');
    rateInput.name = 'loan-rate';
    rateInput.type = 'number';
    rateInput.step = '0.1';
    var rateStr = rate || '';
    rateInput.value = rateStr === '' ? '' : String(rateStr);
    fieldRate.appendChild(rateInput);
    row2.appendChild(fieldRate);

    var fieldTotal = createField('대출원리금');
    var totalInput = document.createElement('input');
    totalInput.name = 'loan-total';
    totalInput.type = 'number';
    totalInput.min = '0';
    var totalStr = total || '';
    totalInput.value = totalStr === '' ? '' : String(totalStr);
    fieldTotal.appendChild(totalInput);
    row2.appendChild(fieldTotal);
    body.appendChild(row2);

    var row3 = createRow();
    var fieldCount = createField('총 회차');
    var countInput = document.createElement('input');
    countInput.name = 'loan-count';
    countInput.type = 'number';
    countInput.min = '1';
    var countStr = count || '';
    countInput.value = countStr === '' ? '' : String(countStr);
    fieldCount.appendChild(countInput);
    row3.appendChild(fieldCount);

    var fieldStartDate = createField('시작일');
    var startDateInput = document.createElement('input');
    startDateInput.name = 'loan-start-date';
    startDateInput.type = 'date';
    startDateInput.value = startDate || '';
    fieldStartDate.appendChild(startDateInput);
    row3.appendChild(fieldStartDate);
    body.appendChild(row3);

    var row4 = createRow();
    var fieldCycle = createField('상환주기');
    var cycleSelect = document.createElement('select');
    cycleSelect.name = 'loan-cycle-type';

    var cycleOptions = [
      { value: 'day', label: '일' },
      { value: 'week', label: '주' },
      { value: 'monthEnd', label: '월말' }
    ];
    var currentCycle = cycleType || 'day';
    for (var i = 0; i < cycleOptions.length; i++) {
      var co = cycleOptions[i];
      var optEl = document.createElement('option');
      optEl.value = co.value;
      optEl.textContent = co.label;
      if (currentCycle === co.value) {
        optEl.selected = true;
      }
      cycleSelect.appendChild(optEl);
    }
    fieldCycle.appendChild(cycleSelect);
    row4.appendChild(fieldCycle);
    body.appendChild(row4);

    var dayGroupRow = createRow();
    dayGroupRow.setAttribute('data-role', 'loan-day-group');
    dayGroupRow.style.display = (currentCycle === 'day') ? 'flex' : 'none';

    var dayField = createField('일 간격');
    var dayInput = document.createElement('input');
    dayInput.name = 'loan-day-interval';
    dayInput.type = 'number';
    dayInput.min = '1';
    var dayIntervalVal = dayInterval || 7;
    dayInput.value = String(dayIntervalVal);
    dayField.appendChild(dayInput);
    dayGroupRow.appendChild(dayField);
    body.appendChild(dayGroupRow);

    var weekGroupRow = createRow();
    weekGroupRow.setAttribute('data-role', 'loan-week-group');
    weekGroupRow.style.display = (currentCycle === 'week') ? 'flex' : 'none';

    var weekField = createField('요일');
    var weekSelect = document.createElement('select');
    weekSelect.name = 'loan-weekday';

    var weekdays = [
      { value: '', label: '선택' },
      { value: '1', label: '월' },
      { value: '2', label: '화' },
      { value: '3', label: '수' },
      { value: '4', label: '목' },
      { value: '5', label: '금' },
      { value: '6', label: '토' },
      { value: '0', label: '일' }
    ];
    var weekDayStr = (weekDay === 0 || weekDay) ? String(weekDay) : '';
    for (var j = 0; j < weekdays.length; j++) {
      var wd = weekdays[j];
      var wdOpt = document.createElement('option');
      wdOpt.value = wd.value;
      wdOpt.textContent = wd.label;
      if (weekDayStr === wd.value) {
        wdOpt.selected = true;
      }
      weekSelect.appendChild(wdOpt);
    }

    weekField.appendChild(weekSelect);
    weekGroupRow.appendChild(weekField);
    body.appendChild(weekGroupRow);

    var actions = document.createElement('div');
    actions.className = 'modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-cancel btn-sm';
    cancelBtn.setAttribute('data-action', 'modal-close');
    cancelBtn.textContent = '취소';
    actions.appendChild(cancelBtn);

    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary btn-sm';
    submitBtn.textContent = '저장';
    actions.appendChild(submitBtn);

    form.appendChild(actions);

    modalRoot.appendChild(backdrop);
  }

  function openClaimModal(mode, context) {
    ensureModalEvents();

    var modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;

    var claim = context && context.claim ? context.claim : null;
    var debtorId = context && context.debtorId ? context.debtorId : (claim ? claim.debtorId : null);
    if (!debtorId) return;

    var title = (mode === 'create') ? '채권 카드 추가' : '채권 카드 수정';
    var amount = claim ? claim.amount : '';
    var count = claim ? claim.installmentCount : 6;
    var startDate = claim ? (claim.startDate || '') : '';
    var cycleType = claim ? (claim.cycleType || 'day') : 'day';
    var dayInterval = claim ? (claim.dayInterval || 7) : 7;
    var weekDay = (claim && (claim.weekDay === 0 || claim.weekDay)) ? claim.weekDay : '';
    var memo = claim ? (claim.memo || '') : '';

    var formKind = (mode === 'create') ? 'claim-create' : 'claim-edit';

    while (modalRoot.firstChild) {
      modalRoot.removeChild(modalRoot.firstChild);
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var modal = document.createElement('div');
    modal.className = 'modal';
    backdrop.appendChild(modal);

    var header = document.createElement('div');
    header.className = 'modal-header';
    modal.appendChild(header);

    var titleEl = document.createElement('div');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    var headerCloseBtn = document.createElement('button');
    headerCloseBtn.type = 'button';
    headerCloseBtn.className = 'btn-icon';
    headerCloseBtn.setAttribute('data-action', 'modal-close');
    headerCloseBtn.textContent = '×';
    header.appendChild(headerCloseBtn);

    var form = document.createElement('form');
    form.setAttribute('data-role', 'modal-form');
    form.setAttribute('data-modal-kind', formKind);
    form.setAttribute('data-debtor-id', String(debtorId));
    if (claim && claim.id != null) {
      form.setAttribute('data-claim-id', String(claim.id));
    }
    modal.appendChild(form);

    var body = document.createElement('div');
    body.className = 'modal-body';
    form.appendChild(body);

    function createRow() {
      var row = document.createElement('div');
      row.className = 'form-row';
      return row;
    }

    function createField(labelText) {
      var field = document.createElement('div');
      field.className = 'field-text';
      var labelEl = document.createElement('label');
      labelEl.textContent = labelText;
      field.appendChild(labelEl);
      return field;
    }

    var row1 = createRow();
    var fieldAmount = createField('채권금');
    var amountInput = document.createElement('input');
    amountInput.name = 'claim-amount';
    amountInput.type = 'number';
    amountInput.min = '0';
    var amountStr = amount || '';
    amountInput.value = amountStr === '' ? '' : String(amountStr);
    fieldAmount.appendChild(amountInput);
    row1.appendChild(fieldAmount);
    body.appendChild(row1);

    var row2 = createRow();
    var fieldCount = createField('총 회차');
    var countInput = document.createElement('input');
    countInput.name = 'claim-count';
    countInput.type = 'number';
    countInput.min = '1';
    var countStr = count || '';
    countInput.value = countStr === '' ? '' : String(countStr);
    fieldCount.appendChild(countInput);
    row2.appendChild(fieldCount);

    var fieldStartDate = createField('시작일');
    var startDateInput = document.createElement('input');
    startDateInput.name = 'claim-start-date';
    startDateInput.type = 'date';
    startDateInput.value = startDate || '';
    fieldStartDate.appendChild(startDateInput);
    row2.appendChild(fieldStartDate);
    body.appendChild(row2);

    var row3 = createRow();
    var fieldCycle = createField('상환주기');
    var cycleSelect = document.createElement('select');
    cycleSelect.name = 'claim-cycle-type';

    var cycleOptions = [
      { value: 'day', label: '일' },
      { value: 'week', label: '주' },
      { value: 'monthEnd', label: '월말' }
    ];
    var currentCycle = cycleType || 'day';
    for (var i = 0; i < cycleOptions.length; i++) {
      var co = cycleOptions[i];
      var optEl = document.createElement('option');
      optEl.value = co.value;
      optEl.textContent = co.label;
      if (currentCycle === co.value) {
        optEl.selected = true;
      }
      cycleSelect.appendChild(optEl);
    }
    fieldCycle.appendChild(cycleSelect);
    row3.appendChild(fieldCycle);
    body.appendChild(row3);

    var dayGroupRow = createRow();
    dayGroupRow.setAttribute('data-role', 'claim-day-group');
    dayGroupRow.style.display = (currentCycle === 'day') ? 'flex' : 'none';

    var dayField = createField('일 간격');
    var dayInput = document.createElement('input');
    dayInput.name = 'claim-day-interval';
    dayInput.type = 'number';
    dayInput.min = '1';
    var dayIntervalVal = dayInterval || 7;
    dayInput.value = String(dayIntervalVal);
    dayField.appendChild(dayInput);
    dayGroupRow.appendChild(dayField);
    body.appendChild(dayGroupRow);

    var weekGroupRow = createRow();
    weekGroupRow.setAttribute('data-role', 'claim-week-group');
    weekGroupRow.style.display = (currentCycle === 'week') ? 'flex' : 'none';

    var weekField = createField('요일');
    var weekSelect = document.createElement('select');
    weekSelect.name = 'claim-weekday';

    var weekdays = [
      { value: '', label: '선택' },
      { value: '1', label: '월' },
      { value: '2', label: '화' },
      { value: '3', label: '수' },
      { value: '4', label: '목' },
      { value: '5', label: '금' },
      { value: '6', label: '토' },
      { value: '0', label: '일' }
    ];
    var weekDayStr = (weekDay === 0 || weekDay) ? String(weekDay) : '';
    for (var j = 0; j < weekdays.length; j++) {
      var wd = weekdays[j];
      var wdOpt = document.createElement('option');
      wdOpt.value = wd.value;
      wdOpt.textContent = wd.label;
      if (weekDayStr === wd.value) {
        wdOpt.selected = true;
      }
      weekSelect.appendChild(wdOpt);
    }

    weekField.appendChild(weekSelect);
    weekGroupRow.appendChild(weekField);
    body.appendChild(weekGroupRow);

    var rowMemo = createRow();
    var memoField = createField('메모');
    var memoInput = document.createElement('input');
    memoInput.name = 'claim-memo';
    memoInput.type = 'text';
    memoInput.value = memo || '';
    memoField.appendChild(memoInput);
    rowMemo.appendChild(memoField);
    body.appendChild(rowMemo);

    var actions = document.createElement('div');
    actions.className = 'modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-cancel btn-sm';
    cancelBtn.setAttribute('data-action', 'modal-close');
    cancelBtn.textContent = '취소';
    actions.appendChild(cancelBtn);

    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary btn-sm';
    submitBtn.textContent = '저장';
    actions.appendChild(submitBtn);

    form.appendChild(actions);

    modalRoot.appendChild(backdrop);
  }

  function findLoanById(id) {
    var loans = (App.state && App.state.loans) || [];
    for (var i = 0; i < loans.length; i++) {
      if (String(loans[i].id) === String(id)) return loans[i];
    }
    return null;
  }

  function findClaimById(id) {
    var claims = (App.state && App.state.claims) || [];
    for (var i = 0; i < claims.length; i++) {
      if (String(claims[i].id) === String(id)) return claims[i];
    }
    return null;
  }

  function findScheduleById(id) {
    var schedules = (App.state && App.state.schedules) || [];
    for (var i = 0; i < schedules.length; i++) {
      if (String(schedules[i].id) === String(id)) return schedules[i];
    }
    return null;
  }

  function openLoanScheduleModal(loanId, highlightScheduleId) {
    ensureModalEvents();

    var modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;

    var loan = findLoanById(loanId);
    if (!loan) return;

    var schedules = (App.state.schedules || []).filter(function (s) {
      return s.kind === 'loan' && s.loanId === loanId;
    }).slice().sort(function (a, b) {
      return (a.installmentNo || 0) - (b.installmentNo || 0);
    });

    var title = '대출 스케쥴 · ' + loanId;

    while (modalRoot.firstChild) {
      modalRoot.removeChild(modalRoot.firstChild);
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var modal = document.createElement('div');
    modal.className = 'modal';
    backdrop.appendChild(modal);

    var header = document.createElement('div');
    header.className = 'modal-header';
    modal.appendChild(header);

    var titleEl = document.createElement('div');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    var headerCloseBtn = document.createElement('button');
    headerCloseBtn.type = 'button';
    headerCloseBtn.className = 'btn-icon';
    headerCloseBtn.setAttribute('data-action', 'modal-close');
    headerCloseBtn.textContent = '×';
    header.appendChild(headerCloseBtn);

    var form = document.createElement('form');
    form.setAttribute('data-role', 'modal-form');
    form.setAttribute('data-modal-kind', 'schedule-loan');
    form.setAttribute('data-loan-id', String(loan.id));
    modal.appendChild(form);

    var body = document.createElement('div');
    body.className = 'modal-body';
    form.appendChild(body);

    var table = document.createElement('table');
    table.className = 'table';
    body.appendChild(table);

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    var thLabels = ['회차', '납기일', '금액', '상태'];
    for (var i = 0; i < thLabels.length; i++) {
      var th = document.createElement('th');
      th.textContent = thLabels[i];
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    table.appendChild(tbody);

    if (!schedules.length) {
      var emptyRow = document.createElement('tr');
      var emptyCell = document.createElement('td');
      emptyCell.colSpan = 4;
      var emptySpan = document.createElement('span');
      emptySpan.className = 'empty-text';
      emptySpan.textContent = '생성된 스케쥴이 없습니다.';
      emptyCell.appendChild(emptySpan);
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      for (var j = 0; j < schedules.length; j++) {
        var s = schedules[j];
        var dateLabel = util.formatDate(s.dueDate);
        var amountLabel = util.formatCurrency(s.amount);
        var partialVal = s.partialPaidAmount || '';

        var rowClasses = [];
        if (highlightScheduleId && s.id === highlightScheduleId) {
          rowClasses.push('highlight-row');
        }
        if (s.status === 'PAID' || isFullyPaidUI(s)) {
          rowClasses.push('is-paid');
        } else if (s.status === 'PARTIAL') {
          rowClasses.push('is-partial');
        } else if (s.status === 'OVERDUE') {
          rowClasses.push('is-overdue');
        } else {
          rowClasses.push('is-planned');
        }

        var tr = document.createElement('tr');
        tr.setAttribute('data-schedule-id', String(s.id));
        if (rowClasses.length) {
          tr.className = rowClasses.join(' ');
        }
        if (s.status === 'PAID') tr.classList.add('is-paid');

        var tdNo = document.createElement('td');
        tdNo.textContent = String(s.installmentNo || '');
        tr.appendChild(tdNo);

        var tdDate = document.createElement('td');
        tdDate.textContent = dateLabel || '';
        tr.appendChild(tdDate);

        var tdAmount = document.createElement('td');
        // PARTIAL 상태에서는 "입금" vs "잔여"를 DOM 기반으로 분해 표시한다.
        // (색상/토큰 값은 변경하지 않고, 표현만 추가)
        if (String(s.status || '').toUpperCase() === 'PARTIAL') {
          var totalAmount = Number(s.amount || 0);
          var paidAmount = Number(s.partialPaidAmount || 0);
          if (!isFinite(totalAmount)) totalAmount = 0;
          if (!isFinite(paidAmount)) paidAmount = 0;
          if (paidAmount < 0) paidAmount = 0;

          var remainingAmount = totalAmount - paidAmount;
          if (!isFinite(remainingAmount) || remainingAmount < 0) remainingAmount = 0;

          var breakdown = document.createElement('div');
          breakdown.className = 'schedule-amount-breakdown';

          var totalLine = document.createElement('div');
          totalLine.className = 'schedule-amount-line schedule-amount-line-total';
          var totalLabel = document.createElement('span');
          totalLabel.className = 'schedule-amount-label';
          totalLabel.textContent = '총액';
          var totalVal = document.createElement('span');
          totalVal.className = 'schedule-amount-value';
          totalVal.textContent = util.formatCurrency(totalAmount);
          totalLine.appendChild(totalLabel);
          totalLine.appendChild(totalVal);
          breakdown.appendChild(totalLine);

          var paidLine = document.createElement('div');
          paidLine.className = 'schedule-amount-line schedule-amount-line-paid';
          var paidLabel = document.createElement('span');
          paidLabel.className = 'schedule-amount-label';
          paidLabel.textContent = '입금';
          var paidVal = document.createElement('span');
          paidVal.className = 'schedule-amount-value';
          paidVal.textContent = util.formatCurrency(paidAmount);
          paidLine.appendChild(paidLabel);
          paidLine.appendChild(paidVal);
          breakdown.appendChild(paidLine);

          var remainLine = document.createElement('div');
          remainLine.className = 'schedule-amount-line schedule-amount-line-remaining';
          var remainLabel = document.createElement('span');
          remainLabel.className = 'schedule-amount-label';
          remainLabel.textContent = '잔여';
          var remainVal = document.createElement('span');
          remainVal.className = 'schedule-amount-value';
          remainVal.textContent = util.formatCurrency(remainingAmount);
          remainLine.appendChild(remainLabel);
          remainLine.appendChild(remainVal);
          breakdown.appendChild(remainLine);

          tdAmount.appendChild(breakdown);
        } else {
          tdAmount.textContent = amountLabel || '';
        }
        tr.appendChild(tdAmount);

        var tdStatus = document.createElement('td');

        var select = document.createElement('select');
        select.name = 'schedule-status';
        select.setAttribute('data-schedule-id', String(s.id));
        var currentStatus = s.status || 'PLANNED';
        for (var k = 0; k < SCHEDULE_STATUS_OPTIONS.length; k++) {
          var opt = SCHEDULE_STATUS_OPTIONS[k];
          var optEl = document.createElement('option');
          optEl.value = opt.value;
          optEl.textContent = opt.label;
          if (opt.value === currentStatus) {
            optEl.selected = true;
          }
          select.appendChild(optEl);
        }
        tdStatus.appendChild(select);

        var partialInput = document.createElement('input');
        partialInput.type = 'number';
        partialInput.min = '0';
        partialInput.className = 'partial-input';
        partialInput.setAttribute('data-partial-id', String(s.id));
        var partialStr = partialVal || '';
        partialInput.value = partialStr === '' ? '' : String(partialStr);
        partialInput.style.display = (s.status === 'PARTIAL') ? 'block' : 'none';
        partialInput.placeholder = '부분금액';
        tdStatus.appendChild(partialInput);

        tr.appendChild(tdStatus);
        tbody.appendChild(tr);
      }
    }

    var actions = document.createElement('div');
    actions.className = 'modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-cancel btn-sm';
    cancelBtn.setAttribute('data-action', 'modal-close');
    cancelBtn.textContent = '닫기';
    actions.appendChild(cancelBtn);

    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary btn-sm';
    submitBtn.textContent = '저장';
    actions.appendChild(submitBtn);

    form.appendChild(actions);

    modalRoot.appendChild(backdrop);

    if (highlightScheduleId) {
      setTimeout(function () {
        var selector = 'tr[data-schedule-id="' + highlightScheduleId + '"]';
        var rowEl = modalRoot.querySelector(selector);
        if (rowEl) {
          rowEl.classList.add('is-highlight');
          rowEl.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      }, 50);
    }
  }

  function openClaimScheduleModal(claimId, highlightScheduleId) {
    ensureModalEvents();

    var modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;

    var claim = findClaimById(claimId);
    if (!claim) return;

    var schedules = (App.state.schedules || []).filter(function (s) {
      return s.kind === 'claim' && s.claimId === claimId;
    }).slice().sort(function (a, b) {
      return (a.installmentNo || 0) - (b.installmentNo || 0);
    });

    var title = '채권 스케쥴 · ' + claimId;

    while (modalRoot.firstChild) {
      modalRoot.removeChild(modalRoot.firstChild);
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var modal = document.createElement('div');
    modal.className = 'modal';
    backdrop.appendChild(modal);

    var header = document.createElement('div');
    header.className = 'modal-header';
    modal.appendChild(header);

    var titleEl = document.createElement('div');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    var headerCloseBtn = document.createElement('button');
    headerCloseBtn.type = 'button';
    headerCloseBtn.className = 'btn-icon';
    headerCloseBtn.setAttribute('data-action', 'modal-close');
    headerCloseBtn.textContent = '×';
    header.appendChild(headerCloseBtn);

    var form = document.createElement('form');
    form.setAttribute('data-role', 'modal-form');
    form.setAttribute('data-modal-kind', 'schedule-claim');
    form.setAttribute('data-claim-id', String(claim.id));
    modal.appendChild(form);

    var body = document.createElement('div');
    body.className = 'modal-body';
    form.appendChild(body);

    var table = document.createElement('table');
    table.className = 'table';
    body.appendChild(table);

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    var thLabels = ['회차', '납기일', '금액', '상태'];
    for (var i = 0; i < thLabels.length; i++) {
      var th = document.createElement('th');
      th.textContent = thLabels[i];
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    table.appendChild(tbody);

    if (!schedules.length) {
      var emptyRow = document.createElement('tr');
      var emptyCell = document.createElement('td');
      emptyCell.colSpan = 4;
      var emptySpan = document.createElement('span');
      emptySpan.className = 'empty-text';
      emptySpan.textContent = '생성된 스케쥴이 없습니다.';
      emptyCell.appendChild(emptySpan);
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      for (var j = 0; j < schedules.length; j++) {
        var s = schedules[j];
        var dateLabel = util.formatDate(s.dueDate);
        var amountVal = s.amount || '';

        var rowClasses = [];
        if (highlightScheduleId && s.id === highlightScheduleId) {
          rowClasses.push('highlight-row');
        }
        if (s.status === 'PAID' || isFullyPaidUI(s)) {
          rowClasses.push('is-paid');
        } else if (s.status === 'PARTIAL') {
          rowClasses.push('is-partial');
        } else if (s.status === 'OVERDUE') {
          rowClasses.push('is-overdue');
        } else {
          rowClasses.push('is-planned');
        }

        var tr = document.createElement('tr');
        tr.setAttribute('data-schedule-id', String(s.id));
        if (rowClasses.length) {
          tr.className = rowClasses.join(' ');
        }

        var tdNo = document.createElement('td');
        tdNo.textContent = String(s.installmentNo || '');
        tr.appendChild(tdNo);

        var tdDate = document.createElement('td');
        tdDate.textContent = dateLabel || '';
        tr.appendChild(tdDate);

        var tdAmount = document.createElement('td');
        var amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.min = '0';
        amountInput.setAttribute('data-schedule-id', String(s.id));
        var amountStr = amountVal || '';
        amountInput.value = amountStr === '' ? '' : String(amountStr);
        tdAmount.appendChild(amountInput);
        tr.appendChild(tdAmount);

        var tdStatus = document.createElement('td');
        var select = document.createElement('select');
        select.name = 'schedule-status';
        select.setAttribute('data-schedule-id', String(s.id));
        var currentStatus = s.status || 'PLANNED';
        for (var k = 0; k < SCHEDULE_STATUS_OPTIONS.length; k++) {
          var opt = SCHEDULE_STATUS_OPTIONS[k];
          var optEl = document.createElement('option');
          optEl.value = opt.value;
          optEl.textContent = opt.label;
          if (opt.value === currentStatus) {
            optEl.selected = true;
          }
          select.appendChild(optEl);
        }
        tdStatus.appendChild(select);
        tr.appendChild(tdStatus);

        tbody.appendChild(tr);
      }
    }

    var actions = document.createElement('div');
    actions.className = 'modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-cancel btn-sm';
    cancelBtn.setAttribute('data-action', 'modal-close');
    cancelBtn.textContent = '닫기';
    actions.appendChild(cancelBtn);

    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary btn-sm';
    submitBtn.textContent = '저장';
    actions.appendChild(submitBtn);

    form.appendChild(actions);

    modalRoot.appendChild(backdrop);

    if (highlightScheduleId) {
      setTimeout(function () {
        var selector = 'tr[data-schedule-id="' + highlightScheduleId + '"]';
        var rowEl = modalRoot.querySelector(selector);
        if (rowEl) {
          rowEl.classList.add('is-highlight');
          rowEl.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      }, 50);
    }
  }

  function closeModal() {
    var modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;
    modalRoot.innerHTML = '';
  }

  Modal.init = ensureModalEvents;
  Modal.openDebtorModal = openDebtorModal;
  Modal.openLoanModal = openLoanModal;
  Modal.openClaimModal = openClaimModal;
  Modal.openLoanScheduleModal = openLoanScheduleModal;
  Modal.openClaimScheduleModal = openClaimScheduleModal;
  Modal.close = closeModal;

})(window, document);
