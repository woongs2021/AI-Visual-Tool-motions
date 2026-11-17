# 사진 합성 도구

캡처한 UI(PNG)를 폰을 든 사진의 화면에 넣는 도구입니다. 원근을 맞추고, 화면의 둥근 모서리를 따라 자르고, 노치·다이내믹 아일랜드와 화면 위에 걸친 손가락은 원래 사진 것을 남깁니다.

```bash
pip install -r tools/composite/requirements.txt        # opencv-python, numpy, pillow
node scripts/capture.mjs --theme=dark --status-bar --main   # → captures/<id>--dark--statusbar@3x.png
```

## 1. 화면이 흰색으로 비어 있는 사진 → `composite_white.py` (자동)
```bash
python3 tools/composite/composite_white.py photo.png captures/meeting-notes--dark--statusbar@3x.png out.png --debug check.png
```
흰 영역을 찾고, 네 변의 직선 구간으로 꼭짓점을 계산합니다. `check.png`를 열어 빨간 사각형(계산된 화면)과 초록 윤곽(흰 영역)이 화면에 맞는지 확인하세요.

## 2. 화면에 이미 다른 UI가 떠 있는 사진 → `inspect_corners.py` + `composite_quad.py`
1. 폰 주변을 확대해서 봅니다. 어두운 부분의 대비를 높이고 좌표 격자를 그려 줍니다.
   ```bash
   python3 tools/composite/inspect_corners.py photo.png --box 1260,330,1920,1320 --out zoom.png
   python3 tools/composite/inspect_corners.py photo.png --box 1450,350,1600,450 --scale 6 --out tl.png   # 모서리 하나 크게
   ```
2. 화면(디스플레이)과 검은 베젤의 경계를 찾습니다. 네 변마다 **직선 구간**에서 점을 2개 이상 읽습니다. 둥근 모서리 부분은 피합니다.
3. 네 직선을 연장해 만나는 점, 즉 **가상의 꼭짓점**을 구합니다. 순서는 왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래입니다.
4. 합성합니다.
   ```bash
   python3 tools/composite/composite_quad.py photo.png captures/pc-health--dark--statusbar@3x.png out.png \
       --quad "849.5,213.6 1058.9,244.2 947.7,723.9 732.6,677.3" --cutout notch --blur 0.55 --debug check.png
   ```
   | 옵션 | 의미 |
   |---|---|
   | `--cutout notch \| island \| none` | 노치 폰(iPhone X–14) / 다이내믹 아일랜드(14 Pro 이후) / 없음 |
   | `--radius 39` | 화면 모서리 반경(pt). 최신 폰은 47–55 |
   | `--blur 0.6` | 사진이 흐린 만큼 UI도 부드럽게 (0 = 끄기) |
   | `--dim 0.94` · `--grain 1.6` | 밝기, 노이즈를 사진에 맞춤 |
   | `--no-skin` | 손가락 보존을 끔 (화면에 걸친 손가락이 없을 때) |
5. 결과를 확대해서 확인합니다. 가장자리에 예전 UI가 보이면 그쪽 꼭짓점을 1–2px 바깥으로, 베젤이 덮였으면 안쪽으로 옮깁니다.

## 참고
- 결과는 원본 사진과 같은 해상도로 저장됩니다. 폰이 작게 찍힌 사진은 화면 글씨도 작습니다. 필요하면 업스케일을 따로 하세요.
- 손가락은 "붉은 기가 있고 화면 밖에서 이어져 들어온 영역"으로 판단합니다. 화면 안에만 있는 피부색(예전 UI의 아바타 사진 등)은 손가락으로 보지 않고 교체합니다.
