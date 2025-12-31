# Mobile Mode Phase 4 Verification (Monitoring Lite + Report KPI)

## Patch
- PATCH-ID: LoanShark_v3.0_mobile_mode_phase4_monitoring_lite_and_report_kpi
- Base ZIP: LoanShark_v2.9_mobile_mode_phase3_debtor_tab_read_model_and_cards.zip

---

## 1) Monitoring Lite (Mobile → Monitoring 탭)

### 표시 항목 (확정)
- 카드 1: D-Day (오늘)
  - 오늘 납부 예정 금액 합계
  - 오늘 납부 대상 채무자 수
- 카드 2: 미납
  - 미납 채무자 수
  - 미납 금액 합계

### 데이터 출처 / 계산 출처
- 스케줄 원본: `App.schedulesEngine.getAll()` (읽기)
- 기존 Monitoring 계산 로직 재사용:
  - `App.features.monitoring._internal.recomputeDateAnchors()`
  - `App.features.monitoring._internal.filterDDay(sc)`
  - `App.features.monitoring._internal.filterOverdue(sc)`
  - `App.features.monitoring._internal.groupByDebtor(list)`
- Mobile Read Model (숫자만 반환): `selectMobileMonitoringLiteSummary()` in `js/app.js`

### DOM 확인
- Mobile Mode에서 `#m-tab-monitoring` 패널 활성화 후
  - `Monitoring Lite` 카드가 보이며 2개 KPI 카드가 노출됨
  - 각 KPI 행의 값이 `--`가 아닌 숫자/통화 형식으로 표시됨

---

## 2) Report (Mobile → Report 탭)

### 표시 KPI (확정)
- 총 채무금액 (DebtTotal)
- 채무상환금 (DebtPaid)
- 채무미납금 (DebtOverdue)
- 상환율 (%)

### 계산 출처 (중요: 로직 복제 금지)
- Desktop Report가 사용하는 기존 집계 함수 재사용:
  - `App.reportCompute.computeAggregates()`
- Desktop Report → Statistics에서 사용하는 기존 Summary 스냅샷 재사용:
  - `App.features.statisticsEngine.buildContext(agg).summary`
    - `summary.debttotal` → DebtTotal
    - `summary.debtpaid` → DebtPaid
    - `summary.debtoverdue` → DebtOverdue
- Mobile Read Model (숫자만 반환): `selectMobileReportOverviewKpiLite()` in `js/app.js`
- 상환율(%)은 위 summary 결과로부터 단순 비율로만 표기 (UI 레벨 표시용)

### DOM 확인
- Mobile Mode에서 `#m-tab-report` 패널 활성화 후
  - `총 채무금액 / 채무상환금 / 채무미납금 / 상환율` 4개 KPI가 노출됨
  - 리스트/그래프/드릴다운/클릭 이동 없음

---

## 3) Mobile Read Model 구조 (Phase 4)

### Monitoring Lite Read Model
- 함수: `selectMobileMonitoringLiteSummary()`
- 반환 필드(숫자 전용)
  - `ddayAmountTotal`
  - `ddayDebtorCount`
  - `overdueDebtorCount`
  - `overdueAmountTotal`
- 포함 금지 준수
  - 원본 스케줄 배열/로그 배열을 반환하지 않음
  - Desktop UI 상태값을 포함하지 않음

### Report KPI Read Model
- 함수: `selectMobileReportOverviewKpiLite()`
- 반환 필드(숫자 전용)
  - `debtTotal`
  - `debtPaid`
  - `debtOverdue`
  - `repayRatePct`
- 포함 금지 준수
  - 차트용 시계열/로그 배열 없음
  - 기간 필터/드릴다운 없음

---

## 4) Desktop 훼손 0 확인 체크리스트
- Desktop 모드(>=1024px)에서
  - 기존 Monitoring 탭 UI/동작 변화 없음
  - 기존 Report 탭 UI/동작 변화 없음
  - 기존 저장/로드/모달 동작 변화 없음
- Mobile 모드(<=768px)에서
  - Desktop DOM은 언마운트됨(동시 존재 + CSS 숨김 방식 아님)

---

## 5) Phase 4에서 의도적으로 제외한 기능
- Monitoring Lite
  - 리스트/상세/그래프/로그/클릭 이동 전부 제외
  - D-1/위험/경고/추가 카드 전부 제외
- Report
  - Overview KPI 외 섹션(Statistics/Capital Flow/Risk) 미노출
  - 기간 필터/그래프/드릴다운/클릭 이동 전부 제외
