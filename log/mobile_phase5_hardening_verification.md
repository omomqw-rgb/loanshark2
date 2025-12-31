# Mobile Phase 5 Hardening & Polish Verification

PATCH-ID: LoanShark_v3.1_mobile_mode_phase5_hardening_and_polish

## 1) Mobile UI Polish 적용 체크리스트 (.mobile-shell 하위 스코프)

- [x] 탭 버튼 터치 영역 ≥ 44px  
  - `.mobile-shell .mobile-tab-btn { min-height: 44px; }`
- [x] 카드/요약 박스 padding 확대  
  - `.mobile-shell .mobile-panel-card` / Debtor 카드 Header/Body / Monitoring/Report KPI 패딩 조정
- [x] 숫자(금액/KPI) 가독성 강화  
  - Debtor metric / Monitoring value / Report value font-size 상향
- [x] hover 스타일 제거, 눌림(active) 피드백만 유지  
  - `.mobile-shell` 내부 주요 버튼/카드에 `:hover`는 동일색으로 중화  
  - `:active`에만 pressed feedback 제공
- [x] 가로 스크롤 유발 요소 제거  
  - `.mobile-shell { overflow-x: hidden; }`
  - `.mobile-shell .mobile-content { overflow-x: hidden; }`
- [x] Desktop CSS 영향 차단  
  - 모든 변경은 `.mobile-shell` 하위에만 적용됨 (전역 selector 추가 없음)

## 2) 모드 전환 UX 정책 (안정성 우선) — 확정 적용

### 전환 규칙(Phase 1 고정값)
- Mobile 진입: viewport width ≤ 768px
- Desktop 복귀: viewport width ≥ 1024px
- resize debounce: 250ms
- 전환 cooldown: 800ms
- orientationchange 포함

### 전환 시 동작 정책(Phase 5 고정)
- [x] 열려 있는 모달 무조건 닫기  
  - `closeAllModals()` 호출
- [x] Mobile 탭은 “채무자관리”로 초기화  
  - Mobile Shell은 매 마운트 시 기본 탭을 debtors로 설정
- [x] Mobile 각 탭 스크롤 위치 top으로 리셋  
  - Mobile Shell 마운트 직후 `.mobile-content.scrollTop = 0`
- [x] focusDate는 유지 (단, Mobile 진입 최초엔 오늘)  
  - focusDate는 `App.runtime.mobileUIState.focusDate` 에 저장되는 **Mobile UI State**
  - 최초 Mobile 진입 시만 today로 초기화, 이후 Desktop↔Mobile 전환에도 유지
- [x] 포커스/키보드 잔상 방지  
  - 모드 전환 시 `document.activeElement.blur()` 수행
  - 토스트 잔상 방지를 위해 전환 시 `#toast.show` 제거

## 3) Capability Guard / Command Facade (실행 레벨 봉인) — 적용 내용

### 모바일 모드 판별(단일 함수)
- `App.ui.isMobileMode()`  
  - `App.runtime.mode === 'mobile'` 기반

### 차단 대상 액션(모바일에서 write/mutation 완전 봉인)
- Debtor: 생성/수정/삭제
- Loan: 생성/수정/삭제
- Claim: 생성/수정/삭제
- Schedule: 상태 변경/부분납/완납/미납 처리 포함 저장 전부
- Cloud: Supabase Save / Load 전부

### 차단 방식
- UI 레벨: Schedule Modal 입력/저장 요소 disabled + 숨김(기존 Phase 2~3 유지)
- 실행 레벨: Mobile 진입 시 Guard가 아래 write 경로를 **no-op**으로 치환
  - `App.api.domain.*` (debtor/loan/claim/schedule)
  - `App.features.debtorsHandlers.*` (legacy fallback)
  - `App.schedulesEngine.bulkUpdateFrom*Form` (직접 write 경로 방어)
  - `App.data.saveToSupabase / loadAllFromSupabase`
- 사용자 알림: 차단 발생 시 토스트 1회 표시  
  - 메시지: “모바일 모드에서는 생성/수정/저장 기능이 차단됩니다.”

## 4) Desktop 훼손 0 확인 항목

- [ ] Desktop 모드에서 기존 UI/DOM/레이아웃이 v3.0과 동일 (CSS 전역 영향 없음)
- [ ] Desktop 모드에서 기존 생성/수정/저장/Cloud 기능이 정상 동작 (Guard는 Desktop에서 원복)
- [ ] Desktop 모드에서 기존 탭/패널/모달 동작이 동일 (이벤트/동작 변화 없음)

## 5) Phase 5에서 의도적으로 하지 않은 것 (기능 추가 없음)

- 검색/필터/정렬 기능 추가 ❌
- 스와이프 탭/스와이프 날짜 이동 ❌
- 모바일에서 리스트/드릴다운/그래프/상세 화면 추가 ❌
- Snapshot/Domain/Store 포맷 변경 ❌
- KPI/Monitoring 계산 로직 변경 또는 복제 ❌
