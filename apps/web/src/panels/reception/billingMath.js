// Settlement preview for the receptionist screens. Mirrors
// backend/src/services/billing.js EXACTLY (same integer-paise maths, same
// rounding), so what the cashier sees is what the server will check against
// (Bug #40). If you change one file, change the other.

import { toPaise, toRupees, lineTotal, sumRupees } from '../../lib/money.js'

export { toPaise, toRupees, lineTotal, sumRupees }

// Keep in sync with RECEPTIONIST_MAX_DISCOUNT_PERCENT on the backend.
export const RECEPTIONIST_MAX_DISCOUNT_PERCENT = 10

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const percentOfPaise = (basePaise, percent) => Math.round((basePaise * percent) / 100)

/**
 * @param subtotalRupees  bill subtotal, rupees
 * @param form            { discountAmount, paymentMode, paymentReference, notes }
 * @param config          { defaultGstPercent, defaultServiceCharge } from restaurant settings
 */
export function buildSettlementPreview(subtotalRupees, form, config = {}) {
  const subtotalPaise = toPaise(subtotalRupees)
  const discountPaise = Math.min(Math.max(toPaise(form.discountAmount), 0), subtotalPaise)
  const serviceChargePaise = Math.max(toPaise(config.defaultServiceCharge), 0)
  const gstPercent = Math.max(toNumber(config.defaultGstPercent), 0)
  const taxablePaise = Math.max(subtotalPaise - discountPaise + serviceChargePaise, 0)
  const gstPaise = percentOfPaise(taxablePaise, gstPercent)

  return {
    subtotal: toRupees(subtotalPaise),
    discountAmount: toRupees(discountPaise),
    serviceChargeAmount: toRupees(serviceChargePaise),
    gstPercent,
    gstAmount: toRupees(gstPaise),
    payableAmount: toRupees(taxablePaise + gstPaise),
    paymentMode: form.paymentMode,
    paymentReference: form.paymentReference || '',
    notes: form.notes || '',
  }
}

/** Largest discount a receptionist can apply without admin approval (rupees). */
export const discountCapRupees = (subtotalRupees) =>
  toRupees(percentOfPaise(toPaise(subtotalRupees), RECEPTIONIST_MAX_DISCOUNT_PERCENT))
