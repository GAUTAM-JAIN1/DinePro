/**
 * Format currency utility
 * Formats numbers as Indian Rupees (₹)
 */

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencySimple(amount) {
  return `₹${parseFloat(amount).toFixed(2)}`
}
