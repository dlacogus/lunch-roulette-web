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

  // 인라인 SVG 아이콘 (이모지 대신). 색은 currentColor를 따른다.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    dice: [
      ['rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 2.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8 }],
      ['circle', { cx: 8.5, cy: 8.5, r: 1.4, fill: 'currentColor' }],
      ['circle', { cx: 15.5, cy: 8.5, r: 1.4, fill: 'currentColor' }],
      ['circle', { cx: 12, cy: 12, r: 1.4, fill: 'currentColor' }],
      ['circle', { cx: 8.5, cy: 15.5, r: 1.4, fill: 'currentColor' }],
      ['circle', { cx: 15.5, cy: 15.5, r: 1.4, fill: 'currentColor' }]
    ],
    star: [
      ['path', {
        d: 'M12 3.5l2.63 5.33 5.87.85-4.25 4.14 1 5.85L12 16.9l-5.25 2.77 1-5.85L3.5 9.68l5.87-.85z',
        fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linejoin': 'round'
      }]
    ]
  };

  function icon(name, className) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'icon' + (className ? ' ' + className : ''));
    ICONS[name].forEach(function (shape) {
      const node = document.createElementNS(SVG_NS, shape[0]);
      Object.keys(shape[1]).forEach(function (key) { node.setAttribute(key, shape[1][key]); });
      svg.appendChild(node);
    });
    return svg;
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
      const a = externalLink('card__link card__link--map', '길 찾기', naverDirectionsUrl(ORIGIN, r));
      a.title = ORIGIN.name + '에서 걸어가는 길';
      return a;
    }
    if (!r.address) return null;
    const label = hasCoords ? '같은 건물' : '위치 보기';
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

  // 상단 띠의 "11월 23일 월요일, 오늘의 점심 차림표"
  function renderTodayLabel(labelEl, today) {
    labelEl.textContent = App.date.formatLong(today) + ', 오늘의 점심 차림표';
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
        tab.appendChild(el('span', 'tab__today', '· 오늘'));
      }
      container.appendChild(tab);
    });
  }

  // 룰렛 카드
  // view: {
  //   isToday, spinning,
  //   result: { restaurant, menu } 룰렛 결과 또는 null,
  //   empty: 룰렛 후보가 0곳인지,
  //   fresh: 결과가 방금 나왔는지 (등장 애니메이션용)
  // }
  function renderRoulette(container, view) {
    container.replaceChildren();
    container.classList.toggle('roulette--spinning', !!view.spinning);
    container.classList.toggle('roulette--result', !!(view.fresh && view.result));

    const actions = el('div', 'roulette__actions');
    const spinBtn = button('btn btn--spin', null, 'roulette', view.spinning);
    spinBtn.append(icon('dice', 'dice'), el('span', null, '룰렛 돌리기'));
    actions.appendChild(spinBtn);
    container.appendChild(actions);

    // 안내 문구는 두지 않는다. 돌리는 중·결과·후보 없음일 때만 한 줄로 알린다.
    let message = null;
    if (view.spinning) message = '룰렛 돌리는 중…';
    else if (view.empty) message = '지금 갈 수 있는 식당이 없어요';
    else if (view.result) {
      const parts = ['룰렛 결과', view.result.restaurant.name];
      if (view.result.menu) parts.push(view.result.menu.main);
      message = parts.join(' · ');
    }
    if (message) {
      const body = el('div', 'roulette__body');
      body.appendChild(el('p', 'roulette__title', message));
      container.appendChild(body);
    }
  }

  // rouletteId: 룰렛 결과 식당 id 또는 null
  function renderCards(container, restaurants, dayMenus, rouletteId, favorites) {
    const favs = favorites || [];
    container.replaceChildren();
    restaurants.forEach(function (r, index) {
      const isRoulette = r.id === rouletteId;
      const card = el('article', 'card' + (isRoulette ? ' card--roulette' : ''));
      card.dataset.restaurantId = r.id;

      // 머리: (당첨 표시) → 순번 → 식당명 → 위치 → 영업 상태
      const head = el('div', 'card__head');
      if (isRoulette) head.appendChild(el('p', 'badge', '룰렛 당첨'));
      head.appendChild(el('p', 'card__no', '— ' + String(index + 1).padStart(2, '0') + ' —'));
      head.appendChild(el('h2', 'card__name', r.name));
      if (r.location) head.appendChild(el('p', 'card__meta', r.location));
      head.appendChild(el('p', 'card__status')); // updateStatuses가 채운다
      card.appendChild(head);

      if (r.note) card.appendChild(el('p', 'card__note', r.note));

      const ornament = el('div', 'ornament card__divider');
      ornament.setAttribute('aria-hidden', 'true');
      card.appendChild(ornament);

      const menu = dayMenus && dayMenus[r.id];
      if (menu) {
        // 대표 메뉴(main)를 맨 첫 줄로 올리고, 나머지는 사진 순서 그대로 나열한다.
        const items = [menu.main].concat((menu.sides || []).filter(function (item) {
          return item !== menu.main;
        }));

        const isFav = favs.indexOf(menu.main) !== -1;
        const list = el('ul', 'card__sides');
        items.forEach(function (item, i) {
          if (i > 0) {
            list.appendChild(el('li', null, item));
            return;
          }
          const li = el('li', 'card__item--main');
          li.appendChild(el('span', 'card__main', item));
          const star = button('fav-btn' + (isFav ? ' fav-btn--on' : ''), null, 'favorite');
          star.appendChild(icon('star'));
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
        // "영업 중 · 13:50 마감" → 상태와 마감 시각을 따로 꾸밀 수 있게 나눈다
        const parts = status.label.split(' · ');
        slot.replaceChildren(el('span', 'status-badge__state', parts[0]));
        if (parts[1]) slot.appendChild(el('span', 'status-badge__time', parts[1]));
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
    renderTodayLabel: renderTodayLabel,
    renderTabs: renderTabs,
    renderRoulette: renderRoulette,
    renderCards: renderCards,
    updateStatuses: updateStatuses,
    setSpinHighlight: setSpinHighlight,
    popFavorite: popFavorite
  };
})();
