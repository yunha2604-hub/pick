/* =========================================================
   오늘의 운세 뽑기 — main.js
   역할: content/fortunes.json fetch, 랜덤 추첨, 클릭 이벤트,
         애니메이션 클래스 토글, DOM 텍스트/속성 업데이트.
   원칙: style.xxx 직접 조작 금지. 상태 변화는 classList로만 처리.
   ========================================================= */
(function () {
  'use strict';

  var RESULT_FOOTER_LABEL = '오늘의 행운템';

  var TONE_EMOJI = {
    good: ['🍀', '✨', '🎉'],
    neutral: ['🙂', '☁️'],
    bad: ['🌦️', '🙏']
  };

  var CATEGORY_META = {
    luckyColors: { icon: '🎨' },
    luckyFoods: { icon: '🍬' },
    luckyActions: { icon: '✅' }
  };

  var TIMING = {
    SHUFFLE_MS: 600,
    FLIP_MS: 400,
    FADE_MS: 300
  };

  // DOM refs
  var fortuneCard = document.getElementById('fortuneCard');
  var cardBack = document.getElementById('cardBack');
  var cardBackEmoji = document.getElementById('resultEmoji');
  var cardBackText = document.getElementById('cardBackText');
  var luckyBadgeCard = document.getElementById('luckyBadgeCard');
  var drawBtn = document.getElementById('drawBtn');
  var resultArea = document.getElementById('resultArea');
  var resultAreaEmoji = document.getElementById('resultAreaEmoji');
  var resultText = document.getElementById('resultText');
  var resultHeading = document.getElementById('resultHeading');
  var luckyBadge = document.getElementById('luckyBadge');
  var retryBtn = document.getElementById('retryBtn');
  var errorNotice = document.getElementById('errorNotice');

  var birthForm = document.getElementById('birthForm');
  var birthYearSelect = document.getElementById('birthYear');
  var birthMonthSelect = document.getElementById('birthMonth');
  var birthDaySelect = document.getElementById('birthDay');
  var birthError = document.getElementById('birthError');
  var birthSubmitBtn = document.getElementById('birthSubmitBtn');
  var gachaArea = document.getElementById('gachaArea');
  var birthTag = document.getElementById('birthTag');
  var birthChangeBtn = document.getElementById('birthChangeBtn');

  var RESULT_HEADING_DEFAULT = resultHeading.textContent;

  var data = null; // { fortunes, luckyColors, luckyFoods, luckyActions }
  var isBusy = false;
  var timers = [];
  var birthDate = null; // { year, month, day }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // ---- 생년월일 입력 폼 ----
  function populateBirthSelects() {
    var currentYear = new Date().getFullYear();
    for (var y = currentYear; y >= currentYear - 100; y--) {
      var yOpt = document.createElement('option');
      yOpt.value = String(y);
      yOpt.textContent = y + '년';
      birthYearSelect.appendChild(yOpt);
    }
    for (var m = 1; m <= 12; m++) {
      var mOpt = document.createElement('option');
      mOpt.value = String(m);
      mOpt.textContent = m + '월';
      birthMonthSelect.appendChild(mOpt);
    }
    refreshDayOptions();
  }

  function refreshDayOptions() {
    var prevValue = birthDaySelect.value;
    var year = Number(birthYearSelect.value) || new Date().getFullYear();
    var month = Number(birthMonthSelect.value) || 1;
    var total = daysInMonth(year, month);

    birthDaySelect.innerHTML = '<option value="" disabled selected>일</option>';
    for (var d = 1; d <= total; d++) {
      var dOpt = document.createElement('option');
      dOpt.value = String(d);
      dOpt.textContent = d + '일';
      birthDaySelect.appendChild(dOpt);
    }
    if (prevValue && Number(prevValue) <= total) {
      birthDaySelect.value = prevValue;
    }
  }

  function handleBirthSubmit() {
    var year = birthYearSelect.value;
    var month = birthMonthSelect.value;
    var day = birthDaySelect.value;

    if (!year || !month || !day) {
      birthError.removeAttribute('hidden');
      return;
    }
    birthError.setAttribute('hidden', '');

    birthDate = { year: Number(year), month: Number(month), day: Number(day) };
    birthTag.textContent = birthDate.year + '.' + pad2(birthDate.month) + '.' + pad2(birthDate.day) + '생';
    resultHeading.textContent = birthDate.year + '.' + pad2(birthDate.month) + '.' + pad2(birthDate.day) +
      '생님의 ' + RESULT_HEADING_DEFAULT;

    birthForm.setAttribute('hidden', '');
    gachaArea.removeAttribute('hidden');
  }

  function handleBirthChange() {
    resetForNewDraw();
    setControlsDisabled(false);
    isBusy = false;
    gachaArea.setAttribute('hidden', '');
    birthForm.removeAttribute('hidden');
  }

  // ---- 생년월일 기반 시드 난수 (같은 생년월일 + 같은 날짜 -> 같은 결과) ----
  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) | 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getTodayString() {
    var now = new Date();
    return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
  }

  function createDailyRng() {
    var seedStr = birthDate.year + '-' + pad2(birthDate.month) + '-' + pad2(birthDate.day) +
      '|' + getTodayString();
    return mulberry32(hashSeed(seedStr));
  }

  function pickWithRng(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function clearTimers() {
    timers.forEach(function (t) { clearTimeout(t); });
    timers = [];
  }

  function setControlsDisabled(disabled) {
    if (disabled) {
      drawBtn.setAttribute('disabled', 'disabled');
      fortuneCard.classList.add('is-busy');
    } else {
      drawBtn.removeAttribute('disabled');
      fortuneCard.classList.remove('is-busy');
    }
  }

  // 행운템: 카테고리 먼저 랜덤 선택 -> 그 안에서 항목 1개 랜덤 선택
  function pickLuckyItem(rng) {
    var categories = ['luckyColors', 'luckyFoods', 'luckyActions'];
    var category = pickWithRng(categories, rng);
    var item = pickWithRng(data[category], rng);
    var icon = CATEGORY_META[category].icon;
    return {
      category: category,
      icon: icon,
      item: item,
      label: RESULT_FOOTER_LABEL + ' ' + icon + ' ' + item
    };
  }

  function buildFortuneHTML(fortune) {
    var lines = fortune.text.split('\n');
    if (fortune.tone === 'bad' && lines.length > 0) {
      var lastIndex = lines.length - 1;
      var htmlLines = lines.map(function (line, idx) {
        var escaped = escapeHTML(line);
        if (idx === lastIndex) {
          return '<strong class="advice-highlight">💡 ' + escaped + '</strong>';
        }
        return escaped;
      });
      return htmlLines.join('\n');
    }
    return escapeHTML(fortune.text);
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function drawResult() {
    var rng = createDailyRng();
    var fortune = pickWithRng(data.fortunes, rng);
    var lucky = pickLuckyItem(rng);
    var emoji = pickWithRng(TONE_EMOJI[fortune.tone] || TONE_EMOJI.neutral, rng);
    var html = buildFortuneHTML(fortune);

    // 카드 뒷면
    cardBack.setAttribute('data-tone', fortune.tone);
    cardBackEmoji.textContent = emoji;
    cardBackText.innerHTML = html;
    luckyBadgeCard.textContent = lucky.label;

    // 결과 영역 (카드 뒷면과 동일 내용)
    resultAreaEmoji.textContent = emoji;
    resultText.innerHTML = html;
    luckyBadge.textContent = lucky.label;
  }

  function resetForNewDraw() {
    resultArea.classList.remove('is-visible');
    resultArea.setAttribute('hidden', '');
    retryBtn.setAttribute('hidden', '');
    fortuneCard.classList.remove('is-flipped');
    fortuneCard.classList.remove('is-shuffling');
  }

  function runDrawSequence() {
    if (isBusy || !data) return;
    isBusy = true;
    clearTimers();
    setControlsDisabled(true);

    // 0ms: 셔플 시작
    fortuneCard.classList.add('is-shuffling');

    // 600ms: 셔플 종료, 플립 시작 + 결과 미리 세팅
    timers.push(setTimeout(function () {
      fortuneCard.classList.remove('is-shuffling');
      drawResult();
      fortuneCard.classList.add('is-flipped');
    }, TIMING.SHUFFLE_MS));

    // 1000ms: 결과 패널 표시
    timers.push(setTimeout(function () {
      resultArea.removeAttribute('hidden');
      resultArea.classList.add('is-visible');
    }, TIMING.SHUFFLE_MS + TIMING.FLIP_MS));

    // 1300ms: 재도전 버튼 노출 + 잠금 해제
    timers.push(setTimeout(function () {
      retryBtn.removeAttribute('hidden');
      setControlsDisabled(false);
      isBusy = false;
    }, TIMING.SHUFFLE_MS + TIMING.FLIP_MS + TIMING.FADE_MS));
  }

  function handleRetry() {
    if (isBusy) return;
    resetForNewDraw();
    // 리셋 직후 바로 다음 프레임에 시퀀스 재실행 (레이아웃 반영 시간 확보)
    requestAnimationFrame(function () {
      runDrawSequence();
    });
  }

  function showFatalError() {
    if (errorNotice) {
      errorNotice.removeAttribute('hidden');
    }
    drawBtn.setAttribute('disabled', 'disabled');
    fortuneCard.setAttribute('aria-disabled', 'true');
  }

  function init() {
    populateBirthSelects();
    birthYearSelect.addEventListener('change', refreshDayOptions);
    birthMonthSelect.addEventListener('change', refreshDayOptions);
    birthSubmitBtn.addEventListener('click', handleBirthSubmit);
    birthChangeBtn.addEventListener('click', handleBirthChange);

    fetch('content/fortunes.json')
      .then(function (res) {
        if (!res.ok) {
          throw new Error('fortunes.json 응답 오류: HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (json) {
        data = {
          fortunes: json.fortunes,
          luckyColors: json.luckyColors,
          luckyFoods: json.luckyFoods,
          luckyActions: json.luckyActions
        };

        drawBtn.addEventListener('click', runDrawSequence);
        fortuneCard.addEventListener('click', runDrawSequence);
        fortuneCard.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            runDrawSequence();
          }
        });
        retryBtn.addEventListener('click', handleRetry);
      })
      .catch(function (err) {
        console.error('[오늘의 운세 뽑기] fortunes.json 로드 실패:', err);
        console.error('힌트: file:// 로 직접 열면 CORS 정책 때문에 fetch가 막힙니다. ' +
          '로컬 서버(예: npx serve . 또는 python -m http.server)로 실행한 뒤 다시 열어주세요.');
        showFatalError();
      });
  }

  init();
})();
