# Mobile Phase 3 Verification — Debtor Tab (Read Model + Cards)

PATCH-ID: **LoanShark_v2.9_mobile_mode_phase3_debtor_tab_read_model_and_cards**

## 1) Mobile Debtor Read Model (ViewModel / Selector)

### Selector 이름
- `selectMobileDebtorCardsLite()` (js/app.js 내부)

### 출력 필드 (Mobile 카드 렌더 최소 단위)
- `debtorId`
- `debtorName`
- `hasLoan`
- `hasClaim`
- `totalDebtAmount`
- `overdueAmount`
- `todayAmount`
- `aliveStatus`
- `riskFlag`

### 데이터 출처
- Domain: `App.state.debtors`
- Domain: `App.state.loans`, `App.state.claims`
- Domain / Engine: `App.schedulesEngine.getAll()` (우선) → 없으면 `App.state.schedules`
- Snapshot/Domain 포맷 변경 없음 (Read-only 집계만 수행)

### 포함 금지 준수
- ❌ 스케줄 배열/리스트를 ViewModel에 포함하지 않음
- ❌ Desktop 전용 UI state 포함하지 않음
- ❌ 수정/저장용 중간 상태 포함하지 않음

### 정렬 정책 (Phase 3 고정)
1) `overdueAmount > 0` (연체 있음)
2) `todayAmount > 0` (오늘 납부 있음)
3) 나머지  
(동일 그룹 내: overdueAmount desc → todayAmount desc → debtorName asc)

---

## 2) 카드 UI 구조 (DOM)

### 컨테이너
- Debtor 탭 패널: `#m-tab-debtors`
- 카드 리스트: `.mdebtor-list`
- 개별 카드: `.mdebtor-card[data-mdebtor-id="..."]`

### 카드 구성 (의미 기준)
- Header: 상태 아이콘 + 채무자명 + 펼침 표시
- Body:
  - 총 채무금
  - 오늘 납부 (버튼 row) → 스케줄 모달 열기
  - 미납/연체 (버튼 row) → 스케줄 모달 열기
  - [대출 있음] / [채권 있음] 배지

### 인터랙션
- 카드 탭: expand/collapse (`.is-expanded` 토글)
- 오늘/미납 row 탭: 기존 Schedule Modal 오픈(읽기 전용)

---

## 3) 읽기 전용 보장 방식 (UI + 실행 레벨)

### UI 레벨
- Mobile Debtor 탭: 입력 필드/생성/수정 버튼 없음
- Schedule Modal: 
  - status select disabled
  - partial input disabled
  - submit 버튼 숨김/disabled (`applyMobileReadonlyToScheduleModal()`)

### 실행 레벨 (Hard Guard)
- Mobile Mode 진입 시 `enableMobileCapabilityGuard()` 적용 (js/app.js)
  - `App.api.domain.schedule.saveLoanFromForm` / `saveClaimFromForm` → no-op
  - (방어) legacy handler `handleLoanScheduleSave` / `handleClaimScheduleSave` → no-op
  - Cloud Save/Load (`App.data.saveToSupabase`, `App.data.loadAllFromSupabase`) → no-op
- Desktop 복귀 시 `disableMobileCapabilityGuard()`로 원복  
→ Desktop 기능 훼손 방지

---

## 4) Desktop 훼손 0 확인 체크리스트
- Desktop 모드(>=1024px)에서:
  - 기존 채무자관리 패널 UI/동작 동일
  - Schedule Modal 저장/수정 정상 동작(Guard가 해제되어 있음)
  - Desktop DOM/레이아웃/이벤트 변화 없음

---

## 5) Phase 3에서 의도적으로 제외한 기능
- 검색 ❌
- 사용자 커스텀 정렬/필터 ❌
- 대출/채권/스케줄 생성·수정·삭제 ❌
- Bulk Action ❌
- Cloud Save/Load ❌ (Mobile에서 실행 레벨까지 차단)

