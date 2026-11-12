// 배너, 요일 탭, 룰렛 카드, 식당 카드 그리기
window.App = window.App || {};

(function () {
  // 태그 + 클래스 + 텍스트로 요소를 만든다. 텍스트는 항상 textContent로 넣는다.
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function button(className, text, action, disabled) {
    const b = el('button', className, text);
    b.type = 'button';
    b.dataset.action = action;
    b.disabled = !!disabled;
    return b;
  }

  function formatPrice(price) {
    return Number(price).toLocaleString('ko-KR') + '원';
  }

  // 네이버 지도 검색: 주소를 붙이면 그 위치에 핀이 찍힌다
  const NAVER_MAP_SEARCH = 'https://map.naver.com/p/search/';

  // 길찾기 출발지 (회사)
  const ORIGIN = { name: '한신IT타워', lat: 37.4824312, lng: 126.894382 };

  // 네이버 지도 도보 길찾기: /p/directions/{출발}/{도착}/-/walk
  // 각 지점은 "경도,위도,이름,,ADDRESS_POI"
  function naverDirectionsUrl(from, to) {
    function point(p) {
      return p.lng + ',' + p.lat + ',' + encodeURIComponent(p.name) + ',,ADDRESS_POI';
    }
    return 'https://map.naver.com/p/directions/' + point(from) + '/' + point(to) + '/-/walk';
  }

  function isSamePlace(a, b) {
    return Math.abs(a.lat - b.lat) < 0.0002 && Math.abs(a.lng - b.lng) < 0.0002;
  }

  // 출발지와 같은 건물이면 위치만, 아니면 한신IT타워 → 식당 도보 길찾기
  function mapLink(r) {
    const hasCoords = typeof r.lat === 'number' && typeof r.lng === 'number';
    if (hasCoords && !isSamePlace(r, ORIGIN)) {
      const a = externalLink('card__link card__link--map', '📍 길 찾기', naverDirectionsUrl(ORIGIN, r));
      a.title = ORIGIN.name + '에서 걸어가는 길';
      return a;
    }
    if (!r.address) return null;
    const label = hasCoords ? '📍 같은 건물' : '📍 위치 보기';
    return externalLink('card__link card__link--map', label, NAVER_MAP_SEARCH + encodeURIComponent(r.address));
  }

  // 새 탭으로 여는 외부 링크
  function externalLink(className, text, href) {
    const a = el('a', className, text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  // http(s) 링크만 허용 (가져온 백업 파일에 javascript: 같은 값이 들어와도 막는다)
  function isSafeUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
  }

  // messages: 문자열 배열
  function renderBanners(container, messages) {
    container.replaceChildren();
    messages.forEach(function (msg) {
      container.appendChild(el('p', 'banner', msg));
    });
  }

  function renderWeekLabel(labelEl, weekStart) {
    labelEl.textContent = App.date.formatWeekRange(weekStart);
  }

  // days: Date[] (월~금), selectedDate, today: Date
  function renderTabs(container, days, selectedDate, today) {
    const selectedKey = App.date.toKey(selectedDate);
    const todayKey = App.date.toKey(today);

    container.replaceChildren();
    days.forEach(function (day) {
      const key = App.date.toKey(day);
      const isSelected = key === selectedKey;
      const tab = el('button', 'tab' + (isSelected ? ' tab--selected' : ''));
      tab.type = 'button';
      tab.setAttribute('aria-pressed', String(isSelected));
      tab.dataset.date = key;

      // "화 11/10" → 요일과 날짜를 나눠 두면 좁은 화면에서 모든 탭이 같은 위치에서 줄바꿈된다.
      const text = App.date.formatTab(day);
      const space = text.indexOf(' ');
      const label = el('span', 'tab__label');
      label.append(
        el('span', 'tab__day', text.slice(0, space)),
        ' ',
        el('span', 'tab__date', text.slice(space + 1))
      );
      tab.appendChild(label);
      if (key === todayKey) {
        tab.appendChild(el('span', 'tab__today', '오늘'));
      }
      container.appendChild(tab);
    });
  }

  // 룰렛 카드
  // view: {
  //   isToday, spinning,
  //   result: { restaurant, menu } 룰렛 결과 또는 null,
  //   empty: 룰렛 후보가 0곳인지,
  //   chosen: { restaurant, menu } 이 날 "여기서 먹을래요"로 기록한 곳 또는 null,
  //   fresh: 결과가 방금 나왔는지 (등장 애니메이션용)
  // }
  function renderRoulette(container, view) {
    container.replaceChildren();
    container.classList.toggle('roulette--spinning', !!view.spinning);
    container.classList.toggle('roulette--result', !!(view.fresh && view.result));

    const body = el('div', 'roulette__body');
    body.appendChild(el('p', 'roulette__label', view.isToday ? '오늘 어디 갈까?' : '이 날 어디 갈까?'));

    function describe(prefix, pick) {
      const parts = [prefix, pick.restaurant.name];
      if (pick.menu) parts.push(pick.menu.main);
      return parts.join(' · ');
    }

    let title;
    if (view.spinning) {
      title = el('p', 'roulette__title', '룰렛 돌리는 중…');
    } else if (view.empty) {
      title = el('p', 'roulette__title roulette__title--empty', '지금 갈 수 있는 식당이 없어요');
    } else if (view.result) {
      title = el('p', 'roulette__title', describe('룰렛 결과', view.result));
    } else if (view.chosen) {
      title = el('p', 'roulette__title', describe('선택한 곳', view.chosen));
    } else {
      title = el('p', 'roulette__title roulette__title--empty', '룰렛을 돌려 정해 보세요');
    }
    body.appendChild(title);
    container.appendChild(body);

    // "여기서 먹을래요"는 룰렛 결과가 있을 때만. 결과가 이미 기록된 곳이면 "선택 완료 ✓".
    const resultChosen = !!(view.result && view.chosen && view.result.restaurant.id === view.chosen.restaurant.id);
    const showDone = resultChosen || (!view.result && !!view.chosen);
    const actions = el('div', 'roulette__actions');
    const spinBtn = button('btn', '룰렛 돌리기', 'roulette', view.spinning);
    spinBtn.appendChild(el('span', 'dice', '🎲'));
    actions.appendChild(spinBtn);
    actions.appendChild(button(
      'btn btn--primary',
      showDone ? '선택 완료 ✓' : '여기서 먹을래요',
      'choose',
      view.spinning || !view.result || resultChosen
    ));
    container.appendChild(actions);
  }

  // rouletteId: 룰렛 결과 식당 id 또는 null
  function renderCards(container, restaurants, dayMenus, rouletteId, favorites) {
    const favs = favorites || [];
    container.replaceChildren();
    restaurants.forEach(function (r) {
      const isRoulette = r.id === rouletteId;
      const card = el('article', 'card' + (isRoulette ? ' card--roulette' : ''));
      card.dataset.restaurantId = r.id;

      const head = el('div', 'card__head');
      head.appendChild(el('h2', 'card__name', r.name));
      const badges = el('div', 'card__badges');
      badges.appendChild(el('span', 'card__status')); // updateStatuses가 채운다
      if (isRoulette) badges.appendChild(el('span', 'badge', '🎯 룰렛 당첨'));
      head.appendChild(badges);
      card.appendChild(head);

      if (r.location) card.appendChild(el('p', 'card__meta', r.location));
      if (r.note) card.appendChild(el('p', 'card__note', r.note));

      card.appendChild(el('hr', 'card__divider'));

      const menu = dayMenus && dayMenus[r.id];
      if (menu) {
        // 사진 순서 그대로 전부 나열하고, 대표 메뉴(main)는 그 줄을 굵게 + ☆ 버튼.
        // sides에 main이 없으면(예전 형식) 맨 앞에 넣는다.
        const items = (menu.sides || []).slice();
        if (items.indexOf(menu.main) === -1) items.unshift(menu.main);

        const isFav = favs.indexOf(menu.main) !== -1;
        const list = el('ul', 'card__sides');
        items.forEach(function (item) {
          if (item !== menu.main) {
            list.appendChild(el('li', null, item));
            return;
          }
          const li = el('li', 'card__item--main');
          li.appendChild(el('span', 'card__main', item));
          const star = button('fav-btn' + (isFav ? ' fav-btn--on' : ''), isFav ? '★' : '☆', 'favorite');
          star.setAttribute('aria-pressed', String(isFav));
          star.setAttribute('aria-label', isFav ? '즐겨찾기 해제' : '즐겨찾기 추가');
          star.title = isFav ? '즐겨찾기 해제' : '즐겨찾기 추가';
          li.appendChild(star);
          list.appendChild(li);
        });
        card.appendChild(list);
      } else {
        card.appendChild(el('p', 'card__empty', '등록된 메뉴가 없습니다'));
      }

      // 가격 + 길 찾기 · 원문 보기 (한 줄)
      const foot = el('div', 'card__foot');
      const price = menu ? (menu.price != null ? menu.price : r.price) : null;
      if (price != null) foot.appendChild(el('p', 'card__price', formatPrice(price)));
      const links = el('div', 'card__links');
      const map = mapLink(r);
      if (map) links.appendChild(map);
      if (isSafeUrl(r.url)) {
        links.appendChild(externalLink('card__link', '원문 보기', r.url));
      }
      if (links.childNodes.length) foot.appendChild(links);
      if (foot.childNodes.length) card.appendChild(foot);

      container.appendChild(card);
    });
  }

  function forEachCard(container, fn) {
    container.querySelectorAll('.card').forEach(function (card) {
      fn(card, card.dataset.restaurantId);
    });
  }

  // 카드를 다시 그리지 않고 상태 배지만 갱신한다.
  // 오늘이면 영업 상태 배지, 오늘이 아니면 "점심 11:00-13:50".
  function updateStatuses(container, restaurants, isToday, at) {
    forEachCard(container, function (card, id) {
      const r = restaurants.find(function (x) { return x.id === id; });
      const slot = card.querySelector('.card__status');
      if (!r || !slot) return;

      if (isToday) {
        const status = App.status.getStatus(r, at);
        slot.className = 'card__status status-badge status-badge--' + status.state;
        slot.textContent = status.label;
        slot.hidden = !status.label;
        card.classList.toggle('card--closed', status.state === 'closed');
      } else {
        slot.className = 'card__status card__hours';
        slot.textContent = r.hours ? '점심 ' + r.hours : '';
        slot.hidden = !r.hours;
        card.classList.remove('card--closed');
      }
    });
  }

  // 방금 누른 즐겨찾기 별만 튀어 오르게
  function popFavorite(container, restaurantId) {
    forEachCard(container, function (card, id) {
      const star = id === restaurantId && card.querySelector('.fav-btn');
      if (star) star.classList.add('fav-btn--pop');
    });
  }

  // 룰렛이 도는 동안 강조할 카드 (id가 null이면 모두 해제)
  function setSpinHighlight(container, restaurantId) {
    forEachCard(container, function (card, id) {
      card.classList.toggle('card--spin', id === restaurantId);
    });
  }

  App.render = {
    renderBanners: renderBanners,
    renderWeekLabel: renderWeekLabel,
    renderTabs: renderTabs,
    renderRoulette: renderRoulette,
    renderCards: renderCards,
    updateStatuses: updateStatuses,
    setSpinHighlight: setSpinHighlight,
    popFavorite: popFavorite
  };
})();
