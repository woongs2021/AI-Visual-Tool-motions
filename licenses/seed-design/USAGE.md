# SEED Design 사용 내역

이 저장소의 일부 UI는 [SEED Design](https://seed-design.io)(© 주식회사 당근마켓, Apache License 2.0)을 따릅니다.
같은 폴더의 `LICENSE`, `NOTICE`는 `@seed-design/css` 3.1.0 패키지에 들어 있는 원본입니다.

## 사용한 것

SEED의 코드(CSS, React 컴포넌트)는 포함하지 않았습니다. 다음 값과 스펙만 참고해서 다시 구현했습니다.

- **파운데이션 토큰 값**(`@seed-design/css` 3.1.0, 라이트 테마)
  - 색 역할(fg / bg / stroke), 타이포 스케일(t1~t6), 간격(global gutter 16, component 12)
  - 라운드(r1, r2.5, r3, r4), 그림자(s1, s2), 시스템 폰트 스택, `$gradient.fade-mask`
- **컴포넌트 스펙**: App Bar, Chip, Badge, Action Button, List Item, Identity Placeholder의 크기·여백·색·글자
- **글쓰기 원칙**: 해요체, 익숙한 말, 제목·버튼·라벨에는 마침표 없음

## 적용한 곳

- **`index.html` 전체 비교 뷰 ② 앱 적용 화면**(`SEED`, `drawAppBg`)
  - 캔버스에 그려서 영상 내보내기에도 같이 담깁니다.
- **에이전트 볼이 만드는 리스트**(`ROWS`, `ROW_LOOK`, `rowStyles`, `drawItems2D`)
- **생성되는 Kotlin 코드**(`android/AiVisualCue.kt`)
  - `cueItems`, `CueComponents`, `CUE_ICON_PATHS`

## 바꾼 점

- 화면 배경은 SEED의 레이어 색 대신, 이 툴의 화면 배경 그라디언트(Design 탭 → 컬러 → 화면 배경)를 씁니다.
- 카드와 리스트 아이템은 SEED의 흰 레이어(layer-floating) 대신 유리입니다. 화면 배경에 묻히도록 흰색 60%에 배경 블러 16dp, 세트의 에이전트 컬러 그라디언트를 옅게 깔고 얇은 흰 테두리를 둡니다. 그 위의 버튼과 아이콘 박스는 SEED의 neutral-weak-alpha, 설명 글자는 neutral-muted입니다.
- 하단 입력은 SEED의 입력창 대신 이 툴의 Adaptive Screen 플로팅 바(물방울처럼 갈라지고 합쳐지는 유리 바)를 씁니다. 그 안의 아이콘과 플레이스홀더 글자(t5, fg.placeholder)만 SEED를 따릅니다.
- 에이전트가 생각하는 동안(로딩) 앱 화면 전체를 블러로 흐리게 하는 것은 SEED가 아니라 이 툴의 큐 적용 사례에서 온 표현입니다.
- 전체 화면에서 리스트 위에 나오는 에이전트의 말은 SEED의 글자 스타일이 아니라 큐 적용 사례(Adaptive Screen) 문장의 글꼴 · 색 · 굵게 강조를 씁니다. 리스트 아이템은 그대로 SEED 스펙입니다.
- 아이콘은 SEED 아이콘 라이브러리가 아니라, SEED 아이콘처럼 그린 단순한 선 아이콘입니다.
- 화면의 문구는 모두 새로 썼습니다.

## 쓰지 않은 것

당근마켓의 브랜드 리소스(로고, 상호, 캐릭터 등)는 쓰지 않았습니다. 당근마켓의 제품이나 서비스로 보이게 하는 내용도 넣지 않았습니다.
