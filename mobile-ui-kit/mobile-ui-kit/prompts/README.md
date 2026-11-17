# 프롬프트 사용법

IDE(Claude Code, Cursor, Codex, Copilot 등)에서 이 저장소를 열면 규칙 파일(`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/…`, `.github/copilot-instructions.md`)이 자동으로 읽힙니다. 아래 프롬프트는 작업할 때마다 골라서 붙여 넣으세요.

| 파일 | 언제 |
|---|---|
| `00-project-brief.md` | 새 세션을 시작할 때 한 번. 원래 요청서와 이후 결정 사항이 들어 있습니다 |
| `01-new-app.md` | 앱 1개를 만들 때. [입력] 칸만 채우면 됩니다 |
| `02-batch-from-backlog.md` | `apps/backlog.md`의 앱을 3개씩 이어서 만들 때 |
| `03-review.md` | 만든 앱을 검수하거나 고칠 때 |
| `04-capture.md` | 사진 합성용 PNG를 뽑을 때 |
| `05-composite-photo.md` | 폰을 든 사진에 UI를 합성할 때 |
| `06-scenario-screens.md` | 앱의 시나리오 상세 화면(대표 화면 앞뒤 흐름)을 추가할 때 |
| `07-prototype-poc.md` | 눌러 볼 수 있는 프로토타입을 점검하고 시연을 준비할 때 |
| `08-translation.md` | 새 앱·화면의 한국어 번역을 넣거나 번역을 검수할 때 |

## 추천 흐름
1. `apps/backlog.md`에 앱 이름과 목적을 적습니다. 화면 구성까지 적으면 더 좋습니다.
2. IDE에서 시작합니다: "`prompts/00-project-brief.md`를 읽고, `prompts/02-batch-from-backlog.md`대로 진행해줘."
3. 3개가 끝날 때마다 `index.html`에서 결과를 확인합니다. 고칠 점은 `03-review.md`로 지시합니다.
4. 전부 끝나면 `04-capture.md`로 PNG를 뽑고, 필요하면 `05-composite-photo.md`로 사진에 합성합니다.

시나리오 상세 화면을 늘릴 때는 `apps/scenarios.md`(지금 있는 17개 화면의 흐름표)를 보고 `06`, 다 모이면 `07`을 씁니다.

짧게 시켜도 됩니다. 예: "backlog의 07번을 01-new-app.md대로 만들어줘", "12번 다크 모드 검수해줘(03-review.md)".
