// 오늘 날짜, 주간 날짜 계산 (모두 로컬 시간 기준)
window.App = window.App || {};

(function () {
  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  // 로컬 기준 "YYYY-MM-DD". toISOString()은 UTC라 쓰지 않는다.
  function toKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  // "YYYY-MM-DD" → 로컬 자정 Date
  function fromKey(key) {
    const parts = key.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  // 시·분·초를 버린 같은 날짜의 새 Date
  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const d = startOfDay(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  // 그 주 월요일. 토·일이면 다음 주 월요일.
  function getWeekStart(date) {
    const day = date.getDay(); // 0=일 ... 6=토
    if (day === 6) return addDays(date, 2);
    if (day === 0) return addDays(date, 1);
    return addDays(date, 1 - day);
  }

  // 월~금 5일
  function getWeekDays(weekStart) {
    const days = [];
    for (let i = 0; i < 5; i++) days.push(addDays(weekStart, i));
    return days;
  }

  // "11/9"
  function formatMonthDay(date) {
    return (date.getMonth() + 1) + '/' + date.getDate();
  }

  // "월 11/9"
  function formatTab(date) {
    return DAY_NAMES[date.getDay()] + ' ' + formatMonthDay(date);
  }

  // "11/9 – 11/13"
  function formatWeekRange(weekStart) {
    return formatMonthDay(weekStart) + ' – ' + formatMonthDay(addDays(weekStart, 4));
  }

  // 앱을 열었을 때 보여 줄 날짜: 평일이면 오늘, 주말이면 다음 주 월요일
  function getInitialDate(today) {
    const day = today.getDay();
    return day === 0 || day === 6 ? getWeekStart(today) : startOfDay(today);
  }

  App.date = {
    toKey: toKey,
    fromKey: fromKey,
    addDays: addDays,
    getWeekStart: getWeekStart,
    getWeekDays: getWeekDays,
    formatTab: formatTab,
    formatWeekRange: formatWeekRange,
    getInitialDate: getInitialDate
  };
})();
