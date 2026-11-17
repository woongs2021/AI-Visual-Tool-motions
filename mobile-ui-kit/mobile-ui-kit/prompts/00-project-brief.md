# 00 · 프로젝트 브리프 (원래 요청 + 이후 결정 사항)

> IDE 에이전트에게 맨 처음 한 번 붙여 넣거나, "prompts/00-project-brief.md를 읽고 시작해"라고 지시하세요.
> 저장소 규칙은 `CLAUDE.md` / `AGENTS.md` / `.cursor/rules`에 같은 내용으로 들어 있습니다.

---

당신은 15년 이상의 경력을 가진 Senior Product Designer이자 Frontend Engineer입니다.

## 목표
실제 스마트폰 사진에 합성할 고품질 모바일 앱 UI를 제작합니다. 앱마다 기능은 다르지만 **하나의 디자인 시스템**을 씁니다. 지금 저장소에는 01–03이 완성되어 있고, `apps/backlog.md`의 나머지 앱을 같은 수준으로 추가합니다.

## 기술
- HTML5, CSS3, Vanilla JavaScript만 사용합니다. 외부 UI 프레임워크는 쓰지 않습니다.
- 디자인 토큰은 CSS 변수로 관리하고(`styles/tokens.css`), 아이콘은 SVG로 그립니다.
- 앱마다 독립 HTML 파일을 하나씩 두고, `index.html`에서 모든 화면을 선택해 미리봅니다.
- 화면 기준은 390 × 844 CSS px입니다. 고해상도 PNG 캡처에 맞게 선명한 벡터 UI로 만들고, 캡처할 때 기기 프레임 없이 UI만 출력합니다.

## 공통 디자인
| 항목 | 라이트 | 다크 |
|---|---|---|
| Background | #FFFFFF | #0F1013 |
| Primary Text | #17191D | #F2F3F5 |
| Secondary Text | #747B86 | #9AA1AC |
| Card Background | #F6F7F9 | #1A1C21 |
| Border | #E8EBEF | #272A30 |

- Corner Radius 16px · Horizontal Padding 24px · 8px spacing system
- 폰트는 Pretendard를 쓰고, 없으면 Inter와 시스템 폰트로 대체합니다.
- 컬러는 절제해서 씁니다. 색은 상태와 데이터를 나타낼 때 쓰고, 주요 버튼만 앱 액센트로 칠합니다.
- 네이티브 모바일 앱처럼 보이게 합니다. 장식용 그래픽, 3D, 글래스모피즘은 쓰지 않습니다.
- 여백을 충분히 두고 시각적 위계를 명확하게 합니다. 글자는 폰에서 읽기 쉬운 크기로 씁니다.
- 상태바는 기본으로 숨기고 `?statusbar=1`로 켭니다. 화면 가장자리의 안전 여백(위 47, 아래 34)은 항상 비워 둡니다.

## 구현 품질
- 출시 앱 수준으로 정교하게 만듭니다. 모든 버튼과 상태 전환이 실제로 동작해야 합니다.
- 터치 영역은 최소 44px로 하고, 키보드 포커스와 접근성 레이블을 갖춥니다.
- 레이아웃은 CSS Grid와 Flexbox로 짭니다. 불필요한 텍스트와 의미 없는 장식은 넣지 않습니다.
- 긴 텍스트나 작은 화면에서도 레이아웃이 깨지지 않아야 합니다.
- 화면 합성을 위해 **스크롤 없는 기본 캡처 상태**를 제공합니다(`?capture=1`).
- 실제 API(녹음, 하드웨어 등)는 연결하지 않습니다. 데모 상태를 화면에 명확히 표시하고, 데모 수치가 실제 계산 결과로 오해되지 않게 합니다.

## 완성된 앱 (참고용 수준)
| # | 앱 | 목적 | 액센트 |
|---|---|---|---|
| 01 | PC Health | 중고 컴퓨터 거래 전 하드웨어 상태 점검 — 원형 건강 점수 98%, CPU/GPU/Memory 진단 카드(펼침), 전체 상태 안내, View Full Report | #10B981 |
| 02 | Meeting Notes | 회의 녹음 및 AI 전사·요약 — Recording 02:36, 파형, Live Transcript, AI Summary(탭), Pause/Stop | #7C5CFA · 녹음 #EF4444 |
| 03 | Our Discussion | 부부의 공동 의사결정 — Travel Plans, Option A Italy / B Japan, 두 참여자, Agreement 60%(데모), Discuss | #635BFF |

---

## 이후 결정 사항 (대화에서 확정된 것)
1. **테마:** 라이트와 다크를 모두 지원합니다. 기본은 OS 설정을 따르고, `?theme=light|dark`, `data-au-theme`, `AUKit.theme.set()`으로 강제할 수 있습니다. 대표 이미지는 **다크**로 썼습니다.
2. **주요 버튼 색:** 처음에는 중립색(검정·흰색)이었다가 **앱의 primary(액센트) 색**으로 바꿨습니다.
   - 글자색은 대비로 정합니다. 흰 글자 대비가 4.5:1 이상이면 흰색, 아니면 어두운 글자를 씁니다.
   - 예: #10B981 그린은 흰 글자 대비가 2.5:1이라 #04130D(8.6:1)를 씁니다. `scripts/new-app.mjs`가 자동으로 계산합니다.
3. **토큰 이름 규칙:** 첨부된 `agent-ui.css`(Agent UI kit)의 `--au-*` 이름 규칙, SEED식 색 역할, 타입 스케일 이름을 따랐습니다. 다만 그 키트의 글래스 효과, 에이전트 볼, 그라데이션 배경은 이번 브리프(장식 금지)에 맞춰 쓰지 않았습니다.
4. **합의율 같은 데모 수치:** 연속 점수 대신 "5개 중 3개 합의"처럼 셀 수 있는 근거로 보여 주고, `DEMO`와 `Sample data`를 화면에 함께 표시합니다.
5. **사진 합성용 PNG:** 1170 × 2532(@3x)로 뽑습니다. 합성할 때는 다크 테마에 **상태바를 켜고**(9:41) 썼습니다. 노치나 다이내믹 아일랜드, 손가락은 원래 사진 것을 살립니다(`tools/composite/`).
6. **재사용 구조:** 앱 목록은 `apps/registry.js` 하나에 둡니다. 새 앱은 `scripts/new-app.mjs`로 만들고, 앱별 파일은 `<id>.html`, `styles/apps/<id>.css`, `scripts/apps/<id>.js`로 나눕니다.
7. **시나리오 상세 화면과 프로토타입:** 세 앱마다 주요 화면만 이어 붙인 PoC를 만들었습니다. PC Health 6개, Meeting Notes 5개, Our Discussion 6개입니다.
   - 핵심 기능만 동작하고, 화면 간 데이터는 시나리오별 저장소로 공유합니다.
   - 흐름표는 `apps/scenarios.md`, 전체 화면 보드는 `flows.html`, 자동 점검은 `scripts/walkthrough.mjs`입니다.
   - 새 상세 화면은 `scripts/new-screen.mjs`로 만듭니다.
