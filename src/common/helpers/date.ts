/**
 * Calculate the difference between two dates.
 * @param {Date} date1 first date
 * @param {Date} date2 second date
 * @return {[number, string]} array containing the difference and the time unit of measure
 */
export function timeDiff(date1: Date, date2: Date): [number, string] {
  if (!(date1 instanceof Date && date2 instanceof Date))
    throw new RangeError('Invalid date arguments');

  const timeIntervals = [31536000, 2628000, 604800, 86400, 3600, 60, 1];
  const intervalNames = ['year', 'month', 'week', 'day', 'h', 'm', 's'];

  const diff = Math.abs(date2.getTime() - date1.getTime()) / 1000;
  const index = timeIntervals.findIndex(i => (diff / i) >= 1);
  const n = Math.floor(diff / timeIntervals[index]);
  const interval = intervalNames[index];

  return [n, interval];
}

/**
 * Format a date difference into a string.
 * @param {number} value numeric value
 * @param {string} str time unit
 * @return {string} value and unit, taking plurals into account
 */
export function localize(value: number, str: string): string {
  if (!value || !str) return '';

  if (value != 1 && str.length > 1)
    str += 's';

  return `${value}${str}`
}
