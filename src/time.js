// -----------------------------------------------------------------------------
// Calendar-date helpers, in the container time zone. The Gladys supervisor
// injects TZ, the time zone of Gladys: the window of a calendar and the
// "episode today" of the scenes are LOCAL days, across daylight saving changes.
// -----------------------------------------------------------------------------

const pad = (number) => String(number).padStart(2, '0');

/** `YYYY-MM-DD` of a timestamp or Date, read in the local time zone. */
export function localDate(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD`, `days` calendar days after (or before) `dateString`. */
export function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  return localDate(new Date(year, month - 1, day + days));
}

/** Whole calendar days from `fromDate` to `toDate` (`YYYY-MM-DD`), DST-safe. */
export function daysBetween(fromDate, toDate) {
  const [y1, m1, d1] = fromDate.split('-').map(Number);
  const [y2, m2, d2] = toDate.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Timestamp of a local wall-clock time. A time skipped by the spring change
 * (02:30 on the last Sunday of March in Paris) is moved forward by the hour
 * the clocks jump, the rule of the JavaScript Date.
 * @param {string} dateString `YYYY-MM-DD`
 * @param {number} minutes minutes after midnight, 0-1439
 */
export function localTime(dateString, minutes) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60).getTime();
}
