# Schedules Engine Migration Plan v2 (v332)

대상: `v331_schedule_create_appdata_sync_fix`  
목표: `App.schedulesEngine` 도입을 3단계(Stage 1~3)로 나누어  
실제 구현 시 바로 활용 가능한 수준으로 세부 작업 리스트를 정의한다.

---

## 3-1. Stage 1 — 엔진 도입 + 쓰기 경로 통합

### Stage 1 목표

- **기존 동작(behavior)을 최대한 유지**하면서,
- 스케쥴의 생성/삭제/수정/normalize 경로를 모두 `App.schedulesEngine` 을 통해 수행하게 만든다.
- 이 시점에서는 **읽기(Report/Monitoring 등) 경로는 그대로** 두고,
  - engine 이 내부에서 `App.state.schedules` / `App.data.schedules` 에 alias 를 제공한다.

---

### 3-1-1. 엔진 스켈레톤 도입

- **파일 추가**
  - `js/core/schedules.engine.js` (새 파일)
- **초기 스켈레톤 구조**
  - 필드:
    - `list: []`
  - 메소드:
    - `initEmpty()`
    - `getAll()`
    - `rebuildForLoan(loan)`
    - `rebuildForClaim(claim)`
    - `removeByDebtorId(debtorId)`
    - `removeByLoanId(loanId)`
    - `removeByClaimId(claimId)`
    - `bulkUpdateFromLoanForm(form)`
    - `bulkUpdateFromClaimForm(form)`
    - `normalizeAll(todayISO)`
    - `fromSnapshot(list)`
    - `toSnapshot()`
  - Stage 1 에서는 메소드 내부 로직을 **기존 함수 구현을 그대로 옮기거나 delegate** 하는 형태로 구현.

- **초기화 연결**
  - 위치: `js/app.js` 또는 App 초기화 루틴
  - 작업:
    - `if (!App.schedulesEngine) App.schedulesEngine = SchedulesEngineFactory();`
    - `App.schedulesEngine.initEmpty();`

---

### 3-1-2. 생성 경로 통합 (rebuildForLoan / rebuildForClaim)

#### 대상 1: `js/core/db.js` – `rebuildSchedulesForLoan`

- **현재 역할**
  - loanId 기준으로:
    - `state.schedules` / `data.schedules` 에서 기존 스케쥴 제거
    - `buildLoanSchedule(loan)` 호출로 새 스케쥴 배열 생성
    - `state.schedules.push(s);` / `data.schedules.push(cloneSchedule(s));`

- **변경 방향(한 줄 요약)**
  - "내부 배열 조작 대신 `App.schedulesEngine.rebuildForLoan(loan)` 호출로 교체"

- **세부 작업**
  1. `rebuildSchedulesForLoan(loanId)` 내부에서 loan 객체를 찾은 뒤,
     - `App.schedulesEngine.rebuildForLoan(loan)` 호출.
  2. `buildLoanSchedule` / `cloneSchedule` 로직은
     - Stage 1 에서는 그대로 사용하되,
     - 엔진 내부에서 import 하거나 동일 파일 내에서 호출.
  3. `state.schedules` / `data.schedules` 에 대한 직접 push/filter 는 제거하고,
     - 엔진이 `this.list` 를 갱신한 뒤,
     - `App.state.schedules = this.list;`
     - `App.data.schedules  = this.list;` 를 수행.

- **주의 사항**
  - `id`, `debtorId`, `loanId`, `kind` 필드가 제대로 세팅되었는지 유지.
  - CloudState.build 에서 `normalizeAppDataIds` 를 수행하고 있으므로,
    - Stage 1 에서는 엔진에서 ID 정규화를 강하게 하지 않아도 됨.

#### 대상 2: `js/core/db.js` – `rebuildSchedulesForClaim`

- **변경 방향**
  - `rebuildSchedulesForClaim(claimId)` → `App.schedulesEngine.rebuildForClaim(claim)` 호출.
- **주의 사항**
  - `kind: 'claim'`, `claimId` 필드 정확히 세팅.

#### 대상 3: Seed 데이터 – `seedDummyData`

- **현재**
  - `state.schedules = [];`
  - 이후 모든 loans/claims 에 대해 `rebuildSchedulesForLoan/Claim` 호출.

- **변경 방향**
  - `App.schedulesEngine.initEmpty();`
  - 이후 `rebuildSchedulesForLoan/Claim` 호출은 엔진 기반으로 작동.

---

### 3-1-3. 수정 경로 통합 (handleLoanScheduleSave / handleClaimScheduleSave)

#### 대상 1: `js/features/debtors.handlers.js` – `handleLoanScheduleSave(form)`

- **현재 역할**
  - `var schedules = state.schedules || [];` 에서 스케쥴 객체 배열을 얻음.
  - select (`data-schedule-id`) / input (`data-partial-id`) 값을 읽어
    - schedule.status / paidAmount / partialPaidAmount 등을 직접 수정.

- **변경 방향(한 줄 요약)**
  - "배열 직접 수정 대신 `App.schedulesEngine.bulkUpdateFromLoanForm(form)` 호출"

- **세부 작업**
  1. 함수 내부에서 schedules 배열을 직접 잡는 구간을 제거.
  2. `App.schedulesEngine.bulkUpdateFromLoanForm(form)` 호출만 남긴 뒤,
     - 나머지 후처리(모달 닫기, UI 리프레시 등)는 변경하지 않는다.
  3. `bulkUpdateFromLoanForm(form)` 구현:
     - 현재 `handleLoanScheduleSave` 의 구현을 그대로 옮기되,
       - 대상 배열을 `App.schedulesEngine.list` 로 바꾸고,
       - 필요한 경우 `updateSchedule(id, patch)` 를 내부에서 호출.

- **주의 사항**
  - `loanId` / `debtorId` 필드는 수정하지 않아야 한다.
  - partial 입력 값이 비어 있을 때 0 처리 로직 유지.
  - status 를 select 로 바꿀 때, 기존 normalize 규칙(`PAID` → paidAmount=amount 등)을 그대로 사용.

#### 대상 2: `js/features/debtors.handlers.js` – `handleClaimScheduleSave(form)`

- **변경 방향**
  - `App.schedulesEngine.bulkUpdateFromClaimForm(form)` 호출로 통합.
- **주의 사항**
  - claim 스케쥴에서 사용하는 필드(`claimId`, `kind: 'claim'`) 유지.

---

### 3-1-4. Normalize 경로 통합

#### 대상: `js/core/data.js` – `normalizeAllSchedules(todayStr)`

- **현재 역할**
  - `App.state.schedules` 를 순회하며 `normalizeScheduleStatus` 적용.

- **변경 방향(한 줄 요약)**
  - "엔진 래퍼로 유지하면서 내부 구현을 `App.schedulesEngine.normalizeAll(todayISO)` 로 위임"

- **세부 작업**
  1. `normalizeAllSchedules(todayStr)` 함수는 signature 를 유지하되:
     - 내부에서 `App.schedulesEngine.normalizeAll(todayStr);` 만 호출.
  2. `normalizeScheduleStatus` 구현은 Stage 1 에서는 그대로 사용하거나,
     - engines 내부 유틸로 이동.

- **주의 사항**
  - normalizeAll 이 호출되는 모든 경로(리포트 계산, 모니터링 등)를 Stage 2에서 재검토.

---

### 3-1-5. 삭제 경로 통합

#### 대상 1: `js/features/debtors.handlers.js` – `handleDebtorDelete`

- **현재 역할**
  - `state.schedules = state.schedules.filter(s => s.debtorId !== id);`
  - data.schedules 는 건드리지 않음.

- **변경 방향**
  - `App.schedulesEngine.removeByDebtorId(id);`

- **주의 사항**
  - debtor 삭제 시 loan/claim 삭제 순서와의 관계 점검.
  - removeByDebtorId 내부에서 loanId/claimId 무관하게 debtorId 로 필터링.

#### 대상 2: `handleLoanDelete(loanId)` / `handleClaimDelete(claimId)`

- **현재 역할**
  - state/data.schedules 각각 filter.

- **변경 방향**
  - `App.schedulesEngine.removeByLoanId(loanId);`
  - `App.schedulesEngine.removeByClaimId(claimId);`

- **주의 사항**
  - loan/claim 삭제 이후 DebtorBridge/PortfolioSummary 갱신 여부는 Stage 2에서 통합.

---

## 3-2. Stage 2 — 읽기 경로 통합 + CloudState 연동

### Stage 2 목표

- 모든 consumer(리포트/모니터링/캘린더 등)가 `App.schedulesEngine` 을 통해 스케쥴을 읽도록 전환.
- CloudState.build/apply 가 엔진 기반으로 통일되도록 수정.
- 이 단계까지 완료하면 **state/data 이원화에 따른 불일치 문제는 대부분 해소**된다.

---

### 3-2-1. 읽기 경로 전수 교체

#### A. Statistics

- **파일**: `js/features/statistics.engine.js`
- **변경 대상**
  - `var state = App.state || {};`
  - `var schedules = state.schedules || [];`
- **변경 방향**
  - `var schedules = App.schedulesEngine.getAll();`
- **주의 사항**
  - 통계 계산 함수 내에서 schedules 를 변경하지 않도록 확인.
  - 필요시 `.slice()` 로 복사 사용.

#### B. Monitoring

- **파일**: `js/features/monitoring.js`
- **변경 대상**
  - 내부 `getSchedules()` 함수:
    - 현재 `App.state.schedules` 참조.
- **변경 방향**
  - `return App.schedulesEngine.getAll();`

#### C. Calendar

- **파일**: `js/features/calendar.js`
- **변경 대상**
  - 월/주 캘린더 데이터를 만들 때 사용하는 `App.state.schedules`.
- **변경 방향**
  - `var schedules = App.schedulesEngine.getAll();`
  - 날짜 필터링 로직은 그대로 유지.

#### D. CapitalFlow & Report.compute

- **파일**
  - `js/features/capitalflow.engine.js`
  - `js/features/report.compute.capitalflow.js`
- **변경 대상**
  - `state.schedules` 사용 부분.
- **변경 방향**
  - `var schedules = App.schedulesEngine.getAll().slice();`

#### E. Recovery Summary

- **파일**: `js/features/recovery.summary.engine.js`
- **변경 방향**
  - 스케쥴 입력 인자를 `App.schedulesEngine.getAll()` 로 통일.

#### F. Portfolio Summary / LoanSummary / ClaimSummary

- **파일**: `js/core/data.js`
- **변경 대상**
  - `computePortfolioSummary`, `getLoanSummary`, `getClaimSummary` 등에서
    `App.state.schedules.slice()` 사용.
- **변경 방향**
  - `var schedules = App.schedulesEngine.getAll().slice();`

#### G. DebtorDetail

- **파일**: `js/modules/debtordetail.js`
- **변경 대상**
  - `getSchedulesForLoan`, `getSchedulesForClaim` 에서
    `(App.data && App.data.schedules) || (App.state && App.state.schedules)` 사용.
- **변경 방향**
  - `getSchedulesForLoan(loan)` → `App.schedulesEngine.getByLoanId(loan.id)`
  - `getSchedulesForClaim(claim)` → `App.schedulesEngine.getByClaimId(claim.id)`

---

### 3-2-2. CloudState.build/apply 통합

#### A. CloudState.build

- **파일**: `js/core/cloudState.js`
- **현재 코드**
  - `schedules: cloneArray(pickArray(dataRoot.schedules, stateData.schedules))`
- **변경 방향(한 줄 요약)**
  - "schedulesEngine.toSnapshot() 결과를 그대로 사용"

- **세부 작업**
  1. build 함수 상단에서 schedulesEngine 사용 가능 여부 확인:
     - `if (App.schedulesEngine && typeof App.schedulesEngine.toSnapshot === 'function')`
  2. 해당 경우:
     - `snapshotData.schedules = cloneArray(App.schedulesEngine.toSnapshot());`
  3. fallback (하위호환):
     - schedulesEngine 이 없는 경우에만 기존 pickArray 로직 사용.

#### B. CloudState.apply

- **파일**: `js/core/cloudState.js`
- **현재 코드**
  - `App.data.schedules = Array.isArray(data.schedules) ? data.schedules : [];`
- **변경 방향**
  - `App.schedulesEngine.fromSnapshot(data.schedules || []);`
- **주의 사항**
  - fromSnapshot 내부에서:
    - `this.list` 설정
    - `App.state.schedules` / `App.data.schedules` alias 설정

#### C. loadAllFromSupabase 후처리

- **파일**: `js/core/data.js`
- **현재**
  - `var schedules = App.data.schedules || App.state.schedules || [];`
  - `App.state.schedules = schedules;`
- **변경 방향**
  - schedulesEngine.fromSnapshot 이 이미 state/data를 세팅한다고 가정하고,
  - 해당 부분은 **최소한으로 유지 or 정리**:
    - 단, Stage 2에서는 기존 코드와 충돌이 없도록,
      - `if (!App.schedulesEngine) { ... 기존 로직 ... }` 형태로 래핑 고려.

---

## 3-3. Stage 3 — 레거시 제거 + 고급 기능 준비

### Stage 3 목표

- `App.state.schedules` / `App.data.schedules` 를 "실데이터"로 사용하는 패턴을 제거한다.
- 스케쥴 고급 도메인 기능(연장/가산이자/월복리)을 schedulesEngine API 중심으로 설계할 준비를 완료한다.

---

### 3-3-1. state/data direct 재할당 제거

#### A. 전수 리스트 (예시, hotspots 기준)

- `log/schedules_legacy_hotspots.json` 참고.
- 대표적인 패턴:
  - `App.state.schedules = [];` (`js/core/auth.js:clearAppDataState`)
  - `state.schedules = state.schedules.filter(...)` (`js/features/debtors.handlers.js`)
  - `data.schedules = (data.schedules || []).filter(...)` (`js/core/db.js:rebuildSchedulesForLoan/Claim`)
  - `state.schedules.push(...)` / `data.schedules.push(...)` (`js/core/db.js`)

#### B. 변경 방향

- 모든 direct 재할당은 다음 중 하나로 대체:
  - 전체 초기화:
    - `App.schedulesEngine.initEmpty();`
  - filter/remove:
    - `App.schedulesEngine.removeByDebtorId/LoanId/ClaimId(...)`
  - push/add:
    - `App.schedulesEngine.rebuildForLoan/Claim(...)` 혹은
    - 향후 추가될 `addSchedule(schedule)` API.

---

### 3-3-2. schedulesEngine 고급 도메인 기능 Hook 설계

#### A. 연장대출(rollover)

- **예상 API**
  - `applyRollover(loanId, options)`
- **내부**
  - 기존 스케쥴 일부를 새로운 스케쥴로 치환.
  - `rolloverGroupId` 필드로 연장 히스토리 추적.

#### B. 가산이자(연체이자)

- **예상 API**
  - `applyPenalty(scheduleId, config)`
- **내부**
  - 특정 스케쥴이 연체된 경우,
    - penalty 스케쥴을 별도 생성하거나,
    - 기존 스케쥴 amount/interest 를 조정.

#### C. 월복리/이자자본화

- **예상 API**
  - `generateCompoundSchedules(loanId, scheme)`
- **내부**
  - 회차별 이자 계산 로직을 기존 단리/표준 방식에서 분리.
  - 스케쥴 엔진이 amortization / compound 계산 모두 담당.

#### D. Report/Monitoring 연계

- 고급 기능이 추가되더라도,
  - Report/Monitoring/Statistics/Calendar 는 여전히
    - `App.schedulesEngine.getAll()` 만 바라보면 되므로,
  - 도메인 복잡성 증가가 UI/리포트 계층에 전파되지 않도록 격리.

---

## 3-4. 단계별 위험 요소 및 주의사항 요약

### Stage 1

- **위험**
  - schedulesEngine 도입 과정에서 `state.schedules` / `data.schedules` alias 설정이 누락되면,
    - 기존 읽기 경로가 빈 배열을 보게 될 수 있음.
- **주의사항**
  - Stage 1 완료 전까지:
    - 언제나 `App.state.schedules = App.schedulesEngine.list;`
    - `App.data.schedules  = App.schedulesEngine.list;` 유지.

### Stage 2

- **위험**
  - 일부 모듈이 여전히 `App.state.schedules` 를 직접 읽을 경우,
    - 엔진과 이중 참조로 인한 혼선 발생 가능.
- **주의사항**
  - `log/schedules_callgraph.json` / `log/schedules_schema_scan.json` 를 참고해
    - schedule 관련 모든 호출 지점을 체크리스트 기반으로 검토.

### Stage 3

- **위험**
  - direct 재할당 제거 과정에서 초기화/삭제 타이밍 변경으로 인한 버그.
- **주의사항**
  - 각 삭제/초기화 시나리오에 대해,
    - "Debtor 삭제 → Loan/Claim 삭제 → Schedule 제거 → Report/Monitoring/Calendar 반영"
    - end-to-end 테스트 케이스를 명시적으로 준비.

---

이 Migration Plan v2 는  
`v333_schedules_engine_unify_impl` 이후 실제 리팩토링 작업 시  
직접적인 TODO/체크리스트로 사용할 수 있는 수준으로 작성되었다.
