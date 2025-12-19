# Global CSS Rules Inventory

대상: `color`, `background`, `border-color`, `opacity`에 영향을 주면서, **전역(화면 root 미부여/혼재) 상태에서 UI 표현을 무력화할 수 있는 규칙**을 우선 추출했습니다.

| 번호 | 파일 | 원본 selector | 영향 속성 | !important | 실제 영향 화면 | 위험도 |
|---|---|---|---|---|---|---|
| 1 | base.css | `body` | color | N | global | 🟡 |
| 2 | base.css | `html, body` | background, color | N | global | 🟡 |
| 3 | base.css | `html, body` | background | N | global | 🟡 |
| 4 | calendar.css | `.calendar-day.is-saturday .calendar-day-number` | color | Y | calendar | 🟠 |
| 5 | calendar.css | `.calendar-day.is-sunday .calendar-day-number` | color | Y | calendar | 🟠 |
| 6 | calendar.css | `.calendar-weekday.dow-0` | color | Y | calendar | 🟠 |
| 7 | calendar.css | `.calendar-weekday.dow-6` | color | Y | calendar | 🟠 |
| 8 | card.css | `.card-actions-inline .btn-plain` | color | Y | global | 🟠 |
| 9 | components.css | `.btn:hover` | background | N | global | 🟡 |
| 10 | components.css | `.day-type-text-badge.badge-loan, .day-type-text-badge.badge-claim` | color | Y | global | 🔴 |
| 11 | components.css | `input::placeholder, textarea::placeholder` | color | N | global | 🟡 |
| 12 | components.css | `input:focus, textarea:focus, select:focus` | border-color | N | global | 🟡 |
| 13 | components.css | `input[type="text"], input[type="number"], input[type="email"], input[type="search"], textarea, select` | background, color | N | global | 🟡 |
| 14 | debtorDetail.css | `.ddh-header .ddh-btn` | background | Y | debtors | 🟠 |
| 15 | debtorDetail.css | `.ddh-header .ddh-btn` | background | Y | debtors | 🟠 |
| 16 | debtors.css | `.debtor-header-edit, .debtor-header-delete` | color | Y | debtors | 🟠 |
| 17 | debtors.css | `.debtor-topbar-msg, .debtor-phone, .debtor-detail-phone, .loan-amounts, .badge-status, .debtor-panel .btn-text, .debtor-panel .field-text select, #debtors-root .debtor-panel .table td select` | color | N | debtors | 🟡 |
| 18 | debtors.css | `.dlist-search-input` | background, color | N | debtors | 🟠 |
| 19 | debtors.css | `.form-section-actions .btn-inline` | background, color | Y | debtors | 🟠 |
| 20 | debtors.css | `.form-section-actions .btn-inline` | background | Y | debtors | 🟠 |
| 21 | debtors.css | `.week-detail-item .week-item-amount, #debtors-root .day-detail-item .day-item-amount` | color | Y | calendar / debtors | 🟠 |
| 22 | debtors.css | `.week-detail-item .week-item-debtor, .day-detail-item .day-item-name, .week-detail-item .week-item-amount, .day-detail-item .day-item-amount, .week-detail-item.is-paid .week-item-debtor, .week-detail-item.is-paid .week-item-amount, .day-detail-item.is-paid .day-item-name, .day-detail-item.is-paid .day-item-amount, .week-detail-item.is-overdue .week-item-debtor, .week-detail-item.is-overdue .week-item-amount, .day-detail-item.is-overdue .day-item-name, .day-detail-item.is-overdue .day-item-amount, .week-detail-item.is-partial .week-item-debtor, .week-detail-item.is-partial .week-item-amount, .day-detail-item.is-partial .day-item-name, #debtors-root .day-detail-item.is-partial .day-item-amount` | color | Y | calendar / debtors | 🔴 |
| 23 | debtors.css | `.week-detail-item.is-overdue .week-item-amount, #debtors-root .day-detail-item.is-overdue .day-item-amount` | color | Y | calendar / debtors | 🟠 |
| 24 | debtors.css | `.week-detail-item.is-paid .week-item-amount, #debtors-root .day-detail-item.is-paid .day-item-amount` | color | Y | calendar / debtors | 🟠 |
| 25 | debtors.css | `.week-detail-item.is-partial .week-item-amount, #debtors-root .day-detail-item.is-partial .day-item-amount` | color | Y | calendar / debtors | 🟠 |
| 26 | layout.css | `.portfolio-type-chip` | background-color, color, opacity | N | global | 🟠 |
| 27 | modal.css | `.card, .panel, .section-card, .table-card, .debtor-panel, .sidepanel, .sidepanel-section, .modal, .modal-body, #modal-root .modal-surface` | background | N | debtors / modal | 🟡 |
| 28 | modal.css | `.modal` | background | N | modal | 🟡 |
