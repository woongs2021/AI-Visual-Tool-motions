# AI Visual Cue Studio

AI 에이전트가 활성화될 때 화면에 나타나는 **비주얼 큐(AI Visual Cue)**의 컬러·물성·크기·모션을 웹에서 조절하고, 그 결과를 **Kotlin + Jetpack Compose 코드**로 내보내는 디자인 툴입니다.

### ▶ 바로 열기: [**woongs2021.github.io/AI-Visual-Tool-motions**](https://woongs2021.github.io/AI-Visual-Tool-motions/)

설치나 빌드 없이 브라우저에서 바로 동작합니다. WebGL2를 지원하는 최신 Chrome, Edge, Safari, Firefox에서 열 수 있습니다.

---

## 주요 기능

- **프리뷰 2개 뷰**: **Adaptive Screen** 시안(전체 화면, 맨 앞) / **전체 비교**(① 비주얼 큐와 ② 앱 적용을 나란히). 좌우 화살표, 키보드 ←/→, 드래그로 넘깁니다. 전체 비교의 두 화면은 같은 시간축으로 동기화되어 무한 루프로 재생됩니다.
- **Adaptive Screen 시안**: 맥락에 따라 화면이 스스로 재구성되는 전체 화면 루프입니다. 글자가 한 자씩 블러에서 선명해지며 쓰이고, 하단 컨트롤 바가 물방울처럼 갈라지고 합쳐져 탭으로 정리됩니다. [`adaptive_screen_loop_code/screen_loop.html`](adaptive_screen_loop_code/screen_loop.html)의 엔진을 툴로 옮겨 왔고(360 × 780dp 비율), EN / KO 토글과 재생·일시정지·타임라인 이동이 함께 동작합니다. 이 뷰에서는 L1/L2/L3 버튼이 S1/S2/S3(상태 이동)이 됩니다. Design 탭의 큐 설정은 이 시안이 아니라 전체 비교에 반영되며, 영상 저장은 [`render.py`](adaptive_screen_loop_code/render.py)로 합니다.
- **한 사이클 모션**: 페이드 인 → L1 부유 → L2 카드가 앱 콘텐츠 사이에 끼어들며 리스트 생성(아래 콘텐츠는 밀려 내려감) → L3 전체 화면 글로우 + 리스트가 전체 화면 레이아웃으로 재배치 → 페이드 아웃 → 반복
- **Design 탭**
  - 컬러: 3스톱 그라데이션 에디터(칩 드래그로 위치 조절), 레퍼런스 영상에서 추출한 프리셋 3종(Azure / Blossom / Indigo)과 난색 프리셋 3종(Ember / Amber / Rosé), 그린 프리셋 3종(Mint / Jade / Lime), 방사형·선형
  - 물성 9종: 소프트 글로우, 오라(빛이 감싸며 번짐), 워터(굴절·물결), 가스(연기·성운), 네온, 프로스티드 글래스, 리퀴드 메탈, 펄, 매트 클레이 (타입별 세부 파라미터)
  - 투명도: 물성과 상관없이 큐 전체의 불투명도를 조절
  - 크기: 구 지름, 납작 상태 폭·두께, 안착 높이·두께·모서리, 여백
  - 모션: 재생 속도, 전환 시간, 레벨별 유지 시간, 전환 방식(모프 / 위상 회전), 이징 프리셋, 부유, 그림자
- **Code 탭**: 현재 설정이 그대로 들어간 Kotlin 파일, AGSL 셰이더, 설정 JSON을 보여주고 복사할 수 있습니다.
- **색상 변경**: 그라데이션 칩을 클릭하면 컬러 피커가 열립니다(드래그하면 위치 조절). 리스트 강조색, 리스트 카드 배경, 그림자 색, ① 프리뷰 배경도 따로 지정할 수 있고 "자동으로"를 누르면 기본 규칙으로 돌아갑니다.
- **Set as default**: 상단 버튼을 누르면 지금 설정과 보고 있는 뷰가 이 브라우저에 기본값으로 저장됩니다. 다음에 페이지를 열면 그 화면에서 시작하고, 아래 초기화 버튼들도 그 값으로 돌아갑니다. 패널 맨 아래 "처음 기본값으로"를 누르면 저장한 기본값이 지워집니다. 저장 위치는 브라우저(localStorage)라서 다른 기기나 다른 사람에게는 공유되지 않습니다.
- **초기화**: 슬라이더마다 ↺ 버튼(값을 바꿨을 때 표시), 섹션 제목 옆 "초기화", 패널 맨 아래 "전체 초기화"
- **실제 같은 앱 화면**: 전체 비교의 ② 앱 적용 화면은 더미 텍스트와 일러스트 썸네일이 들어간 앱 화면이고, 큐가 만드는 리스트에도 실제 문구가 들어갑니다. 프리뷰 위 **EN / KO** 토글로 언어를 바꿉니다(기본 영문, Adaptive Screen 문장도 함께 바뀝니다). 생성되는 Kotlin 코드의 리스트 문구도 같은 언어로 나옵니다.
- **루프 내보내기**: 전체 비교 화면의 "⤓ 내보내기"에서 ① / ② / 전체 비교 중 하나를 골라 루프 1회를 저장합니다. (Adaptive Screen 시안은 내보내기 대상이 아닙니다.)
  - MP4: 720 × 1560(전체 비교는 더 넓음), 30fps, H.264. H.264 인코더가 없는 브라우저에서는 VP9로 저장
  - GIF: 360 × 780, 15fps, 무한 반복
  - 브라우저 안에서 프레임을 하나씩 렌더링해 인코딩하므로 수십 초가 걸릴 수 있습니다.
- 다크/라이트 모드, 설정 자동 저장(브라우저 localStorage)

## 폴더 구조

```
.
├─ index.html                 # 툴 전체 (단일 파일, GitHub Pages 진입점)
├─ android/
│  └─ AiVisualCue.kt          # 기본 설정으로 생성한 Compose 코드 예시
├─ adaptive_screen_loop_code/ # Adaptive Screen 시안의 원본 (툴 실행에는 필요 없음)
│  ├─ screen_loop.html        #   단독 실행되는 애니메이션 엔진
│  ├─ render.py               #   HTML → MP4 렌더러
│  ├─ CLAUDE_GUIDE.md         #   Claude로 변형을 만드는 가이드
│  └─ fonts/                  #   Urbanist (OFL)
├─ docs/
│  ├─ development-plan.md     # Phase별 개발 계획서
│  └─ prompt.md               # 최초 요구사항 프롬프트
├─ .nojekyll
└─ README.md
```

## 구조: 하나의 상태에서 프리뷰와 코드를 함께 만든다

```
          ┌──────────── Spec (컨트롤 값 전체, JSON) ────────────┐
          │                                                      │
  타임라인 · 포즈 계산                                  코드 생성기
          │                                                      │
  WebGL2 셰이더 (GLSL ES 3.0) ◀── 같은 셰이더 소스 ──▶ AGSL (RuntimeShader)
          │                                                      │
     웹 프리뷰                                     Kotlin + Jetpack Compose
```

- 셰이더 본문은 `float2/float3/float4` 공통 문법으로 작성되어 있고, 웹에서는 매크로로 GLSL 타입에 연결하며 Android에서는 그대로 AGSL이 됩니다.
- 형태(납작 → 구 → 카드 → 전체 화면)는 둥근 사각형 SDF 하나로 표현하고, 레벨 사이는 파라미터 보간으로 연속 변형됩니다.
- 이징은 `cubic-bezier` 4개 숫자를 웹과 Compose `CubicBezierEasing`에 똑같이 사용합니다. 기본값은 레퍼런스 영상 리듬(약 0.3초 가속 → 0.4초 감속)에 맞춘 `0.6, 0, 0.1, 1`입니다.

## 생성 코드 사용법 (Android)

1. 툴의 Code 탭에서 **복사**를 눌러 `AiVisualCue.kt`로 프로젝트에 붙여넣습니다. 패키지명은 프로젝트에 맞게 바꿉니다.
2. 화면에서 호출합니다.

```kotlin
// 툴과 같은 무한 루프
AiVisualCueDemoLoop()

// 앱 상태로 레벨 제어 (Idle이면 페이드 아웃)
AiVisualCue(level = CueLevel.L2)

// 카드를 내 화면의 콘텐츠 사이에 끼워 넣기
AiVisualCueDemoLoop(
    spec = AiVisualCueSpec(cardTop = 326f),          // 카드가 들어갈 위치(dp)
    underlay = { insert, fullscreen ->
        MyScreen(pushBelowSlot = insert, alpha = 1f - 0.86f * fullscreen)
    },
)
```

| 항목 | 내용 |
|---|---|
| minSdk | 26 |
| Android 13 (API 33)+ | AGSL `RuntimeShader`로 프리뷰와 같은 셰이더 사용 |
| API 26–32 | 그라데이션 `Brush`와 그림자로 근사하는 대체 경로 |
| 의존성 | Compose BOM 기본 라이브러리(ui, foundation, animation)만 사용 |

> 생성 코드는 아직 실제 Android 기기에서 컴파일·실행 검증을 거치지 않았습니다. 빌드 오류가 나면 이슈로 남겨 주세요.

## GitHub Pages 설정

`Settings → Pages → Build and deployment`에서 **Source: Deploy from a branch**, **Branch: `main` / `(root)`**를 선택하면 위 링크로 배포됩니다.

## 참고

- 기본 팔레트 3종과 모션 리듬은 레퍼런스 영상(field_io "Quantum / Qubit" 포스트)에서 측정한 값을 사용했습니다.
- 물성 5종, 레벨별 배치, 앱 목업 화면은 v0.1의 임시 정의입니다. 자세한 가정과 이후 단계는 [개발 계획서](docs/development-plan.md)를 참고하세요.
