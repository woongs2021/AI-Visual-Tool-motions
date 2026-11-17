# 06 · 시나리오 상세 화면 추가

> 앱의 대표 화면(★) 앞뒤로 이어지는 상세 화면을 만들 때 씁니다. 결과물은 실제로 눌러 볼 수 있는 프로토타입입니다. 이미 만든 세 시나리오는 `apps/scenarios.md`에 있으니, 같은 수준과 형식으로 만듭니다.

---

## [입력]
- 앱 / 시나리오: `pc-health` (PC Health)
- 사용자 목표 (한 문장): 지난 점검을 다시 보고, 두 PC를 비교해서 어느 쪽을 살지 정한다
- 추가할 화면 (흐름 순서):
  | 화면 | 목적 | 꼭 보여야 할 것 | 핵심 기능 (동작해야 함) | 어디서 오고 어디로 가나 |
  |---|---|---|---|---|
  | History | 모든 점검 목록 | 기기, 날짜, 점수 · 상태 | 상태 필터 칩, 행 탭 → 결과 | Home의 "Recent checks" 더보기 → History → Result |
  | Compare PCs | 두 기기 비교 | 점수, 부품별 상태, 가격 | 기기 바꾸기, "이걸로 결정" | Result 메뉴 → Compare → Home |
- 공유 데이터: 결과 화면과 같은 `pc-health` 저장소를 쓴다 (`scenario`, `device`)
- 데모로 표시할 것: 가격은 샘플 값이라 DEMO 태그를 단다
- UI 문구 언어: English

---

## [지시]
`CLAUDE.md`의 규칙과 `apps/scenarios.md`의 공통 규칙을 지켜 위 화면들을 만드세요. **모든 기능이 아니라, 시나리오를 끝까지 따라가는 데 필요한 핵심 기능만** 구현합니다.

1. **흐름부터 정리합니다.** `apps/scenarios.md`의 해당 시나리오 표에 새 행을 추가합니다. 열은 번호, 화면, 파일, 핵심 기능, 다음 화면이고, 표가 곧 화면 목록입니다. 진입점(어느 버튼에서 오는지)과 나가는 길(Back이 어디로 가는지)을 정합니다.
2. **화면마다 생성합니다.**
   `node scripts/new-screen.mjs <app-id> <screen-id> "<Title>" --back="<부모.html> [<다른 부모.html>]" --desc="<한 줄>"`
   - 목록처럼 길어서 스크롤되는 화면은 `--scroll`을 붙입니다. 그 외에는 기본 상태가 390 × 844에 스크롤 없이 들어가야 합니다.
3. **마크업** (`<screen-id>.html`)
   - 먼저 공통 컴포넌트(`components.css`)와 시나리오 공용 부품(`styles/flows.css`의 `fl-*`)을 씁니다. 목록 행은 `fl-item`, 상태 행은 `fl-status`, 단계는 `fl-steps`, 칩은 `fl-chip`, 차트는 `fl-chart`입니다.
   - 새로 필요한 모양만 `styles/flows.css`에 해당 시나리오 섹션을 만들어 추가합니다. 색은 토큰만 씁니다.
   - 화면 위쪽 순서는 정보 위계대로 합니다: 핵심 숫자·상태 하나 → 근거·목록 → 안내. 주요 버튼(`au-button`)은 하단 고정 영역에 하나만 둡니다.
4. **로직** (`scripts/flows/<app-id>.js`에 추가된 `AUKit.defineScreen` 틀을 채웁니다)
   - 화면 간 데이터는 `store.get('<app-id>', DEFAULTS)`와 `store.set(...)`으로 공유합니다. 다른 화면이 쓰는 필드를 지우지 않도록, 기존 값에 덮어써서 저장합니다.
   - 이동은 `nav('x.html')`로 합니다. 자동으로 넘어가는 단계는 `nav(..., { replace: true })`로 이동합니다.
   - `apply(params)`는 캡처할 상태를 URL로 재현합니다. `?capture=1`에서는 애니메이션과 타이머 없이 대표 상태를 보여 줍니다.
   - 상태가 바뀌면 `aria-*`와 `announce()`를 함께 갱신합니다.
5. **연결:** 진입하는 화면에 버튼이나 링크를 추가합니다(`data-action="nav" data-href="…"` 또는 `<a href data-nav>`). 부모가 둘 이상이면 `data-au-back`에 모두 적습니다.
6. **등록:** `apps/registry.js`에서 새 화면의 `states`와 `notes`를 채웁니다. 기본 상태(`q: ''`)는 반드시 넣습니다.
7. **자동 점검 추가:** `scripts/walkthrough.mjs`의 해당 시나리오에 새 단계를 추가합니다. 형식은 `{ name, do, expect }`입니다.
8. **검증:**
   - `index.html`에서 Light와 Dark 각각 "Run check"를 실행해 모두 Pass인지 확인합니다.
   - `node scripts/walkthrough.mjs <app-id>`가 통과해야 합니다.
   - `node scripts/capture.mjs --theme=both --app=<screen-id>`로 PNG를 뽑아 직접 봅니다.
   - `flows.html`에서 흐름이 자연스럽게 이어지는지 확인합니다.
9. 바꾼 파일, 검사 결과, 화면 흐름을 짧게 보고합니다.

[번역]
- 화면이 끝나면 `prompts/08-translation.md` 순서대로 `scripts/i18n/ko.js`에 한국어를 넣고 `npm run i18n-check`를 통과시킨다. 한국어로도 390×844 검사를 통과해야 완료다.

[시나리오 스토리]
- 화면을 추가하면 `docs/scenario-stories.md`의 해당 앱 사용자 여정 표와 시연 대본에도 단계를 추가한다.
