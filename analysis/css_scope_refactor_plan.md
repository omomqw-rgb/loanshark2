# CSS Scope Refactor Plan

원칙: **색상 값/토큰은 변경하지 않고**, 전역 누수 규칙을 제거하거나 화면 root로 제한합니다.

| 규칙 ID | 조치 | scope 제한 버전 | 적용 root | 영향 차단 대상 화면 | 구현 파일 |
|---|---|---|---|---|---|
| 1 | 유지(전역) | - | global | - | base.css |
| 2 | 유지(전역) | - | global | - | base.css |
| 3 | 유지(전역) | - | global | - | base.css |
| 4 | Scope 제한 | 예) `#calendar-root .calendar-weekday.dow-0 { ... }` | #calendar-root | report/monitoring/modal/debtors | calendar.css |
| 5 | Scope 제한 | 예) `#calendar-root .calendar-weekday.dow-0 { ... }` | #calendar-root | report/monitoring/modal/debtors | calendar.css |
| 6 | Scope 제한 | 예) `#calendar-root .calendar-weekday.dow-0 { ... }` | #calendar-root | report/monitoring/modal/debtors | calendar.css |
| 7 | Scope 제한 | 예) `#calendar-root .calendar-weekday.dow-0 { ... }` | #calendar-root | report/monitoring/modal/debtors | calendar.css |
| 8 | 유지(컴포넌트) | - | global(component) | - | card.css |
| 9 | 유지(컴포넌트) | - | global(component) | - | components.css |
| 10 | 제거 | (삭제) | - | calendar(타입 배지 색 무력화 해제) | components.css |
| 11 | 유지(컴포넌트) | - | global(component) | - | components.css |
| 12 | 유지(컴포넌트) | - | global(component) | - | components.css |
| 13 | 유지(컴포넌트) | - | global(component) | - | components.css |
| 14 | Scope 제한 | 예) `#debtor-detail-root .ddh-header .ddh-btn { ... }` | #debtor-detail-root | calendar/report/monitoring/modal | debtorDetail.css |
| 15 | Scope 제한 | 예) `#debtor-detail-root .ddh-header .ddh-btn { ... }` | #debtor-detail-root | calendar/report/monitoring/modal | debtorDetail.css |
| 16 | Scope 제한 | 예) `#debtor-sidepanel .debtor-header-edit { ... }` | #debtor-sidepanel | calendar/report/monitoring/modal | debtors.css |
| 17 | Scope 제한 | 예) `#debtor-sidepanel .debtor-topbar-msg { ... }` | #debtor-sidepanel | calendar/report/monitoring/modal | debtors.css |
| 18 | Scope 제한 | 예) `#debtor-sidepanel .dlist-search-input { ... }` | #debtor-sidepanel | calendar/report/monitoring/modal | debtors.css |
| 19 | Scope 제한 | 예) `#debtor-sidepanel .form-section-actions .btn-inline { ... }` | #debtor-sidepanel | calendar/report/monitoring/modal | debtors.css |
| 20 | Scope 제한 | 예) `#debtor-sidepanel .form-section-actions .btn-inline { ... }` | #debtor-sidepanel | calendar/report/monitoring/modal | debtors.css |
| 21 | 이동 + Scope 제한 | 예) `#calendar-root .week-detail-item .week-item-amount { ... }` | #calendar-root | debtors/report/monitoring/modal | calendar.scope.css |
| 22 | 제거 | (삭제) | - | calendar(상태 색 무력화 해제) | debtors.css |
| 23 | 이동 + Scope 제한 | 예) `#calendar-root .week-detail-item.is-overdue .week-item-amount { ... }` | #calendar-root | debtors/report/monitoring/modal | calendar.scope.css |
| 24 | 이동 + Scope 제한 | 예) `#calendar-root .week-detail-item.is-paid .week-item-amount { ... }` | #calendar-root | debtors/report/monitoring/modal | calendar.scope.css |
| 25 | 이동 + Scope 제한 | 예) `#calendar-root .week-detail-item.is-partial .week-item-amount { ... }` | #calendar-root | debtors/report/monitoring/modal | calendar.scope.css |
| 26 | 유지(컴포넌트) | - | global(component) | - | layout.css |
| 27 | 이동(컴포넌트 전역화) | `.card, .panel, ... { background: var(--charcoal-bg-surface); ... }` | global(component) | screen css 파일 의존 제거 | components.css (moved from modal.css) |
| 28 | Scope 제한 | 예) `#modal-root .modal { ... }` | #modal-root | calendar/report/monitoring/debtors | modal.css |

## 추가로 수행한 파일 단위 Scope 정리

- `css/calendar.css` → 모든 selector를 `#calendar-root` 하위로 스코프 제한
- `css/monitoring.css` → 모든 selector를 `#monitoring-root` 하위로 스코프 제한(`#tab-monitoring`은 ID 고유성으로 유지)
- `css/report.css` → 모든 selector를 `#report-root` 하위로 스코프 제한(`#tab-report`은 ID 고유성으로 유지)
- `css/modal.css` → 모든 selector를 `#modal-root` 하위로 스코프 제한
- `css/debtors.css` → 모든 selector를 `#debtor-sidepanel` 하위로 스코프 제한(기존 `#debtors-root`는 `#debtor-sidepanel`로 매핑)
- `css/debtorDetail.css` → 모든 selector를 `#debtor-detail-root` 하위로 스코프 제한
- `css/calendar.scope.css` 신설 → debtors.css에서 캘린더 UI에 붙어있던 색 규칙을 **캘린더 스코프**로 이동

## 회귀 테스트 체크리스트

- 콘솔: `Unexpected token 'export'` / `Cannot use import statement` / `ReferenceError` 없음
- 캘린더: 주/일 상세 리스트의 상태 색(연체/부분/완납) 표시 정상
- 모달: 상태 색 정상 표시(모달 외부 UI 오염 없음)
- 채무자(사이드패널/상세): 기존과 동일한 색/레이아웃 유지
- Report/Monitoring: 색상 변화 없음(특히 표/칩/버튼 hover)
