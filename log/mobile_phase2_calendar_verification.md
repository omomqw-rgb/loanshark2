# Mobile Mode Phase 2 Verification (v2.8)

PATCH-ID: **LoanShark_v2.8_mobile_mode_phase2_calendar_right_panel_and_focusDate**

## 1) focusDate 상태 위치 (UI State)

- **focusDate는 Domain/Store/Snapshot(App.state 포함)에 저장하지 않는다.**
- focusDate는 **Mobile Shell 내부(UI State)** 로만 존재한다.
  - 위치: `js/app.js` → `buildMobileShell()` 내부의 `var focusDate = todayISO();`
  - Desktop 캘린더(`App.state.ui.calendar.currentDate`)와 **완전히 분리**된다.

초기값 정책:
- Mobile Mode 진입 시: `focusDate = todayISO()` (오늘)
- Mobile Mode 내에서 Calendar 탭을 떠났다가 재진입 시: 마지막 `focusDate` 유지

## 2) 날짜 이동 3버튼 동작

Mobile 캘린더 탭 헤더 UI:
- `◀` 버튼: `focusDate = focusDate - 1 day`
- `▶` 버튼: `focusDate = focusDate + 1 day`
- `오늘` 버튼: `focusDate = today`

동작 확인:
- Mobile 모드에서 캘린더 탭 진입
- 상단 날짜 라벨(`YYYY-MM-DD (요일)`)이 버튼 클릭에 따라 변경되는지 확인
- 날짜 변경 시 **Month Grid 없이** 스케줄 리스트만 갱신되는지 확인

## 3) Month Grid가 Mobile에서 마운트되지 않음을 확인하는 방법

Mobile 모드(≤ 768px)에서 브라우저 콘솔:
- Desktop DOM이 언마운트되어 있어야 한다.
  - `document.querySelector('.app')` → `null`
  - `document.getElementById('calendar-root')` → `null`
- Month Grid 관련 DOM이 없어야 한다.
  - `document.querySelector('.calendar-month-view')` → `null`

대신 Mobile Calendar DOM이 존재해야 한다.
- `document.getElementById('m-tab-calendar')` 존재
- `#m-tab-calendar` 내부에 `.mcal-header`, `.mcal-right-panel`, `.mcal-list` 존재

## 4) 스케줄 데이터(읽기 전용) 연결 확인

- `focusDate`에 해당하는 날짜의 스케줄 목록이 `.mcal-list`에 표시되어야 한다.
- 최소 표시 항목:
  - 채무자 이름
  - 유형(대출/채권)
  - 금액
  - 상태(예정/연체/완료) *(부분납은 "부분"으로 표시될 수 있음)*

## 5) Schedule Modal 재사용 + 모드 전환 정책

- Mobile 캘린더 스케줄 항목 클릭 시 기존 Schedule Modal을 열 수 있다.
- Modal 호출 시 **focusDate를 추가 인자로 전달**한다.
- Mobile Phase 2에서는 스케줄 수정이 금지이므로, 열리는 Schedule Modal은 **입력/저장 UI가 비활성화(읽기 전용)** 되어야 한다.
- Mobile ↔ Desktop 모드 전환 시: **열려 있는 모달은 항상 닫힘** (Phase 1 정책 유지)

## 6) Desktop Calendar 훼손 0 확인 항목

Desktop 모드(≥ 1024px)에서:
- 기존 `#calendar-root` 캘린더 Month/Week 전환, Day Detail, 스케줄 클릭 모달 동작이 v2.7과 동일해야 한다.
- `js/features/calendar.js` 및 Desktop 캘린더 DOM 구조 변경 없음

## 7) Phase 2에서 의도적으로 제외한 기능

- Mobile Month Grid (절대 마운트 금지)
- 스와이프 날짜 이동 (버튼만)
- 스케줄 수정/생성/삭제 (Mobile 금지)
- Monitoring Lite 수치 연결
- Report KPI 연결
- Mobile에서 Cloud Save/Load
