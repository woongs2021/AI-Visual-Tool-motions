# Adaptive Screen Loop — Claude용 가이드

이 폴더를 Claude에게 첨부하고 아래처럼 요청하면 같은 모션 구조로 다른 글자·아이콘 버전을 만들 수 있습니다.

> "screen-loop 폴더의 CLAUDE_GUIDE.md를 따라서, states를 아래 내용으로 바꾸고 루프 영상 렌더해줘: …"

---

## 1. 파일 구성

| 파일 | 역할 |
|---|---|
| `screen_loop.html` | 애니메이션 엔진. 상단의 `CONFIG` 블록만 고치면 됨. 브라우저로 열면 실시간 미리보기 |
| `render.py` | HTML → MP4 (끊김 없는 루프) 또는 특정 시점 스틸 이미지 렌더 |
| `CLAUDE_GUIDE.md` | 이 문서 |
| `fonts/` | 폰트 폴더. 여기에 `SamsungSharpSans-Regular.otf / -Medium.otf / -Bold.otf`(또는 .ttf)를 넣으면 자동 적용. 없으면 비슷한 무료 폰트 Urbanist(OFL) 사용 |

필요 환경: `pip install playwright && playwright install chromium`, `ffmpeg`.

```bash
python3 render.py screen_loop.html out.mp4                 # 1루프 영상
python3 render.py screen_loop.html stills/ --at 0 1 2.3    # 확인용 스틸 (초 단위)
python3 render.py screen_loop.html out.mp4 --loops 3       # 3바퀴 이어붙인 영상
```

## 2. 애니메이션 구조 (원본 분석 결과)

재생 순서는 `CONFIG.sequence`(상태 번호 목록, 0부터)로 정합니다. 기본 `[0, 1, 2, 1]` = 1→2→3→2→(다시 1) 순환. 비워두면 1→2→3→1 순서.
한 상태(state) = `stateDuration`초. 각 상태의 시작부에서 **이전 → 현재** 전환이 일어나고 나머지는 정지(hold)입니다. sequence 끝에서 처음으로 돌아가므로 영상 길이 = sequence 길이 × stateDuration 이고 처음/끝 프레임이 이어집니다.

전환 타임라인 (상태 시작 기준, 초):

```
0.00 ─ 0.50   이전 텍스트: 투명도 1→0 + 블러 0→12px + 위로 18px
(선택)     헤드 아이콘: 작은 별들이 계속 반짝이며 천천히 회전·부유 (루프 길이의 정수배 주기)
0.05 ─ 1.55   (선택) 헤드 아이콘 "생각 중": 큰 별이 부드럽게 90° 회전, 작은 별은 바깥으로 살짝 퍼지며 반짝임이 강해짐
0.20 ─ 1.25   하단 바 물방울 분리: 새 버튼이 옆 버튼에서 떨어져 나오고, 없어질 버튼은 흡수 (아래 규칙)
0.15 ─ 1.54   (row↔tabs일 때) 한 덩어리로 합쳐진 뒤 버튼이 안에서 나타남
0.42 ~        새 텍스트: 글자 하나씩 써지듯 등장 (0.011초 간격, 공백도 한 칸)
              각 글자는 앞 30% 동안 나타나고, 1.15초 동안 블러 18→0px·아래 10px→0
              → 쓰는 위치 바로 뒤를 블러 꼬리가 따라감 (`charStagger`, `charDur`, `charInk`, `charBlur`, `charRise`)
0.00 ─ 1.40   배경 그라데이션 색이 다음 상태 색으로 보간
```

### 하단 바 모핑 규칙 (`id`로 요소를 추적)
상태가 바뀔 때만 (row→row, row→tabs, tabs→row 모두) goo(메타볼) 필터로 물방울이 쪼개지듯 바뀝니다. 정지 구간에는 움직이지 않습니다.
- 같은 id: 새 위치·크기로 이동
- 새 id: 가장 가까운 공유 요소(오른쪽 우선)의 끝에서 작은 물방울로 시작해 떨어져 나옴. 버튼 아이콘은 후반 50%, 입력창 글자는 마지막 30%에 페이드인
- 없어지는 id: 공유 요소 안으로 흡수, 아이콘 먼저 사라짐

**row ↔ tabs 전환은 별도 방식** (`timing.tabMorph`):
1. 전반: row의 버튼·입력창이 모두 흘러가 tabs 컨테이너 모양의 물방울 하나로 합쳐짐 (아이콘은 먼저 사라짐)
2. 후반(약 0.65초, 빠르게): 그 물방울이 tabs 배경이 되고, 안에서 버튼들이 작은 점에서 커지며 나타남 → 아이콘 페이드인

tabs → row는 이 과정을 거꾸로 재생합니다.

전환 속도는 `timing.barMorph`(같은 layout), `timing.tabMorph`(row↔tabs) 구간 길이로 조절합니다.

## 3. CONFIG 수정 방법

### 텍스트
`*...*`로 감싼 부분은 진한 색 + 굵게(strong) 처리됩니다.
```js
text: "필요한 순간에 *화면이 스스로* 다시 구성됩니다.",
```
폰트 기본값은 Samsung Sharp Sans(일반 400 / 강조 700), 크기 85px. 한글을 쓸 때는 `font.family`에서 `'Pretendard'` 같은 한글 폰트가 라틴 폰트 뒤에 있으므로 한글만 그 폰트로 표시됨. 문장은 글자 단위로 써지고, 줄바꿈은 단어 사이에서만 일어납니다. 문장이 길면(약 25단어 이상) `font.size`를 80 정도로 줄입니다.

### 하단 바
```js
bar: { layout: "row",  items: [ {id:"call", kind:"button", icon:"phone"},
                                {id:"ask",  kind:"input",  placeholder:"무엇이든 물어보세요"} ] }
bar: { layout: "tabs", items: [ {id:"a", kind:"button", icon:"mic"}, ... ] }
```
- `row`: 버튼은 고정 크기, `input`은 남은 폭을 채움. input이 없으면 버튼들이 가운데 정렬.
- `tabs`: 버튼들이 가운데 알약 컨테이너 안에 정렬.
- 다음 상태에서도 같은 요소로 보이게 하려면 **같은 id**를 쓰세요. id를 바꾸면 "새로 생김" 애니메이션이 적용됩니다.

### 아이콘 추가
`CONFIG.icons`에 24×24 기준 SVG path를 추가하고 키 이름으로 참조합니다 (Material Symbols 등의 path 그대로 사용 가능).
```js
icons: { heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 ...", ... }
```
`{ d: "path", stroke: 2.1 }`처럼 객체로 쓰면 선(outline) 아이콘으로 그려짐 (기본 chat 아이콘이 이 방식). `"dots:3x4"`처럼 쓰면 점 격자 아이콘(다이얼패드)이 자동 생성됩니다.
기본 제공: `phone, dialpad, chat, mic, camera, plus, search`.

### 헤드 아이콘 (상단 반짝이) — 기본은 꺼짐
`headIcon.enabled: true`로 켜고 `layout.textTop`을 300 정도로 내리면 텍스트 위에 반짝이 아이콘이 나타남.
`headIcon.stars` = 4각 별 목록.
- `x, y, s`: 위치·크기 / `twinkle`: 반짝임 세기(0~1) / `phase`: 반짝임 시작 시점 차이 / `drift`: 천천히 떠다니는 반경 / `spin`: 루프 1바퀴 동안 도는 횟수(90° 단위, 정수)
- `twinklePeriod`: 반짝임 주기(초). 루프 길이를 정확히 나누도록 자동 반올림되어 루프가 끊기지 않음
- `thinkSpin`(90의 배수), `thinkSpread`, `thinkBoost`: 전환할 때의 "생각 중" 동작 세기

### 하단 바 그림자
`bar.shadowColor / shadowOpacity / shadowBlur` — x·y 0, 블러 20의 컬러 그림자. 버튼·입력창이 반투명이라 그림자는 도형 바깥에만 그려지도록 마스킹되어 있음. 배경색을 바꾸면 그림자 색도 배경 하단 색보다 한 톤 진하고 채도 낮은 색으로 맞추세요 (기본 `#c9858f`, 투명도 0.42).

### 배경
상태별 `bg: {top, mid, bottom, split}`. `split`이 클수록 상단 색(민트) 영역이 아래로 깁니다.

### 크기·속도
- `width/height/fps`: 출력 해상도 (기본 1080×2280, 30fps)
- `stateDuration`: 상태 하나의 길이. 문장이 길면 늘리세요 (마지막 단어가 `0.42 + 글자수(공백 포함)×0.011 + 1.15`초에 끝나고, 그 뒤 1초 이상 정지가 보기 좋음)
- `startOffset`: 영상 첫 프레임이 전환 도중이 아니라 정지 상태가 되도록 하는 시작 오프셋
- `timing`: 위 타임라인의 각 구간

## 4. Claude 작업 순서 (권장)
1. 사용자 요청에 맞게 `CONFIG.states`(텍스트·바·배경)와 필요 시 `icons`만 수정. 엔진 코드는 건드리지 않음.
2. `render.py --at`으로 각 상태의 전환 중간(예: 상태 시작 +0.7초)과 정지 시점 스틸을 뽑아 확인: 텍스트 줄바꿈, 아이콘 모양, 바 겹침.
3. 문제 없으면 MP4 1회 렌더. 루프 확인: 마지막 프레임과 첫 프레임이 거의 동일해야 함.

## 5. 주의
- 하단 바 모핑은 ease-in-out(quart, 강한 가감속) 곡선: 천천히 출발 → 빨라짐 → 천천히 멈춤. 상태 길이 기본 3.4초, 하단 전환 1.05초(row↔tabs 1.65초).
- 마지막 단어가 끝나는 시점 = `0.42 + 글자수(공백 포함)×0.011 + 1.15`초. 여기에 1초 이상 정지를 더해 `stateDuration`을 정하세요.
- 모든 움직임은 `renderAt(t)`에서 시간으로 계산됩니다 (CSS transition·랜덤 사용 금지 → 프레임이 정확하고 루프가 끊기지 않음).
- `renderAt`의 `t`는 영상 시간, 내부적으로 `(t + startOffset) % 전체길이`로 순환합니다.
