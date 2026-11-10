// 영업 상태 계산 (기기 로컬 시간 기준)
window.App = window.App || {};

(function () {
  const SOON_MINUTES = 30;

  // 테스트용: URL에 ?now=2026-11-10T13:35 가 있으면 그 시각부터 시간이 흐르는 것으로 본다.
  const offsetMs = (function () {
    try {
      const value = new URLSearchParams(window.location.search).get('now');
      const m = value && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
      if (!m) return 0;
      const fake = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
      return isNaN(fake.getTime()) ? 0 : fake.getTime() - Date.now();
    } catch (e) {
      return 0;
    }
  })();

  // 앱 전체에서 "현재 시각"은 이 함수로 얻는다.
  function now() {
    return new Date(Date.now() + offsetMs);
  }

  // "11:00-13:50" → { open: 660, close: 830 } (자정 기준 분). 형식이 틀리면 null.
  function parseHours(hours) {
    const m = /^\s*(\d{1,2}):(\d{2})\s*[-–~]\s*(\d{1,2}):(\d{2})\s*$/.exec(String(hours || ''));
    if (!m) return null;
    const open = +m[1] * 60 + +m[2];
    const close = +m[3] * 60 + +m[4];
    return close > open ? { open: open, close: close } : null;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatMinutes(total) {
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  }

  // → { state, label, minutesLeft }
  // state: 'before' | 'open' | 'soon' | 'closed' | 'weekend' | 'unknown'
  // minutesLeft: 오픈 전이면 오픈까지, 영업 중이면 마감까지 남은 분. 그 외 null.
  function getStatus(restaurant, at) {
    const day = at.getDay();
    if (day === 0 || day === 6) {
      return { state: 'weekend', label: '주말 휴무', minutesLeft: null };
    }

    const hours = parseHours(restaurant.hours);
    if (!hours) return { state: 'unknown', label: '', minutesLeft: null };

    const minute = at.getHours() * 60 + at.getMinutes();
    if (minute < hours.open) {
      const left = hours.open - minute;
      return { state: 'before', label: '오픈 ' + left + '분 전', minutesLeft: left };
    }
    if (minute < hours.close) {
      const left = hours.close - minute;
      if (left > SOON_MINUTES) {
        return { state: 'open', label: '영업 중 · ' + formatMinutes(hours.close) + ' 마감', minutesLeft: left };
      }
      return { state: 'soon', label: '마감 ' + left + '분 전', minutesLeft: left };
    }
    return { state: 'closed', label: '오늘 영업 종료', minutesLeft: null };
  }

  App.status = {
    now: now,
    parseHours: parseHours,
    getStatus: getStatus
  };
})();
