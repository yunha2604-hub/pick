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
  var luckyBadge = document.getElementById('luckyBadge');
  var retryBtn = document.getElementById('retryBtn');
  var errorNotice = document.getElementById('errorNotice');

  var data = null; // { fortunes, luckyColors, luckyFoods, luckyActions }
  var isBusy = false;
  var timers = [];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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
  function pickLuckyItem() {
    var categories = ['luckyColors', 'luckyFoods', 'luckyActions'];
    var category = pickRandom(categories);
    var item = pickRandom(data[category]);
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
    var fortune = pickRandom(data.fortunes);
    var lucky = pickLuckyItem();
    var emoji = pickRandom(TONE_EMOJI[fortune.tone] || TONE_EMOJI.neutral);
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
