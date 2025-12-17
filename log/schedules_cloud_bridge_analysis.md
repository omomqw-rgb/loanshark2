# Schedules ↔ CloudState ↔ Bridge 분석

본 문서는 `v331_schedule_create_appdata_sync_fix` 기준으로 스케쥴 데이터가
CloudState / Supabase / DebtorBridge 사이에서 어떻게 흐르는지 정리한 아키텍처 분석이다.

---

## 1. CloudState.build()에서 Schedule 처리 방식

**위치:** `js/core/cloudState.js`

```js
App.cloudState.build = function () {
  var state     = App.state || {};
  var uiState   = state.ui || {};
  var calendar  = uiState.calendar || {};
  var debtorPanel = uiState.debtorPanel || {};

  var dataRoot  = App.data || {};
  var stateData = state || {};

  var snapshotData = {
    debtors:  cloneArray(pickArray(dataRoot.debtors,  stateData.debtors)),
    loans:    cloneArray(pickArray(dataRoot.loans,    stateData.loans)),
    claims:   cloneArray(pickArray(dataRoot.claims,   stateData.claims)),
    schedules:cloneArray(pickArray(dataRoot.schedules,stateData.schedules)),
    cashLogs: cloneArray(pickArray(dataRoot.cashLogs, stateData.cashLogs)),
    riskSettings: (typeof dataRoot.riskSettings !== 'undefined')
      ? dataRoot.riskSettings
      : (typeof App.riskSettings !== 'undefined' ? App.riskSettings : null)
  };

  normalizeAppDataIds(snapshotData);
  ...
};
```

핵심 포인트:

- `dataRoot` = `App.data`, `stateData` = `App.state`
- `pickArray(primary, fallback)` 구현:

  ```js
  function pickArray(primary, fallback) {
    if (primary && primary.length) return primary;
    if (fallback && fallback.length) return fallback;
    return [];
  }
  ```

- schedules 에 대해서는:

  - **`App.data.schedules` 가 비어 있지 않으면** → 이를 스냅샷에 사용
  - 비어 있을 때만 `App.state.schedules` 를 fallback 으로 사용

→ **CloudState.build 기준에서의 truth 는 항상 `App.data.schedules`** 이다.

---

## 2. CloudState.apply()에서 Schedule 복원

**위치:** `js/core/cloudState.js`

```js
App.cloudState.apply = function (snapshot) {
  ...
  var data = snapshot.data || {};
  if (!App.data) App.data = {};

  App.data.debtors   = Array.isArray(data.debtors)   ? data.debtors   : [];
  App.data.loans     = Array.isArray(data.loans)     ? data.loans     : [];
  App.data.claims    = Array.isArray(data.claims)    ? data.claims    : [];
  App.data.schedules = Array.isArray(data.schedules) ? data.schedules : [];
  App.data.cashLogs  = Array.isArray(data.cashLogs)  ? data.cashLogs  : [];
  App.data.riskSettings = (typeof data.riskSettings !== 'undefined')
                           ? data.riskSettings : null;

  normalizeAppDataIds(App.data);
  ...
};
```

여기서 schedule 흐름:

1. Supabase 의 JSONB snapshot(`snapshot.data.schedules`) 를 그대로 `App.data.schedules` 에 할당.
2. `normalizeAppDataIds(App.data)` 를 통해
   - `id`, `debtorId`, `loanId`, `claimId` 등 ID 필드들을 string/number 혼용 없이 통일.

**이 시점까지는 `App.state.schedules` 는 전혀 건드리지 않는다.**

---

## 3. loadAllFromSupabase() 후처리에서 state/data 매핑

**위치:** `js/core/data.js`

```js
async function loadAllFromSupabase() {
  ...
  var rawState = rows[0].state || null;
  ...
  if (isV1Snapshot) {
    App.cloudState.apply(rawState);
  } else {
    // legacy...
  }

  if (!App.data)  App.data  = {};
  if (!App.state) App.state = {};

  var debtors   = App.data.debtors   || App.state.debtors   || [];
  var loans     = App.data.loans     || App.state.loans     || [];
  var claims    = App.data.claims    || App.state.claims    || [];
  var schedules = App.data.schedules || App.state.schedules || [];
  var cashLogs  = App.data.cashLogs  || App.state.cashLogs  || [];

  App.state.debtors   = debtors;
  App.state.loans     = loans;
  App.state.claims    = claims;
  App.state.schedules = schedules;
  App.state.cashLogs  = cashLogs;

  var debtorBridge = buildDebtorsDetailed(debtors, loans, claims, schedules);
  App.data.debtors         = debtorBridge.list;
  App.data.debtorsDetailed = debtorBridge.byId;
  ...
}
```

요약:

- CloudState.apply 로 채워진 `App.data.*` 를 기준으로
  - `App.state.*` 에 동일 배열을 주입.
- 특히 `App.state.schedules = App.data.schedules;` 이므로
  - **Cloud Load 직후에는 state.schedules 와 data.schedules 가 동일 배열을 공유**한다.
- 이후 DebtorBridge (`buildDebtorsDetailed`) 도 이 `schedules` 배열을 사용해서 만들어진다.

---

## 4. DebtorBridge (buildDebtorsDetailed) 에서 Schedule 활용

**위치:** `js/core/data.js`

핵심 시그니처:

```js
function buildDebtorsDetailed(debtors, loans, claims, schedules) { ... }
App.data.buildDebtorsDetailed = buildDebtorsDetailed;
```

함수 내부 주요 로직:

1. **대출/채권과 스케쥴 매핑**
   - `schedules` 배열을 순회하면서
     - `loanId`/`claimId` 를 기준으로 각 loan/claim 에 schedule 리스트를 묶음.
   - Debtor 단위 집계 시
     - 해당 채무자에 속한 loan/claim 의 스케쥴들을 통해
       - 총 상환 금액
       - 남은 잔액
       - 다음 납입일
       - 연체 상태 등을 계산.

2. **Debtor 상세 구조**
   - 반환 값: `{ list, byId }`
   - `list`: 요약된 debtor 들의 배열 (Overview/리스트에 사용)
   - `byId`: debtorId → 상세 데이터 (DebtorDetail 패널에 사용)
   - 이 안에는 schedule 에서 파생된 필드들이 포함:
     - `totalPlanned`, `totalPaid`, `totalOverdue` 등 금액 합계
     - `nextSchedule`, `overdueCount`, `lastPaidDate` 등 상태 정보

3. **스케쥴 변경과 DebtorBridge**
   - Cloud Load 이후에는 `buildDebtorsDetailed(debtors, loans, claims, schedules)` 가
     `App.data.debtors` / `App.data.debtorsDetailed` 를 채우는 유일 경로.
   - 세션 중에 스케쥴 편집이 일어나면:
     - 현재 구조에서는 `App.state.schedules` 만 갱신되고
     - DebtorBridge 를 다시 빌드해주지 않는 한
       `App.data.debtorsDetailed` 는 **이전 상태를 유지**함.

---

## 5. 요약: CloudState & 브리지 관점의 스케쥴 Truth

1. **CloudState.build 기준 Truth**
   - `App.data.schedules` 를 우선(primary) 사용.
   - `App.state.schedules` 는 data 가 비어 있을 때만 fallback.
   - 따라서 Cloud Save 는 사실상 **data.schedules 중심**.

2. **CloudState.apply & loadAllFromSupabase**
   - snapshot.data.schedules → `App.data.schedules`
   - 이후 `App.state.schedules = App.data.schedules`
   - DebtorBridge = `buildDebtorsDetailed(debtors, loans, claims, schedules)` 에서
     schedules 인자를 통해 각 debtor 요약/상세를 생성.

3. **현재 구조의 문제 지점**
   - 세션 중 스케쥴 편집은 `App.state.schedules` 에만 반영.
   - Cloud Save 는 `App.data.schedules` 기준으로 snapshot 생성.
   - DebtorBridge 역시 Cloud Load 시점 이후에만 최신화.
   - 이로 인해:
     - Cloud Save / Load 이후 스케쥴 편집 내용이 누락될 수 있고,
     - DebtorDetail / Overview / Monitoring 등이 서로 다른 상태를 볼 위험이 존재.

4. **향후 App.schedulesEngine 도입 시 관점**
   - CloudState.build/apply 는
     - `App.schedulesEngine.toSnapshot()` / `fromSnapshot()` 을 통해
       **엔진 canonical list만을 신뢰**하게 설계하는 것이 자연스럽다.
   - DebtorBridge 또한
     - `schedules` 인자를 단순 배열이 아니라
       `App.schedulesEngine.getAll()` 혹은 필터링된 결과로 받도록 변경하면
       state/data 이원화에 따른 불일치 위험을 제거할 수 있다.
