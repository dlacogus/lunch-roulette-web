// localStorage 읽기·쓰기, 초기 데이터, 저장 데이터 검증
window.App = window.App || {};

(function () {
  const STORAGE_KEY = 'cafeteria-app-v1';
  const BACKUP_KEY = 'cafeteria-app-backup';
  const VERSION = 1;

  // 이번 실행에서 생긴 문제. 화면 배너가 이 값을 보고 그린다.
  const status = {
    corrupted: false,   // 저장 데이터가 손상되어 초기화함
    unavailable: false  // localStorage를 쓸 수 없어 메모리에서만 동작
  };

  function createRestaurants() {
    return [
      { id: 'r1', name: '한신IT타워 구내식당', location: '한신IT타워 B1 101호', hours: '11:00-13:50', price: 7500, url: 'https://구로.kr/cafeteria/한신IT타워구내식당', note: '' },
      { id: 'r2', name: '더이츠푸드', location: '대륭포스트타워1차 B108호', hours: '11:00-13:30', price: 7500, url: 'https://구로.kr/cafeteria/더이츠푸드', note: '' },
      { id: 'r3', name: '더삼흥 한식뷔페', location: '에이스하이엔드타워1차 B1', hours: '11:00-14:00', price: 8000, url: 'https://구로.kr/cafeteria/더삼흥한식뷔페', note: '현금가 7,000원 이벤트 (~12/31)' }
    ];
  }

  function createDefaultData() {
    return {
      version: VERSION,
      restaurants: createRestaurants(),
      menus: {},
      favorites: [],
      history: []
    };
  }

  function createInitialData() {
    return createDefaultData();
  }

  // js/menus.js의 식단으로 data.menus를 통째로 바꾼다. 식단의 기준은 항상 menus.js 파일이다.
  // 형식이 잘못된 메뉴는 건너뛴다.
  function applyWeeklyMenus(data) {
    const source = App.weeklyMenus && isPlainObject(App.weeklyMenus.menus) ? App.weeklyMenus.menus : {};
    const menus = {};
    Object.keys(source).forEach(function (dateKey) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !isPlainObject(source[dateKey])) return;
      const day = {};
      Object.keys(source[dateKey]).forEach(function (rid) {
        const m = source[dateKey][rid];
        if (isValidMenu(m)) {
          day[rid] = { main: m.main, sides: (m.sides || []).slice() };
          if (m.price !== undefined) day[rid].price = m.price;
        }
      });
      if (Object.keys(day).length) menus[dateKey] = day;
    });
    data.menus = menus;
  }

  // ---- 검증 / 버전 변환 ----

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function isValidMenu(m) {
    return isPlainObject(m) &&
      typeof m.main === 'string' &&
      (m.sides === undefined || (Array.isArray(m.sides) && m.sides.every(function (s) { return typeof s === 'string'; }))) &&
      (m.price === undefined || typeof m.price === 'number');
  }

  function isValidData(d) {
    if (!isPlainObject(d) || d.version !== VERSION) return false;
    if (!Array.isArray(d.restaurants) || !d.restaurants.every(function (r) {
      return isPlainObject(r) && typeof r.id === 'string' && typeof r.name === 'string';
    })) return false;
    if (!isPlainObject(d.menus) || !Object.keys(d.menus).every(function (key) {
      const day = d.menus[key];
      return isPlainObject(day) && Object.keys(day).every(function (rid) { return isValidMenu(day[rid]); });
    })) return false;
    if (!Array.isArray(d.favorites) || !d.favorites.every(function (f) { return typeof f === 'string'; })) return false;
    if (!Array.isArray(d.history) || !d.history.every(isPlainObject)) return false;
    return true;
  }

  // 이전/다른 버전 데이터를 현재 VERSION 구조로 바꾸는 자리.
  // 지금은 버전 1밖에 없어서 그대로 돌려준다. 변환하지 못한 데이터는 isValidData에서 걸러진다.
  function migrate(data) {
    // 예) if (data.version === 0) { ...; data.version = 1; }
    return data;
  }

  // 문자열 → 검증된 데이터. 실패하면 null.
  function parseData(raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    if (isPlainObject(data) && data.version !== VERSION) data = migrate(data);
    return isValidData(data) ? data : null;
  }

  // ---- localStorage ----

  function save(data) {
    if (status.unavailable) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      // 용량 초과 등: 이후로는 메모리에서만 동작
      status.unavailable = true;
      return false;
    }
  }

  // 저장된 데이터를 읽는다. 없거나 손상됐으면 초기 데이터.
  function readStoredOrInitial() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      status.unavailable = true;
      return createInitialData();
    }

    if (raw) {
      const stored = parseData(raw);
      if (stored) return stored;

      // 손상: 원본을 백업 키로 옮기고 초기화
      status.corrupted = true;
      try {
        localStorage.setItem(BACKUP_KEY, raw);
      } catch (e) {
        // 백업 실패는 초기화를 막지 않는다
      }
    }
    return createInitialData();
  }

  function load() {
    const data = readStoredOrInitial();
    delete data.recommendations; // 추천 기능을 없애기 전에 저장된 값 정리
    applyWeeklyMenus(data);
    save(data);
    return data;
  }

  function getStatus() {
    return { corrupted: status.corrupted, unavailable: status.unavailable };
  }

  App.storage = {
    load: load,
    save: save,
    getStatus: getStatus,
    migrate: migrate
  };
})();
