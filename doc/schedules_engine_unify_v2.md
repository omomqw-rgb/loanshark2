# 스케쥴 엔진 단일화 설계안 v2 (v332)

대상: `v331_schedule_create_appdata_sync_fix`  
목표: `App.schedulesEngine` 기반으로 스케쥴의 단일 canonical 엔진을 정의하고,  
CloudState / Report / Monitoring / DebtorDetail 등 전체 영향 범위를 고려한 최종 설계를 정리한다.

---

## 2-1. 최종 canonical 정의

### Canonical Source of Truth

- **최종 canonical:** `App.schedulesEngine.list`
- 이 배열만이 **실제 스케쥴 도메인 데이터**를 보관한다.
- 다른 모든 레이어(state, data, CloudState, 리포트, 모니터링)는 이 엔진을 통해서만 스케쥴에 접근해야 한다.

### App.state.schedules / App.data.schedules 의 역할

- **더 이상 “실데이터 소유자”가 아니다.**
- 역할:
  - 레거시 코드 및 뷰 계층에서 스케쥴을 참조할 수 있도록 하는 **뷰/alias**.
  - schedulesEngine 이 초기화될 때, 다음과 같이 연결된다:

    ```js
    App.schedulesEngine.list = [...];   // canonical

    // Stage 1~2 동안에는 레거시 호환을 위해 alias 제공
    App.state.schedules = App.schedulesEngine.list;
    App.data.schedules  = App.schedulesEngine.list;
    ```

- v333 이후 실제 코드 패치에서는:
  - 가능한 한 많은 모듈이 `App.state.schedules` 대신 `App.schedulesEngine.getAll()` 을 사용하도록 전환.
  - `state.schedules = []` / `data.schedules = []` 식의 재할당 패턴은 제거/래핑.

### CloudState 관점에서의 Truth

- **CloudState.build**
  - 스케쥴 스냅샷은 오직 `App.schedulesEngine.toSnapshot()` 을 통해 생성한다.
  - 더 이상 `pickArray(App.data.schedules, App.state.schedules)` 에 의존하지 않는다.

  ```js
  // js/core/cloudState.js (개념 설계)
  var schedulesSnapshot = App.schedulesEngine.toSnapshot();
  snapshotData.schedules = cloneArray(schedulesSnapshot);
  ```

- **CloudState.apply**
  - 스냅샷에서 복원한 schedule 리스트는 `App.schedulesEngine.fromSnapshot(list)` 로 전달한다.
  - 엔진은 내부 list를 세팅하고, 필요한 경우 App.state.schedules / App.data.schedules 를 alias로만 연결한다.

  ```js
  var schedules = Array.isArray(data.schedules) ? data.schedules : [];
  App.schedulesEngine.fromSnapshot(schedules);
  ```

---

## 2-2. App.schedulesEngine 인터페이스 상세 설계

### 전역 위치

- 정의 파일(제안): `js/core/schedules.engine.js`
- 초기화:
  - `App.schedulesEngine` 객체를 전역에 등록.
  - `App.init` 혹은 `app.js` 초기화 루틴에서 `App.schedulesEngine.initEmpty()` 호출.

### 공통 타입 정의

#### Schedule 기본 타입 (간략)

```ts
type ScheduleKind = 'loan' | 'claim';

type ScheduleStatus = 'PLANNED' | 'PAID' | 'PARTIAL' | 'OVERDUE';

interface Schedule {
  id: string;
  kind: ScheduleKind;

  debtorId: string;   // debtor.id
  loanId?: string;    // kind === 'loan'
  claimId?: string;   // kind === 'claim'

  amount: number;
  paidAmount: number;
  partialPaidAmount: number;

  status: ScheduleStatus;

  dueDate: string;    // ISO yyyy-mm-dd
  paidDate?: string;  // 실제 납입일(있을 경우)

  // 메타데이터
  createdAt?: string;
  updatedAt?: string;
  memo?: string;

  // 향후 확장 필드(rollover, penalty, 이자율 등)
  rolloverGroupId?: string;
  penaltyRate?: number;
  interestRate?: number;
  isAccruedInterest?: boolean;
}
```

### 1) 생성/재생성 API

#### `rebuildForLoan(loan)`

- **책임**
  - 특정 loan 에 대한 모든 스케쥴을 재계산/재생성한다.
  - 기존 list 에서 해당 loanId 의 스케쥴을 제거한 뒤, 새 스케쥴을 생성하여 삽입한다.
  - `buildLoanSchedule(loan)` 로직을 내부적으로 사용하거나 흡수한다.
- **입력**
  - `loan`: `{ id, debtorId, principal, interestRate, cycle, startDate, ... }`
- **출력**
  - `Schedule[]` (해당 loan 에 대해 새로 생성된 스케쥴 리스트)
- **Side-effect**
  - `App.schedulesEngine.list` 업데이트.
  - Stage 1~2: `App.state.schedules` / `App.data.schedules` alias 도 함께 반영.

#### `rebuildForClaim(claim)`

- **책임**
  - 특정 claim 에 대한 스케쥴을 재생성.
  - 내부 로직은 `buildClaimSchedule(claim)` 을 기반으로 한다.
- **입력**
  - `claim`: `{ id, debtorId, principal, interestRate, cycle, startDate, ... }`
- **출력 / Side-effect**
  - `rebuildForLoan` 과 동일 패턴.

### 2) 삭제 API

#### `removeByDebtorId(debtorId)`

- **책임**
  - 해당 debtorId 와 연관된 모든 스케쥴 제거.
- **입력**
  - `debtorId: string`
- **출력**
  - 제거된 스케쥴 개수 (옵션).
- **Side-effect**
  - list 에서 filter.

#### `removeByLoanId(loanId)`

- **책임**
  - 해당 loanId 스케쥴 제거.
- **입력**
  - `loanId: string`
- **Side-effect**
  - list.filter(...).

#### `removeByClaimId(claimId)`

- **책임**
  - 해당 claimId 스케쥴 제거.

### 3) 수정 API

#### `updateSchedule(id, patch)`

- **책임**
  - 특정 schedule.id 에 대해 부분 업데이트를 수행.
  - `patch` 객체에 존재하는 필드만 덮어쓴다.
- **입력**
  - `id: string`
  - `patch: Partial<Schedule>`
    - 예: `{ status: 'PAID', paidAmount: 100000 }`
- **출력**
  - 수정된 Schedule 객체 (또는 `null`/`undefined` if not found).
- **Side-effect**
  - `updatedAt` 자동 갱신 (옵션).

#### `bulkUpdateFromLoanForm(form)`

- **책임**
  - 기존 `handleLoanScheduleSave(form)` 로직을 엔진으로 흡수.
  - 폼 내부의 select/input (`data-schedule-id`, `data-partial-id`) 를 기반으로:
    - status / paidAmount / partialPaidAmount / paidDate 등을 계산 후
    - 각 schedule 에 대해 `updateSchedule(id, patch)` 호출.
- **입력**
  - DOM `form` Element
- **출력**
  - 수정된 schedule id 리스트 (옵션).
- **Side-effect**
  - 내부적으로 normalizeScheduleStatus 와 같은 계산을 수행할 수도 있음.

#### `bulkUpdateFromClaimForm(form)`

- **책임**
  - `handleClaimScheduleSave(form)` 로직을 동일 구조로 엔진 측으로 이동.

### 4) Normalize API

#### `normalizeAll(todayISO)`

- **책임**
  - 모든 schedule 의 status 를 `todayISO` 기준으로 재계산.
  - 기존 `normalizeAllSchedules(todayStr)` / `normalizeScheduleStatus` 의 실제 구현을 여기로 이동.
- **입력**
  - `todayISO: string` (yyyy-mm-dd)
- **출력**
  - 없음 (list in-place 수정).
- **Side-effect**
  - 각 Schedule 의 `status` / `paidAmount` / `partialPaidAmount`/ `dueDate` 기반 상태 변경.

### 5) 조회 API

#### `getAll()`

- **책임**
  - canonical list 를 그대로 반환.
- **출력**
  - `Schedule[]`
- **주의**
  - 복사본이 필요할 경우 consumer 에서 `.slice()` 호출.

#### `getByLoanId(loanId)`

- **책임**
  - 해당 loanId 에 속한 스케쥴 리스트 반환.
- **출력**
  - `Schedule[]`

#### `getByClaimId(claimId)`

- 동일 형태.

#### `getByDebtorId(debtorId)`

- **책임**
  - debtorId 기준으로 loan/claim 에 속한 모든 스케쥴.

#### `(옵션) getRangeByDueDate(fromISO, toISO)`

- **책임**
  - 캘린더/모니터링에서 특정 기간에 해당하는 스케쥴 필터링.
- **출력**
  - `Schedule[]`

### 6) Cloud 연동 API

#### `fromSnapshot(list)`

- **책임**
  - CloudState.apply 에서 전달된 schedule 리스트를 canonical list 로 설정.
- **입력**
  - `list: any[]` (CloudState snapshot의 schedules 영역)
- **하위 작업**
  - ID 정규화 (`normalizeScheduleIdsInPlace` 유사 기능).
  - 타입/필수 필드 보정 (amount/paidAmount 등 숫자 변환, status 상수화).
  - 내부 `this.list` 에 대입.
  - Stage 1~2:
    - `App.state.schedules = this.list;`
    - `App.data.schedules  = this.list;`

#### `toSnapshot()`

- **책임**
  - 현재 canonical list 를 CloudState snapshot 용 배열로 변환.
- **출력**
  - `Schedule[]` (deep clone 혹은 JSON-serializable 복제).
- **하위 작업**
  - ID / 필수 필드 정규화 (CloudState.build 의 `normalizeAppDataIds` 와 역할 조율).

---

## 2-3. Schedule 스키마 정규화 (Entity Specification)

1-1 단계에서의 스키마 스캔(`log/schedules_schema_scan.json`) 결과를 기반으로,  
엔진이 관리해야 할 Schedule 표준 스키마를 다음과 같이 정의한다.

### 필수 필드

- `id: string`
  - 유니크 스케쥴 식별자.
  - CloudState / Supabase / 로컬스토리지 모두에서 공통 사용.
- `kind: 'loan' | 'claim'`
  - 이 스케쥴이 대출 회차인지, 채권 회차인지 구분.
- `debtorId: string`
  - 채무자 id (`debtors.id`).
- `loanId?: string`
  - `kind === 'loan'` 일 때만 필수.
- `claimId?: string`
  - `kind === 'claim'` 일 때만 필수.
- `amount: number`
  - 회차별 예정 상환액.
- `dueDate: string`
  - `yyyy-mm-dd` ISO 형식의 예정 납입일.
- `status: ScheduleStatus`
  - `PLANNED | PAID | PARTIAL | OVERDUE`
  - normalizeAll(todayISO) 에 의해 자동 조정되며,
    모달 편집 결과와 합쳐진 최종 상태.

### 권장 필드

- `paidAmount: number`
  - 실제 상환된 금액 (완납/부분납 모두 포함).
  - `status === 'PAID'` 일 때는 `amount` 와 동일한 값이어야 한다.
- `partialPaidAmount: number`
  - 부분 상환에 사용되는 금액.
  - `status === 'PARTIAL'` 인 경우, `paidAmount` 와 동일하게 맞추거나,
    향후 여유를 위해 별도 관리할 수 있다.
- `paidDate?: string`
  - 실제 납입된 날짜 (optional).
- `createdAt?: string`
  - 스케쥴 생성 시각.
- `updatedAt?: string`
  - 마지막 수정 시각.
- `memo?: string`
  - 회차별 메모/메모태그 등.

### 향후 확장 필드 (예시)

- `rolloverGroupId?: string`
  - 연장대출(rollover) 처리 시, 연장 연쇄를 묶는 그룹 id.
- `penaltyRate?: number`
  - 가산이자/연체이자율.
- `interestRate?: number`
  - 회차별 적용 이자율(변동이자에 대비).
- `isAccruedInterest?: boolean`
  - 월복리/이자자본화 등에서 이자분 스케쥴인지 여부.

---

## 2-4. 모듈별 접근 방식 (최종 매핑표)

### DebtorDetail (`js/modules/debtordetail.js`)

- **현재**
  - `getSchedulesForLoan(loan)`:
    - `(App.data && App.data.schedules) || (App.state && App.state.schedules) || []` 에서 필터링.
  - `getSchedulesForClaim(claim)` 동일 구조.

- **v2 설계**
  - `getSchedulesForLoan(loan)` → `App.schedulesEngine.getByLoanId(loan.id)`
  - `getSchedulesForClaim(claim)` → `App.schedulesEngine.getByClaimId(claim.id)`
  - DebtorDetail 패널에서 사용되는 스케쥴 관련 집계는 모두 이 결과를 기반으로 계산.

### Calendar (`js/features/calendar.js`)

- **현재**
  - `App.state.schedules` 를 직접 순회하여 월/주 단위 셀을 구성.

- **v2 설계**
  - `App.schedulesEngine.getAll()` 또는
  - 기간 필터링이 필요한 경우 `App.schedulesEngine.getRangeByDueDate(from, to)` 사용.
  - 렌더링 로직은 변경 없이 데이터 소스만 교체.

### Monitoring (`js/features/monitoring.js`)

- **현재**
  - 내부 `getSchedules()` 함수가 `App.state.schedules` 를 사용.

- **v2 설계**
  - `getSchedules()` → `App.schedulesEngine.getAll()` 반환.
  - D-1 / D-Day / Overdue 분류 로직은 동일하게 유지.

### Statistics (`js/features/statistics.engine.js`)

- **현재**
  - `App.state.schedules` 를 기준으로 overdue/paid/partial 등 통계 계산.

- **v2 설계**
  - 통계 함수 인자로 `App.schedulesEngine.getAll()` 을 전달.
  - 결과적으로 Overview 상단 요약, 파이차트 등도 항상 canonical schedule 기준.

### CapitalFlow (`js/features/capitalflow.engine.js`, `js/features/report.compute.capitalflow.js`)

- **현재**
  - `state.schedules` 에 의존하여 현금흐름을 계산.

- **v2 설계**
  - 입력 스케쥴 배열 → `App.schedulesEngine.getAll().slice()`.
  - 이후 일자별 cash-in/cash-out 계산 로직은 동일.

### Recovery Summary (`js/features/recovery.summary.engine.js`)

- **현재**
  - 연체/회수율 계산에 `App.state.schedules` 를 사용.

- **v2 설계**
  - 인자: `App.schedulesEngine.getAll()`.
  - 회수율/연체율 계산은 canonical schedule 기준으로 통일.

### Portfolio / DebtorBridge (`js/core/data.js`)

- **현재**
  - `computePortfolioSummary`, `getLoanSummary`, `getClaimSummary` 등에서
    `App.state.schedules.slice()` 에 의존.
  - `buildDebtorsDetailed(debtors, loans, claims, schedules)` 의 `schedules` 인자는
    대개 `App.state.schedules` 혹은 `App.data.schedules`.

- **v2 설계**
  - Summary & Portfolio:
    - `var schedules = App.schedulesEngine.getAll().slice();`
  - DebtorBridge:
    - `buildDebtorsDetailed(debtors, loans, claims, App.schedulesEngine.getAll());`
  - 이렇게 하면 Overview / DebtorDetail / Report 가 모두 동일한 canonical 스케쥴을 기반으로 계산.

### CloudState / Supabase (`js/core/cloudState.js`, `js/core/data.js`)

- **build()**
  - 기존:
    - `schedules: cloneArray(pickArray(App.data.schedules, App.state.schedules))`
  - v2:
    - `schedules: cloneArray(App.schedulesEngine.toSnapshot())`

- **apply() + loadAllFromSupabase()**
  - 기존:
    - `App.data.schedules = data.schedules;`
    - 이후 `App.state.schedules = App.data.schedules;`
  - v2:
    - `App.schedulesEngine.fromSnapshot(data.schedules || []);`
    - 엔진 내부에서 `App.state.schedules` / `App.data.schedules` alias를 설정.

---

## Module → SchedulesEngine API 사용 매트릭스

| 모듈/파일                              | 시나리오                      | 기존 접근                          | v2 엔진 API                          |
|----------------------------------------|-------------------------------|------------------------------------|--------------------------------------|
| `js/core/db.js`                        | Loan 스케쥴 생성              | `rebuildSchedulesForLoan` 내부 `state/data.schedules.push` | `App.schedulesEngine.rebuildForLoan(loan)` |
| `js/core/db.js`                        | Claim 스케쥴 생성             | `rebuildSchedulesForClaim`        | `App.schedulesEngine.rebuildForClaim(claim)` |
| `js/features/debtors.handlers.js`      | Loan 스케쥴 모달 저장         | `handleLoanScheduleSave` 에서 `state.schedules` 직접 수정 | `App.schedulesEngine.bulkUpdateFromLoanForm(form)` |
| `js/features/debtors.handlers.js`      | Claim 스케쥴 모달 저장        | `handleClaimScheduleSave`         | `App.schedulesEngine.bulkUpdateFromClaimForm(form)` |
| `js/core/data.js`                      | 상태 정규화                   | `normalizeAllSchedules(todayStr)` | `App.schedulesEngine.normalizeAll(todayISO)` |
| `js/features/debtors.handlers.js`      | Debtor 삭제 시 스케쥴 제거    | `state.schedules = state.schedules.filter(...)` | `App.schedulesEngine.removeByDebtorId(id)` |
| `js/features/debtors.handlers.js`      | Loan 삭제 시 스케쥴 제거      | state/data 각각 filter             | `App.schedulesEngine.removeByLoanId(loanId)` |
| `js/features/debtors.handlers.js`      | Claim 삭제 시 스케쥴 제거     | state/data 각각 filter             | `App.schedulesEngine.removeByClaimId(claimId)` |
| `js/modules/debtordetail.js`           | Loan별 스케쥴 조회            | data/state.schedules fallback      | `App.schedulesEngine.getByLoanId(loan.id)` |
| `js/modules/debtordetail.js`           | Claim별 스케쥴 조회           | data/state.schedules fallback      | `App.schedulesEngine.getByClaimId(claim.id)` |
| `js/features/calendar.js`              | 캘린더 렌더링                 | `App.state.schedules`             | `App.schedulesEngine.getAll()`       |
| `js/features/monitoring.js`            | D-1/D-Day/Overdue 모니터링    | `App.state.schedules`             | `App.schedulesEngine.getAll()`       |
| `js/features/statistics.engine.js`     | 전체 통계                     | `App.state.schedules`             | `App.schedulesEngine.getAll()`       |
| `js/features/capitalflow.engine.js`    | 현금 흐름 계산                | `App.state.schedules`             | `App.schedulesEngine.getAll().slice()` |
| `js/features/report.compute.capitalflow.js` | 리포트용 현금 흐름        | `state.schedules`                 | `App.schedulesEngine.getAll()`       |
| `js/features/recovery.summary.engine.js`| 회수율/연체율 요약           | `App.state.schedules`             | `App.schedulesEngine.getAll()`       |
| `js/core/data.js`                      | Loan/Claim Summary            | `App.state.schedules.slice()`     | `App.schedulesEngine.getAll().slice()` |
| `js/core/data.js`                      | Portfolio Summary             | `App.state.schedules.slice()`     | `App.schedulesEngine.getAll().slice()` |
| `js/core/cloudState.js`               | CloudState.build              | `pickArray(App.data.schedules, App.state.schedules)` | `App.schedulesEngine.toSnapshot()`   |
| `js/core/cloudState.js` + `js/core/data.js` | CloudState.apply + loadAllFromSupabase | snapshot → App.data.schedules → App.state.schedules | `App.schedulesEngine.fromSnapshot(snapshot.data.schedules)` |

---

이 문서는 v333 이후 실제 코드 리팩토링의 기준이 되는  
**최종 스케쥴 엔진 통합 설계(v2)** 로 사용된다.
