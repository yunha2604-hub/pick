# 오늘의 운세 뽑기 — 기술/비주얼 설계 문서 (DESIGN.md)

> 대상 독자: 이 문서를 코드로 그대로 옮길 "게임 전문가"(구현 담당자).
> 목표: 서버/빌드도구 없는 정적 HTML/CSS/JS MVP. 레트로 픽셀(Y2K) + 문방구 뽑기 기계 감성.
> 원본 기획: `plan.md`, 콘텐츠: `content/fortunes.json` (완성되어 있음, 구조 변경 없이 그대로 사용).

---

## 0. 콘텐츠 데이터 흐름 결정 (중요)

`content/fortunes.json`에는 `ui`(문구), `fortunes`(운세 20개), `luckyColors/Foods/Actions`(각 10개)가 들어있다. MVP 단순화를 위해 아래처럼 역할을 나눈다.

- **`ui` 필드는 HTML에 직접 하드코딩**한다. (자주 안 바뀌는 정적 문구라 fetch 대상에서 제외해 로직을 단순화)
- **`fortunes`, `luckyColors`, `luckyFoods`, `luckyActions` 배열만 `fetch()`로 런타임에 읽어와** 랜덤 추첨 로직에 사용한다.

**⚠️ file:// 주의사항**: 브라우저에서 `index.html`을 더블클릭해 `file://`로 직접 열면 `fetch('content/fortunes.json')`이 CORS 정책에 막혀 실패하는 브라우저(Chrome 등)가 있다. 구현/테스트 시 반드시 로컬 정적 서버로 열 것을 권장한다.
  - 예: `npx serve .`, `python -m http.server 8000`, VS Code "Live Server" 확장.
- 만약 서버 없이 `file://` 더블클릭 배포가 필수 요건이라면, 대안으로 `content/fortunes.json`과 **동일한 내용**을 `content/fortunes-data.js`에 `window.FORTUNES_DATA = {...}` 형태로 복제하고 `<script>` 태그로 로드하는 방식으로 전환한다. (fetch 대신 전역 변수 참조) 이 문서의 기본 스펙은 **fetch 방식**을 기준으로 하되, 이 대안을 fallback으로 명시해둔다.

---

## 1. 파일 구조

```
index.html            # 문서 구조(마크업)만 담당. 인라인 style/script 없음(폰트 preconnect/link, 최하단 script src 태그 제외)
css/style.css         # 전체 시각 스타일: 색상, 폰트, 레이아웃, 반응형, 애니메이션 keyframes
js/main.js            # 전체 동작 로직: fortunes.json fetch, 랜덤 추첨, 클릭 이벤트, 애니메이션 클래스 토글, DOM 업데이트
content/fortunes.json # 콘텐츠 데이터 (기존 파일, 수정 없음)
```

역할 경계 원칙: **HTML은 구조, CSS는 표현, JS는 동작**만 담당한다. JS에서 `style.xxx` 직접 조작 금지 — 상태 변화는 전부 `classList.add/remove/toggle`로 처리하고 실제 시각 효과는 CSS 쪽에서 정의한다 (예: `.card.is-shuffling`, `.card.is-flipped`, `.result-area.is-visible`).

### index.html 섹션 구성 (id/class 제안)
```
.page-wrap
  header.title-area           (h1#title, p#subtitle)
  main
    section.gacha-area
      .gacha-machine           (CSS로 그리는 뽑기 기계 프레임, 장식용)
        .card#fortuneCard      (tabindex="0", role="button")
          .card-inner
            .card-face.card-front   ("?" 물음표 캡슐면)
            .card-face.card-back    (운세 결과면, 처음엔 rotateY(180deg) 상태로 숨김)
      .once-notice             (onceNotice + onceNoticeCaption, 버튼 바로 위)
      button#drawBtn.draw-btn  (drawButtonLabel)
    section#resultArea.result-area[aria-live="polite"][hidden]
      .result-emoji
      h2#resultHeading
      p#resultText
      .lucky-badge#luckyBadge
      button#retryBtn.retry-btn[hidden] (retryButtonLabel)
```

---

## 2. 컬러 팔레트

파스텔 배경 + 비비드 포인트 조합. 모든 값은 CSS 변수로 `:root`에 선언.

```css
:root {
  /* 배경 (파스텔) */
  --bg-top: #FFE9F3;        /* 연핑크 */
  --bg-bottom: #DFF6FF;     /* 연하늘 */
  --bg-gradient: linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);

  /* 서피스 */
  --surface-white: #FFFFFF;

  /* 텍스트 */
  --text-primary: #3A2E5C;   /* 딥 퍼플 네이비 - 본문/제목 */
  --text-secondary: #7A7290; /* 뮤트 퍼플그레이 - 보조문구 */

  /* 비비드 포인트 */
  --accent-pink: #FF5FA2;    /* 메인 버튼/포인트 */
  --accent-pink-hover: #FF3D8F;
  --accent-purple: #7B61FF;  /* 서브 포인트, 캡슐 장식 */
  --accent-yellow: #FFD93D;  /* 반짝이 별/장식 */
  --accent-mint: #4DE1C1;    /* good 톤 보조 */

  /* 카드 프레임/그림자 */
  --outline-dark: #3A2E5C;   /* 픽셀 테두리, 하드 그림자 색 */

  /* 캡슐(카드 앞면) 그라디언트 */
  --capsule-top: #FFD1E8;
  --capsule-bottom: #FF8FC7;

  /* 운세 tone 별 색상 */
  --tone-good-bg: #FFF3B0;
  --tone-good-accent: #FFB800;
  --tone-neutral-bg: #DCEBFF;
  --tone-neutral-accent: #6FA8FF;
  --tone-bad-bg: #FFD6D6;
  --tone-bad-accent: #FF6B6B;
  --tone-bad-strong: #D6336C; /* '조심 문구' 강조색 */
}
```

버튼:
- 기본: `background: var(--accent-pink); color: #FFFFFF; border: 3px solid var(--outline-dark); box-shadow: 4px 4px 0 var(--outline-dark);`
- hover/active: `background: var(--accent-pink-hover); transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--outline-dark);` (눌리는 느낌)
- disabled(애니메이션 중): `opacity: .6; pointer-events: none;`

---

## 3. 폰트 (한글 지원 무료 픽셀 폰트)

**갤무리(Galmuri)** 사용 — SIL OFL 1.1 라이선스, 상업적 이용 무료, 한글/영문/숫자 지원 도트 폰트. GitHub: `quiple/galmuri`, npm 패키지: `galmuri`.

### 로드 방식 — jsDelivr CDN (self-host 불필요, 접근 확인 완료)

```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/galmuri@latest/dist/galmuri.css">
```

- 위 URL은 실제 존재하며 `@font-face`(Galmuri14/11/11-Bold/11-Condensed/9/7, GalmuriMono 계열)를 `woff2`/`ttf`로 제공하는 것을 확인했다 (2026-07-05 기준 접근 검증됨).
- **배포 전 권장**: `@latest` 대신 특정 버전으로 고정할 것. https://www.jsdelivr.com/package/npm/galmuri 에서 최신 버전 번호를 확인 후 `galmuri@X.Y.Z/dist/galmuri.css` 형태로 고정한다 (CDN 캐시/버전 변경으로 인한 예기치 않은 폰트 변경 방지).

### Self-host 대안 (CDN 접근 불가 환경 대비)
1. https://github.com/quiple/galmuri/tree/master/dist 에서 `Galmuri11.woff2`, `Galmuri14.woff2`, `Galmuri9.woff2` 등 필요한 파일만 다운로드.
2. `assets/fonts/` 폴더에 저장.
3. `css/style.css` 최상단에 동일한 `@font-face` 규칙을 상대경로로 재선언.

### 사용 규칙
```css
:root {
  --font-pixel-lg: 'Galmuri14', 'Galmuri11', monospace;  /* 큰 타이틀 */
  --font-pixel: 'Galmuri11', monospace;                   /* 본문/버튼 */
  --font-pixel-sm: 'Galmuri9', monospace;                 /* 보조문구/뱃지 */
}
html { font-family: var(--font-pixel); }
```
- 폰트 로드 실패 대비 fallback: `monospace` (도트 느낌 최소 유지).
- 도트 폰트 특성상 브라우저 기본 앤티에일리어싱으로 흐려질 수 있으므로 `image-rendering: pixelated;`를 텍스트에는 적용하지 않되(효과 없음), 대신 `-webkit-font-smoothing: none; font-smooth: never;`를 `body`에 적용해 최대한 각지게 렌더링되도록 한다.

---

## 4. 레이아웃

**모바일 퍼스트**, 컨테이너 `max-width`를 좁게 고정해 데스크톱에서도 "모바일 앱을 가운데 놓고 보는" 느낌 유지.

```css
.page-wrap {
  max-width: 420px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 24px 16px 40px;
  background: var(--bg-gradient);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

@media (min-width: 600px) {
  .page-wrap { max-width: 480px; padding: 40px 24px 56px; }
}
```

브레이크포인트는 **1개만** 사용한다 (MVP 범위 최소화): `600px` 기준 mobile → desktop(centered card) 전환.

| 요소 | 모바일 (~599px) | 데스크톱 (≥600px) |
|---|---|---|
| 컨테이너 max-width | 420px | 480px |
| h1 타이틀 | 24px | 28px |
| subtitle | 13px | 14px |
| 카드(.card) | 200 × 260px | 240 × 300px |
| 버튼 | width: 100%, max-width 220px, padding 14px 0 | padding 14px 40px |

레이아웃 순서(세로 flex, 위→아래): 타이틀 영역 → 뽑기 기계(카드) 영역 → once-notice → 버튼 → (뽑은 후) 결과 카드 영역. 결과 영역은 `[hidden]` 속성으로 시작, 결과 표시 시 JS가 `hidden` 제거.

---

## 5. 뽑기 카드 컴포넌트 스펙

### 공통 원칙
- `border-radius: 0` (카드 몸체, 버튼, 뱃지 등 주요 UI 박스는 각짐 유지). 예외적으로 장식용 "캡슐 구슬" 표현에만 `border-radius: 50%` 허용.
- 픽셀 테두리 기법: **얇은 테두리 + 이중 box-shadow 스택**으로 8bit 느낌의 계단식 테두리 재현.
- 모든 그림자는 **blur 없이 hard offset**만 사용 (`0 blur-radius` 고정). 이것이 픽셀아트 그림자의 핵심.

### 카드 마크업/구조
```html
<div class="card" id="fortuneCard" tabindex="0" role="button" aria-label="운세 뽑기 카드">
  <div class="card-inner">
    <div class="card-face card-front">…</div>
    <div class="card-face card-back">…</div>
  </div>
</div>
```

### CSS
```css
.card {
  width: 200px; height: 260px;
  perspective: 800px;
  cursor: pointer;
}
@media (min-width: 600px) { .card { width: 240px; height: 300px; } }

.card-inner {
  position: relative;
  width: 100%; height: 100%;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-style: preserve-3d;
}
.card.is-flipped .card-inner { transform: rotateY(180deg); }

.card-face {
  position: absolute; inset: 0;
  border-radius: 0;
  border: 4px solid var(--outline-dark);
  box-shadow:
    0 0 0 3px var(--surface-white),   /* 안쪽 흰색 라인 */
    0 0 0 6px var(--outline-dark),    /* 바깥 이중 테두리 */
    6px 6px 0 0 rgba(58, 46, 92, 0.35); /* 하드 드롭섀도우, blur 0 */
  backface-visibility: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 16px;
  text-align: center;
}

.card-front {
  background: linear-gradient(180deg, var(--capsule-top) 0%, var(--capsule-bottom) 100%);
}
.card-front::after { /* 캡슐 이음새 라인 */
  content: "";
  position: absolute; left: 0; right: 0; top: 48%;
  height: 4px; background: var(--outline-dark); opacity: .25;
}
.card-front .card-mark {
  font-family: var(--font-pixel-lg);
  font-size: 64px;
  color: var(--surface-white);
  text-shadow: 4px 4px 0 var(--outline-dark); /* 픽셀 아웃라인 텍스트 */
}

.card-back {
  transform: rotateY(180deg);
  background: var(--tone-neutral-bg); /* JS가 tone에 따라 인라인 CSS 변수 --tone-current-bg로 override, 4.1절 참고 */
}
```

- **카드 앞면**: 캡슐 그라디언트 배경 + 중앙 큰 `?` (Galmuri14, 64px, 흰색 + 픽셀 그림자) + 이음새 라인. 이미지 파일 없이 순수 CSS.
- **카드 뒷면**: tone 색상 배경(6절 참고), 이모지 + 결과 텍스트 + 행운템 뱃지.

---

## 6. 애니메이션 스펙

클릭 시퀀스: **셔플(600ms) → 플립(400ms) → 결과 페이드인(300ms) → 재도전 버튼 노출**. 총 소요 약 1300ms.

| 시점(ms) | 단계 | 지속시간 | Easing | 동작 |
|---|---|---|---|---|
| 0 | 클릭, 셔플 시작 | 600ms | 각진 keyframe (ease-in-out) | `.card`에 `is-shuffling` 클래스 추가, 좌우 흔들림 + 미세 회전. 버튼/카드 `pointer-events: none`으로 중복 클릭 방지 |
| 600 | 셔플 종료, 플립 시작 | 400ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` (스프링, 톡 튀는 느낌) | `is-shuffling` 제거, `is-flipped` 추가 → `.card-inner`가 `rotateY(0→180deg)` |
| 1000 | 플립 종료, 결과 패널 표시 | 300ms | `ease-out` | `#resultArea`의 `hidden` 해제 + `is-visible` 클래스로 `fadeInUp` 실행 |
| 1300 | 재도전 버튼 노출 | 즉시(또는 150ms fade) | `ease-out` | `#retryBtn`의 `hidden` 해제 |

### 셔플 keyframe
```css
@keyframes shuffle {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  15%  { transform: translateX(-8px) rotate(-4deg); }
  30%  { transform: translateX(8px)  rotate(4deg); }
  45%  { transform: translateX(-6px) rotate(-3deg); }
  60%  { transform: translateX(6px)  rotate(3deg); }
  75%  { transform: translateX(-3px) rotate(-2deg); }
  90%  { transform: translateX(3px)  rotate(1deg); }
}
.card.is-shuffling { animation: shuffle 0.6s ease-in-out 1; }
```

### 플립
```css
.card-inner { transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.card.is-flipped .card-inner { transform: rotateY(180deg); }
```
`.card-front`, `.card-back` 모두 `backface-visibility: hidden;` 필수 (5절 CSS에 포함됨).

### 결과 페이드인
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.result-area.is-visible { animation: fadeInUp 0.3s ease-out forwards; }
```

### JS 타이밍 제어 (main.js 구현 지침)
- `setTimeout` 체인 또는 `animationend`/`transitionend` 이벤트 리스너로 단계 전환. MVP 단순성을 위해 `setTimeout` 체인 권장 (600ms → 400ms → 300ms).
- 재도전 시: `.card`에서 `is-flipped` 제거(다시 앞면으로, 이때는 transition 없이 즉시 리셋하거나 200ms로 되돌린 뒤) → `is-shuffling` 다시 추가 → 동일 시퀀스 반복.
- **접근성**: `@media (prefers-reduced-motion: reduce)`에서는 `shuffle`/`fadeInUp` 애니메이션과 플립 `transition-duration`을 `0.01ms`로 단축.

---

## 7. 결과 화면 표시 규칙

### tone별 카드 색상 / 이모지
| tone | 카드 배경 (`--tone-*-bg`) | 강조색 (`--tone-*-accent`) | 이모지 | 비고 |
|---|---|---|---|---|
| good | `#FFF3B0` | `#FFB800` | 🍀 / ✨ / 🎉 | 밝고 신나는 톤 |
| neutral | `#DCEBFF` | `#6FA8FF` | 🙂 / ☁️ | 잔잔, 담담 |
| bad | `#FFD6D6` | `#FF6B6B` | 🌦️ / 🙏 | 겁주는 이모지(💀 등) 금지, 다정한 조언 톤 유지 |

JS 구현: `card-back`에 `data-tone="good|neutral|bad"` 속성을 설정하고, CSS에서
```css
.card-back[data-tone="good"]    { background: var(--tone-good-bg); border-color: var(--tone-good-accent); }
.card-back[data-tone="neutral"] { background: var(--tone-neutral-bg); border-color: var(--tone-neutral-accent); }
.card-back[data-tone="bad"]     { background: var(--tone-bad-bg); border-color: var(--tone-bad-accent); }
```
이모지는 `.result-emoji` 텍스트 콘텐츠를 tone별 후보 배열에서 랜덤 1개 선택해 JS로 삽입 (`textContent`).

### bad 톤 조언 문구 강조
`fortunes.json`의 bad 항목은 항상 마지막 줄이 "~만 조심하면 행운이 나와요!" 형태다. 텍스트를 `\n` 기준으로 split한 뒤, **마지막 줄만 `<strong class="advice-highlight">`로 감싸** 굵게 + `--tone-bad-strong (#D6336C)` 색으로 표시한다. 앞에 `💡 ` 아이콘 접두.

```css
.advice-highlight { color: var(--tone-bad-strong); font-weight: bold; }
```

### 행운템 뱃지 (하단)
`luckyColors` / `luckyFoods` / `luckyActions` 중 **카테고리를 먼저 랜덤 선택**, 그 안에서 항목 1개를 랜덤 선택. `resultFooterLabel`("오늘의 행운템") + 아이콘 + 항목 텍스트로 표시.

카테고리별 아이콘: 색상 🎨 / 음식 🍬 / 행동 ✅

```css
.lucky-badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--surface-white);
  border: 3px solid var(--text-primary);
  border-radius: 999px; /* 카드류만 각지고, 뱃지는 알약형으로 변주 */
  padding: 8px 16px;
  font-family: var(--font-pixel-sm);
  font-size: 13px;
  box-shadow: 3px 3px 0 var(--text-primary);
  margin-top: 12px;
}
```
표시 형식 예: `오늘의 행운템 🎨 딸기우유색` / `오늘의 행운템 🍬 마카롱` / `오늘의 행운템 ✅ 거울 보고 씨익 웃기`

---

## 8. 에셋 방침 (이미지 파일 없이 픽셀아트 구현)

MVP 범위상 이미지 파일 제작/다운로드가 불가하므로, **CSS + 이모지(유니코드)만으로** 모든 비주얼을 구현한다.

1. **테두리/그림자**: `border` + 다중 `box-shadow`(blur 0, hard offset)로 8bit 스타일 이중 테두리와 드롭섀도우 재현 (5절 참고).
2. **텍스트 픽셀 아웃라인**: `text-shadow`도 blur 없이 hard offset만 사용 (`2px 2px 0 색상`).
3. **캡슐/기계 장식**: `linear-gradient`/`radial-gradient`로 카드 앞면 캡슐 광택, `.gacha-machine` 뽑기 기계 프레임(둥근 유리 돔 = `radial-gradient` 원, 몸체 = 사각 박스, 다리 = `::before/::after` 작은 사각형)을 div/가상요소 조합으로 구성.
4. **이모지 = 스프라이트**: 🍀✨🙂☁️🌦️🎉🎨🍬✅ 등 유니코드 이모지를 `font-size`로 크기 조절해 아이콘처럼 사용. 다운로드 불필요, 폰트 렌더 엔진이 알아서 표시.
5. **반짝임 효과**: `::before/::after` + `clip-path: polygon(...)`로 별 모양 만들거나, 간단히 `✨` 이모지를 `position: absolute`로 카드 모서리에 배치 후 `twinkle` keyframe(`opacity`/`scale` 오가는 애니메이션)으로 반짝이는 느낌 부여.
   ```css
   @keyframes twinkle {
     0%, 100% { opacity: .3; transform: scale(0.8); }
     50%      { opacity: 1;  transform: scale(1.1); }
   }
   ```
6. **배경 텍스처(선택)**: `repeating-conic-gradient` 등으로 은은한 격자 무늬를 배경에 깔아 Y2K 느낌을 강화할 수 있음(옵션, 필수 아님).
7. 유일한 외부 리소스는 **웹폰트(Galmuri, jsDelivr CDN)** 뿐이며, 이는 이미지 에셋이 아닌 폰트 파일이므로 "이미지 파일 없음" 원칙에 위배되지 않는다.

---

## 핵심 CSS 변수 요약 (구현 시작점)

```css
:root {
  --bg-top:#FFE9F3; --bg-bottom:#DFF6FF;
  --text-primary:#3A2E5C; --text-secondary:#7A7290;
  --accent-pink:#FF5FA2; --accent-pink-hover:#FF3D8F;
  --accent-purple:#7B61FF; --accent-yellow:#FFD93D; --accent-mint:#4DE1C1;
  --outline-dark:#3A2E5C;
  --capsule-top:#FFD1E8; --capsule-bottom:#FF8FC7;
  --tone-good-bg:#FFF3B0; --tone-good-accent:#FFB800;
  --tone-neutral-bg:#DCEBFF; --tone-neutral-accent:#6FA8FF;
  --tone-bad-bg:#FFD6D6; --tone-bad-accent:#FF6B6B; --tone-bad-strong:#D6336C;
  --font-pixel-lg:'Galmuri14','Galmuri11',monospace;
  --font-pixel:'Galmuri11',monospace;
  --font-pixel-sm:'Galmuri9',monospace;
}
```
