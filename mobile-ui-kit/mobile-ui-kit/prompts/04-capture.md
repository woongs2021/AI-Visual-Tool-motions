# 04 · 캡처 (사진 합성용 PNG)

> PNG만 필요할 때 씁니다.

---

## [지시]
아래 앱들의 대표 화면을 **사진 합성용**으로 캡처하세요.

- 대상: `pc-health, meeting-notes, our-discussion` (또는 `전체`)
- 테마: `dark` (`light` / `both`)
- 상태바: 켬 (실제 폰처럼 9:41 · 신호 · 배터리)
- 상태: 기본 상태만 (`--main`) / 모든 상태

```bash
npm install && npx playwright install chromium        # 처음 한 번
node scripts/capture.mjs --theme=dark --status-bar --main --app=pc-health,meeting-notes,our-discussion
```

결과 PNG를 모두 열어 확인하고 경로를 목록으로 보고하세요. 확인할 것은 다음과 같습니다.
- 애니메이션 중간 프레임이나 빈 데이터가 찍히지 않았는지 확인합니다. `capture=1`이면 상태가 고정됩니다.
- 기본 상태가 스크롤 없이 화면에 다 보이는지 확인합니다.
- 1170 × 2532, 모서리 직각, 기기 프레임 없음이 맞는지 확인합니다.

## 브라우저로 직접 캡처
`<id>.html?ui=1&capture=1&theme=dark&statusbar=1`를 엽니다. DevTools → Toggle device toolbar에서 390 × 844, DPR 3으로 맞추고 ⋮ → Capture screenshot을 누릅니다.
