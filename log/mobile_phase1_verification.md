# Mobile Mode Phase 1 Verification (v2.7)

PATCH-ID: **LoanShark_v2.7_mobile_mode_phase1_shell_and_tabs_from_v2.6.1_hardgate**

## 1) Mode 전환 규칙 (확정값)

- Mobile 진입: `viewport width ≤ 768px`
- Desktop 복귀: `viewport width ≥ 1024px`
- resize debounce: `250ms`
- 모드 전환 cooldown: `800ms`
- `orientationchange` 이벤트 포함

전환 시 정책:

- 열려있는 모달 전부 닫기
- Mobile 탭은 기본 탭(채무자관리)으로 초기화
- Mobile로 전환되면 Desktop DOM은 언마운트되어야 함 (CSS 숨김 금지)

## 2) DOM 검증 방법

### A. Mobile 모드에서 확인

브라우저 콘솔에서 아래를 확인한다:

- Mobile Shell 존재
  - `document.getElementById('mobile-shell')` 가 존재해야 한다.
  - 또는 `document.querySelector('.mobile-shell')` 가 존재해야 한다.

- Mobile 탭 컨테이너 존재
  - `document.getElementById('mobile-tabs')` 또는 `document.querySelector('.mobile-tabs')`

- 탭 버튼 텍스트 4개 정확히 존재
  - `채무자관리`, `Monitoring`, `캘린더`, `Report`

- 패널 컨테이너 4개 존재 (id 강제)
  - `#m-tab-debtors`
  - `#m-tab-monitoring`
  - `#m-tab-calendar`
  - `#m-tab-report`

### B. Desktop 모드에서 확인

- `#mobile-shell` 은 존재하지 않아야 한다.
- 기존 Desktop DOM 구조 (`.app` 루트) 가 존재해야 한다.

## 3) Desktop 훼손 0 확인 체크리스트

- Desktop 모드에서 기존 탭/패널 전환이 v2.6.1과 동일
- Debtor Sidepanel / Calendar / Monitoring / Report 기존 동작 동일
- 기존 모달(채무자/대출/채권/스케줄 등) 동작 동일
- Cloud Save/Load 버튼 존재 및 기존 동작 동일 (Mobile 모드에서는 Desktop이 언마운트되므로 접근 불가)

## 4) Phase 1에서 의도적으로 구현하지 않은 것

- 탭 스와이프 전환
- 캘린더 날짜 이동 버튼(◀/▶/오늘) 및 focusDate UI state 연동
- Monitoring Lite 수치 연결 (D-Day / 미납자·미납금)
- Report KPI 연결 (Overview KPI 카드 값 연동)
- Mobile에서 모달을 여는 UX 연결
