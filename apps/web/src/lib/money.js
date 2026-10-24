// Integer-paise money helpers shared by the customer and reception screens
// (Bug #28). Floats like 0.1 * 3 must never reach the UI or the server.

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export const toPaise = (rupees) => Math.round(toNumber(rupees) * 100)
export const toRupees = (paise) => Math.round(paise) / 100

/** Line total in rupees, computed in paise. */
export const lineTotal = (item) =>
  toRupees(toPaise(item.price) * Math.round(toNumber(item.quantity)))

/** Sum of rupee values, computed in paise. */
export const sumRupees = (values) =>
  toRupees(values.reduce((sum, value) => sum + toPaise(value), 0))
