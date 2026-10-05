/**
 * Aanira Milk - Dynamic Date & Month Utility
 * Provides dynamic month generation, ISO date formatting, and month labeling
 * without any hardcoded dates or years.
 */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Returns today's ISO date string: 'YYYY-MM-DD'
 */
export const getTodayIso = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Returns current year-month string: 'YYYY-MM'
 */
export const getCurrentYearMonth = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

/**
 * Converts 'YYYY-MM' to readable full label (e.g., '2026-10' -> 'October 2026')
 */
export const formatYearMonth = (yearMonthStr) => {
  if (!yearMonthStr || typeof yearMonthStr !== 'string') {
    return formatYearMonth(getCurrentYearMonth());
  }

  const parts = yearMonthStr.split('-');
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12 && !isNaN(year)) {
      return `${MONTH_NAMES[monthIndex]} ${year}`;
    }
  }
  return yearMonthStr;
};

/**
 * Converts 'YYYY-MM' to short label (e.g., '2026-10' -> 'Oct 2026' or 'Oct')
 */
export const formatShortYearMonth = (yearMonthStr, includeYear = true) => {
  if (!yearMonthStr || typeof yearMonthStr !== 'string') return '';
  const parts = yearMonthStr.split('-');
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12 && !isNaN(year)) {
      return includeYear ? `${MONTH_NAMES_SHORT[monthIndex]} ${year}` : MONTH_NAMES_SHORT[monthIndex];
    }
  }
  return yearMonthStr;
};

/**
 * Converts 'YYYY-MM-DD' to 'DD-MM-YYYY'
 */
export const formatDisplayDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') {
    return formatDisplayDate(getTodayIso());
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

/**
 * Generates dynamic months list around current date and any existing delivery dates.
 * @param {Array} deliveries - Optional array of deliveries to include any historic months
 * @param {string} ensureMonth - Optional specific month 'YYYY-MM' that must be in the list
 * @param {number} pastMonthsCount - Number of past months to include (default 8)
 * @param {number} futureMonthsCount - Number of future months to include (default 1)
 * @returns {Array<{label: string, shortLabel: string, value: string, isCurrent: boolean}>}
 */
export const getAvailableMonths = (
  deliveries = [],
  ensureMonth = null,
  pastMonthsCount = 8,
  futureMonthsCount = 0
) => {
  const monthSet = new Set();
  const now = new Date();
  const currentYm = getCurrentYearMonth();

  // 1. Generate range from futureMonthsCount down to pastMonthsCount
  for (let i = -pastMonthsCount; i <= futureMonthsCount; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    monthSet.add(`${yyyy}-${mm}`);
  }

  // 2. Add ensureMonth if specified
  if (ensureMonth && typeof ensureMonth === 'string' && ensureMonth.length === 7) {
    monthSet.add(ensureMonth);
  }

  // 3. Add any historical months present in deliveries
  if (Array.isArray(deliveries)) {
    deliveries.forEach((del) => {
      if (del && del.date && del.date.length >= 7) {
        const ym = del.date.substring(0, 7);
        monthSet.add(ym);
      }
    });
  }

  // 4. Sort descending (newest / future first down to oldest)
  const sortedValues = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

  return sortedValues.map((ym) => {
    return {
      label: formatYearMonth(ym),
      shortLabel: formatShortYearMonth(ym, true),
      monthName: formatShortYearMonth(ym, false),
      value: ym,
      isCurrent: ym === currentYm,
    };
  });
};
