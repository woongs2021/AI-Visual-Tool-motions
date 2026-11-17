# 05 · 스마트폰 사진에 UI 합성

> 폰을 든 사진에 캡처한 화면을 넣을 때 씁니다. 도구는 `tools/composite/`에 있고 Python 3, OpenCV, NumPy, Pillow가 필요합니다.

---

## [입력]
| 사진 | 넣을 화면 | 사진 속 화면 상태 |
|---|---|---|
| `photos/meeting.png` | meeting-notes (dark, 상태바) | 흰색 빈 화면 |
| `photos/couple.webp` | our-discussion (dark, 상태바) | 다른 UI가 이미 떠 있음 |
| `photos/pc.png` | pc-health (dark, 상태바) | 다른 UI가 이미 떠 있음 |

## [지시]
`tools/composite/README.md`의 방법대로 합성하세요.

1. 필요한 PNG를 먼저 캡처합니다. 형식은 `node scripts/capture.mjs --theme=dark --status-bar --main --app=…`이고, 결과는 `captures/<id>--dark--statusbar@3x.png`입니다.
2. 사진 속 화면이 **흰색 빈 화면**이면 자동 방식을 씁니다.
   `python3 tools/composite/composite_white.py <사진> <캡처 PNG> <결과 PNG> --debug <확인용 PNG>`
   - 흰 영역을 찾아 네 변을 맞추고, 손가락·베젤·다이내믹 아일랜드는 사진 것을 남깁니다.
   - 확인용 PNG의 빨간 사각형이 화면 네 변에 맞는지 확인합니다.
3. 사진 속 화면에 **이미 다른 UI가 있으면** 모서리를 측정하는 방식을 씁니다.
   1. `python3 tools/composite/inspect_corners.py <사진> --box x0,y0,x1,y1 --out zoom.png`로 폰 주변을 대비를 높여 확대합니다. 격자 좌표가 표시됩니다.
   2. 확대 이미지를 보고 화면(디스플레이)과 검은 베젤의 경계를 찾습니다. 네 변 각각에서 직선 구간의 점을 2개 이상 읽고, 직선을 연장해 교차하는 **가상의 꼭짓점**을 구합니다. 모서리는 둥글기 때문에 꼭짓점이 실제 화면 밖에 찍힙니다.
   3. `python3 tools/composite/composite_quad.py <사진> <캡처 PNG> <결과 PNG> --quad "x,y x,y x,y x,y" --cutout notch|island|none`
      - 꼭짓점 순서는 왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래입니다.
      - 노치 폰은 `notch`, 다이내믹 아일랜드 폰은 `island`를 씁니다.
      - 사진이 흐리면 `--blur 0.5~0.8`, 어두우면 `--dim 0.9`로 맞춥니다.
4. 결과를 확대해서 확인합니다.
   - 가장자리에 예전 UI나 흰색이 남았는지 봅니다.
   - 손가락이 화면 위에 자연스럽게 남았는지 봅니다. 피부색이 비슷한 아바타 사진 같은 것이 손가락으로 잘못 남지 않았는지도 확인합니다.
   - 노치나 아일랜드 위치가 사진과 맞는지 봅니다.
   - 문제가 있으면 꼭짓점을 1–2px씩 조정해 다시 돌립니다.
5. 결과는 원본 사진 해상도 그대로 `composites/`에 저장하고 경로를 보고합니다.
