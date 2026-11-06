/**
 * Aanira Milk - Formatting Utilities
 */

/**
 * Formats milk quantity with exact value (up to 2 decimal places, no unwanted rounding to 1 decimal):
 * Examples:
 * 47 -> "47"
 * 47.25 -> "47.25"
 * 47.5 -> "47.5"
 * 47.75 -> "47.75"
 * 48 -> "48"
 * 0 -> "0"
 */
export const formatMilkQty = (qty) => {
  if (qty === null || qty === undefined || isNaN(Number(qty))) return '0';
  const num = Number(qty);
  // Round to 2 decimal places to eliminate floating point binary representation inaccuracies
  const rounded = Math.round(num * 100) / 100;
  return String(rounded);
};

