// 상태 관리, 이벤트 연결, 시작점
window.App = window.App || {};

(function () {
  const D = App.date;
  const HISTORY_LIMIT = 30;
  const STATUS_REFRESH_MS = 60 * 1000;

  // 룰렛 애니메이션: 약 2.5초, 간격 60ms → 400ms
  const SPIN_FIRST_MS = 60;
  const SPIN_LAST_MS = 400;
  const SPIN_ACCEL_UNTIL_MS = 1800; // 이 시점까지 점점 느려지고, 마지막 한 칸은 SPIN_LAST_MS
  const SPIN_RESULT_PAUSE_MS = 200; // 마지막 칸에서 잠깐 멈춘 뒤 결과 표시

  // 선택한 요일·주와 룰렛 결과는 저장하지 않는다. 새로 열면 항상 오늘 기준.
  const state = {
    data: null,
    selectedDate: null,
    weekStart: null,
    // { dateKey, spinning, resultId, empty } 또는 null
    roulette: null
  };

  const els = {};
  let spinTimer = null;

  // 화면 효과용 (저장하지 않음): 마지막으로 그린 날짜, 방금 나온 룰렛 결과인지
  let lastRenderedKey = null;
  let freshResult = false;

  function now() {
    return App.status.now();
  }

  function todayKey() {
    return D.toKey(now());
  }

  function selectedKey() {
    return D.toKey(state.selectedDate);
  }

  function isSelectedToday() {
    return selectedKey() === todayKey();
  }

  function persist() {
    App.storage.save(state.data);
  }

  function findRestaurant(id) {
    return state.data.restaurants.find(function (r) { return r.id === id; }) || null;
  }

  // 선택된 날짜의 룰렛 상태 (다른 날짜 것이면 무시)
  function currentRoulette() {
    return state.roulette && state.roulette.dateKey === selectedKey() ? state.roulette : null;
  }

  // 이 날 "여기서 먹을래요"로 기록한 식당
  function chosenRestaurantId(dateKey) {
    const entry = state.data.history.find(function (h) { return h.date === dateKey; });
    return entry ? entry.restaurantId : null;
  }

  function bannerMessages() {
    const status = App.storage.getStatus();
    const messages = [];
    if (status.corrupted) messages.push('저장 데이터가 손상되어 초기화했어요');
    if (status.unavailable) messages.push('이 브라우저에서는 저장되지 않습니다');
    return messages;
  }

  function render() {
    const key = selectedKey();
    const dayMenus = state.data.menus[key] || {};

    const roulette = currentRoulette();
    const spinning = !!(roulette && roulette.spinning);
    const result = roulette && !spinning ? findRestaurant(roulette.resultId) : null;
    const chosen = findRestaurant(chosenRestaurantId(key));

    // 날짜가 바뀐 렌더에서만 카드 등장 효과, 결과가 막 나온 렌더에서만 당첨 효과
    els.cards.classList.toggle('cards--enter', key !== lastRenderedKey);
    els.cards.classList.toggle('cards--result', freshResult && !!result);

    App.render.renderBanners(els.banners, bannerMessages());
    App.render.renderWeekLabel(els.weekLabel, state.weekStart);
    App.render.renderTabs(els.tabs, D.getWeekDays(state.weekStart), state.selectedDate, now());
    App.render.renderRoulette(els.roulette, {
      isToday: isSelectedToday(),
      spinning: spinning,
      empty: !!(roulette && roulette.empty),
      result: result ? { restaurant: result, menu: dayMenus[result.id] || null } : null,
      chosen: chosen ? { restaurant: chosen, menu: dayMenus[chosen.id] || null } : null,
      fresh: freshResult
    });
    App.render.renderCards(
      els.cards,
      state.data.restaurants,
      dayMenus,
      result ? result.id : null,
      state.data.favorites
    );
    refreshStatuses();

    lastRenderedKey = key;
    freshResult = false;
  }

  // 1분마다, 그리고 탭으로 돌아올 때: 배지만 갱신 (render 호출 안 함)
  function refreshStatuses() {
    App.render.updateStatuses(els.cards, state.data.restaurants, isSelectedToday(), now());
  }

  // ---- 상태 변경 ----

  function cancelRoulette() {
    if (spinTimer) {
      clearTimeout(spinTimer);
      spinTimer = null;
    }
    state.roulette = null;
  }

  function selectDate(key) {
    cancelRoulette();
    state.selectedDate = D.fromKey(key);
    render();
  }

  // 주 이동: 선택된 요일은 유지한 채 7일씩 이동
  function moveWeek(direction) {
    cancelRoulette();
    state.weekStart = D.addDays(state.weekStart, 7 * direction);
    state.selectedDate = D.addDays(state.selectedDate, 7 * direction);
    render();
  }

  // 룰렛 결과를 기록한다. 하루에 한 곳만 기록: 같은 날짜의 이전 선택은 바꿔 쓴다.
  function chooseResult() {
    const roulette = currentRoulette();
    if (!roulette || roulette.spinning || !roulette.resultId) return;
    const key = selectedKey();
    const menu = (state.data.menus[key] || {})[roulette.resultId];

    const history = state.data.history.filter(function (h) { return h.date !== key; });
    history.push({ date: key, restaurantId: roulette.resultId, menu: menu ? menu.main : '' });
    state.data.history = history.slice(-HISTORY_LIMIT);
    persist();
    render();
  }

  function toggleFavorite(restaurantId) {
    const menu = (state.data.menus[selectedKey()] || {})[restaurantId];
    if (!menu) return;

    const favs = state.data.favorites;
    const idx = favs.indexOf(menu.main);
    if (idx === -1) favs.push(menu.main);
    else favs.splice(idx, 1);

    persist();
    render();
    App.render.popFavorite(els.cards, restaurantId);
  }

  // ---- 룰렛 ----

  // 메뉴가 있는 식당(없으면 3곳 전체). 오늘이면 영업 종료된 곳은 뺀다.
  function rouletteCandidates() {
    const dayMenus = state.data.menus[selectedKey()] || {};
    let list = state.data.restaurants.filter(function (r) { return dayMenus[r.id]; });
    if (!list.length) list = state.data.restaurants.slice();
    if (isSelectedToday()) {
      const at = now();
      list = list.filter(function (r) {
        const s = App.status.getStatus(r, at).state;
        return s !== 'closed' && s !== 'weekend';
      });
    }
    return list;
  }

  // 회전 간격 목록: 60ms에서 점점 느려지다가 마지막은 400ms. 합계 약 2.5초.
  function spinDelays() {
    const delays = [];
    let elapsed = 0;
    while (elapsed < SPIN_ACCEL_UNTIL_MS) {
      const t = elapsed / SPIN_ACCEL_UNTIL_MS;
      const delay = Math.round(SPIN_FIRST_MS + (SPIN_LAST_MS - SPIN_FIRST_MS) * t * t);
      delays.push(delay);
      elapsed += delay;
    }
    delays.push(SPIN_LAST_MS);
    return delays;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function showRouletteResult(dateKey, resultId) {
    spinTimer = null;
    state.roulette = { dateKey: dateKey, spinning: false, resultId: resultId, empty: false };
    freshResult = true;
    render();
  }

  function spinRoulette() {
    cancelRoulette();
    const key = selectedKey();
    const candidates = rouletteCandidates();

    if (candidates.length === 0) {
      state.roulette = { dateKey: key, spinning: false, resultId: null, empty: true };
      render();
      return;
    }
    // 결과를 먼저 정하고, 애니메이션은 그 결과에서 멈추게 한다. 확률은 모두 같다.
    const resultIndex = Math.floor(Math.random() * candidates.length);
    const resultId = candidates[resultIndex].id;

    if (candidates.length === 1 || prefersReducedMotion()) {
      showRouletteResult(key, resultId);
      return;
    }

    state.roulette = { dateKey: key, spinning: true, resultId: resultId, empty: false };
    render(); // 버튼 비활성

    // 강조 순서: 화면의 카드 순서대로 후보를 돌다가 마지막 칸이 결과가 되도록 시작 위치를 맞춘다.
    const delays = spinDelays();
    const steps = delays.length + 1;
    const n = candidates.length;
    const start = ((resultIndex - (steps - 1)) % n + n) % n;
    let step = 0;

    function tick() {
      App.render.setSpinHighlight(els.cards, candidates[(start + step) % n].id);
      if (step === steps - 1) {
        spinTimer = setTimeout(function () { showRouletteResult(key, resultId); }, SPIN_RESULT_PAUSE_MS);
        return;
      }
      spinTimer = setTimeout(tick, delays[step]);
      step++;
    }
    tick();
  }

  // ---- 이벤트 (영역마다 하나씩 위임) ----

  function bindEvents() {
    els.tabs.addEventListener('click', function (e) {
      const tab = e.target.closest('.tab');
      if (tab && tab.dataset.date) selectDate(tab.dataset.date);
    });

    els.weekNav.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'prev-week') moveWeek(-1);
      if (btn.dataset.action === 'next-week') moveWeek(1);
    });

    els.roulette.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      if (btn.dataset.action === 'roulette') spinRoulette();
      if (btn.dataset.action === 'choose') chooseResult();
    });

    els.cards.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action="favorite"]');
      if (!btn) return;
      const card = btn.closest('.card');
      if (card) toggleFavorite(card.dataset.restaurantId);
    });

    setInterval(refreshStatuses, STATUS_REFRESH_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') refreshStatuses();
    });
  }

  function init() {
    els.banners = document.getElementById('banners');
    els.weekNav = document.querySelector('.week-nav');
    els.weekLabel = document.getElementById('week-label');
    els.tabs = document.getElementById('tabs');
    els.roulette = document.getElementById('roulette');
    els.cards = document.getElementById('cards');

    state.data = App.storage.load();
    state.selectedDate = D.getInitialDate(now());
    state.weekStart = D.getWeekStart(state.selectedDate);

    bindEvents();
    render();
  }

  // 콘솔에서 상태를 확인하기 위한 참조
  App.state = state;

  document.addEventListener('DOMContentLoaded', init);
})();
