# 시나리오 · 화면 흐름

세 앱 각각의 **주요 화면**만 이어 붙인, 실제로 눌러 볼 수 있는 프로토타입(PoC)입니다. 모든 기능을 만들지 않고, 시나리오를 끝까지 따라가는 데 필요한 핵심 기능만 동작합니다. 데이터는 전부 데모이고, 화면에서 `DEMO` 표시가 붙은 수치는 실제로 측정하거나 계산한 값이 아닙니다.

- **스토리:** 누가, 어떤 상황에서, 왜 쓰는지와 시연 대본은 `docs/scenario-stories.md`에 있습니다. 이 문서는 화면·기능 명세입니다.
- **화면 보기:** 모든 화면을 시나리오 순서대로 보려면 `flows.html`을 엽니다.
- **눌러 보기:** `index.html`에서 시나리오 옆의 ▶ Play를 누르면, 미리보기 안에서 화면을 이동하는 대로 왼쪽 목록이 따라옵니다.
- **폰에서 열기:** PC에서 `python3 -m http.server 8080 --bind 0.0.0.0`을 실행하고, 같은 Wi-Fi의 폰에서 `http://<PC의 IP>:8080/pc-health-home.html`처럼 각 시나리오의 첫 화면을 엽니다. 화면이 폰 전체를 채우고 터치로 동작합니다.
- **자동 점검:** `node scripts/walkthrough.mjs`가 세 시나리오를 처음부터 끝까지 눌러 보며 확인합니다.

공통 규칙:
- **화면 이동:** `data-action="nav" data-href="x.html"` 또는 `<a href data-nav>`로 이동하면 다음 화면이 살짝 밀려 들어옵니다. 자동으로 넘어가는 단계(스캔 완료, 처리 완료)는 `replace`로 이동해서 뒤로가기 기록에 남지 않습니다.
- **뒤로가기:** `data-au-back="a.html b.html"`에 이 화면을 열 수 있는 부모 화면들을 적습니다. 들어온 화면이 그중 하나면 그 화면으로, 아니면 첫 번째 화면으로 돌아갑니다.
- **공유 데이터:** 시나리오의 데모 데이터는 화면끼리 공유하며, 브라우저 `localStorage`의 `au-demo:<앱 id>`에 저장됩니다. 메뉴의 "Reset demo data"나 미리보기의 ▶ Play로 초기화합니다. `?capture=1`에서는 저장값을 무시하고 항상 기본 상태를 보여 줍니다.

---

## 1 · PC Health — 중고 PC를 사기 전 하드웨어 점검
**목표:** 판매자의 PC를 연결해 스캔하고, 결과를 보고 판매자에게 질문하거나 리포트를 공유합니다.

| # | 화면 | 파일 | 핵심 기능 | 다음 |
|---|---|---|---|---|
| 1.1 | Home | `pc-health-home.html` | 최근 점검 3건(점수·상태), New Check | 행 → 1.4 · New Check → 1.2 |
| 1.2 | Connect PC | `pc-health-connect.html` | PC 찾기(약 2초 뒤 연결됨), 페어링 코드·만료 카운트다운, 연결 전 Start Scan 비활성 | Start Scan → 1.3 |
| 1.3 | Scanning | `pc-health-scan.html` | 진행 링, 5개 항목(CPU·GPU·Memory·Storage·Battery) 순차 점검, Cancel | 완료 시 자동 → 1.4 |
| 1.4 | Result ★ | `pc-health.html` | 점수 링, 카드 펼침, Rescan(Healthy → Fair → Needs attention) | 펼친 카드의 See details → 1.5 · View Full Report → 1.6 |
| 1.5 | Part Detail | `pc-health-part.html?part=gpu` | 부하 온도 그래프(85° 한계선), 측정값, 판정, **Ask the Seller**(메시지 복사) | Back → 1.4 / 1.6 |
| 1.6 | Full Report | `pc-health-report.html` | 요약, 부품 3개(탭 → 1.5), 공유 링크 복사, 공유 시트 | 부품 → 1.5 |

공유 데이터 `pc-health`: `{ scenario, open, scannedAt, device }`. 결과·부품·리포트 화면이 같은 시나리오(Healthy/Fair/Attention)를 보여 줍니다.

## 2 · Meeting Notes — 회의 녹음 → AI 노트
**목표:** 회의를 녹음하고 멈추면 전사와 요약이 만들어지고, 노트에서 할 일을 체크하고 전사를 찾아봅니다.

| # | 화면 | 파일 | 핵심 기능 | 다음 |
|---|---|---|---|---|
| 2.1 | Home | `meeting-notes-home.html` | 최근 회의(방금 녹음한 회의가 맨 위에 New), New Recording | 행 → 2.4 · New Recording → 2.2 |
| 2.2 | Recording ★ | `meeting-notes.html?fresh=1` | 00:00부터 타이머, 파형, 실시간 전사, Pause/Resume, AI 요약 탭 | Stop → 2.3 |
| 2.3 | Processing | `meeting-notes-processing.html?d=초` | 전사 → 요약 → 할 일 단계 진행(약 5초), Run in Background | 완료 시 자동 → 2.4 |
| 2.4 | Notes | `meeting-notes-notes.html?m=q4` | AI 요약(DEMO), Key points · Decisions · Actions 탭(화살표 키), 할 일 체크, 공유 시트 | Full transcript → 2.5 |
| 2.5 | Transcript | `meeting-notes-transcript.html?m=q4` | 검색(하이라이트), 화자 필터, 재생(오디오 없이 현재 줄 따라가기), 줄을 탭하면 이동 | Back → 2.4 |

공유 데이터 `meeting-notes`: `{ recorded: { duration }, done: { 회의id: [할 일 id] } }`. 회의 데이터 4건(`q4 · design · oneonone · acme`)은 `scripts/flows/meeting-notes.js`에 있습니다.

## 3 · Our Discussion — 부부의 공동 결정
**목표:** 두 사람이 여행지를 비교하고 대화하며 항목별로 합의해, 결정을 확정합니다.

| # | 화면 | 파일 | 핵심 기능 | 다음 |
|---|---|---|---|---|
| 3.1 | Home | `our-discussion-home.html` | 진행 중·결정된 토픽, 합의 진행률, New Topic(시트에서 입력 → 목록 추가) | Travel Plans → 3.2 |
| 3.2 | Topic ★ | `our-discussion.html` | 옵션 선택(라디오), 합의 60% → 80%, Compare · Points · Discuss | → 3.3 · 3.5 · 3.4 |
| 3.3 | Compare | `our-discussion-compare.html` | Italy vs Japan 표(예산·비행·날씨·볼거리), 각자의 이유, 내 선택 바꾸기 | Back → 3.2 / 3.5 |
| 3.4 | Discussion | `our-discussion-thread.html` | 채팅, 빠른 답장, Joon의 자동 답장(입력 중 표시, DEMO) | 목록 아이콘 → 3.5 |
| 3.5 | Agreement | `our-discussion-agreement.html` | 5개 항목 × 두 사람 상태, 내 동의 토글, 목적지는 같은 선택일 때 자동 합의, 5/5일 때만 Make It Official | → 3.6 |
| 3.6 | Decision | `our-discussion-decision.html` | 결정 결과, 계획 요약, 다음 할 일 체크, 캘린더 추가(데모) | Back → 3.2 |

공유 데이터 `our-discussion`: `{ you, partner, agreed, messages, topics, decided }`. Joon은 시뮬레이션입니다. Option A를 골랐고, 목적지를 뺀 모든 항목에 동의한 상태입니다.

---

## 화면 추가하기
```bash
node scripts/new-screen.mjs pc-health pc-health-history "History" --back="pc-health-home.html" --desc="All past checks"
```
위 명령은 화면 파일을 만들고, `scripts/flows/pc-health.js`에 로직 틀을 추가하고, 레지스트리의 같은 시나리오 마지막(1.7)에 등록합니다. 그다음 할 일은 다음과 같습니다.
1. 다른 화면에서 이 화면으로 이동하는 버튼을 답니다.
2. 이 표에 행을 추가합니다.
3. `scripts/walkthrough.mjs`에 단계를 추가합니다.

자세한 절차는 `prompts/06-scenario-screens.md`에 있습니다.

## 언어
모든 화면은 `?lang=ko|en`으로 한국어·영어를 바꿀 수 있습니다(`flows.html` 상단의 Language). 시나리오 이름·상태 이름도 번역됩니다. 새 화면을 추가하면 `prompts/08-translation.md`를 따르세요.
