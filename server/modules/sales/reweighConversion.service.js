import { query, getConnection } from '../../config/database.js'
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors.js'

/**
 * Robust business-account detector — mirrors the same helper in reassignment.service.js.
 * The payment_methods.code in this database is 'business' (not 'business_account'),
 * so a strict === 'business_account' check silently evaluates to false and skips the
 * credit update. This helper accepts any recognisable variant.
 */
const isBusinessPaymentMethod = (payment) => {
  const code = String(payment?.method_code || payment?.payment_method_code || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')

  return Number(payment?.method_id) === 3 ||
    code === 'business' ||
    code === 'business_account' ||
    code.includes('business')
}

// ── public API ───────────────────────────────────────────────

/**
 * Return all active products for the reweigh product selector.
 */
export const getReweighProducts = async () => {
  return await query(
    `SELECT p.product_id, p.code, p.name, p.unit, p.taxable, p.default_price,
            t.percent AS tax_percent
     FROM products p
     LEFT JOIN tax_rates t ON p.default_tax_rate_id = t.tax_rate_id AND t.is_active = 1
     WHERE p.is_active = 1
     ORDER BY p.name`
  )
}

/**
 * Convert an existing Weigh sale to Reweigh.
 *
 * Business rules:
 *  - Sale must not already be is_reweigh=1 or cancelled/voided
 *  - No non-voided AR payment allocations may exist
 *  - Original ticket must exist, belong to same customer + same vehicle plates
 *  - Time window from settings.reweigh.window_minutes is enforced if configured
 *  - Product/tax/total are recalculated with new product
 *  - Payment record is updated; credit adjusted for business_account PENDING payments
 *  - Full before/after snapshot written to sale_reweigh_conversions
 *
 * @param {string} saleUid  - UUID of the sale being converted
 * @param {object} payload  - { original_ticket_number, product_id, new_fee, notes }
 * @param {number} userId   - req.user.userId (JWT)
 */
export const convertToReweigh = async (saleUid, payload, userId) => {
  const { original_ticket_number, product_id, new_fee, notes } = payload

  if (!product_id) throw new BadRequestError('Reweigh product is required.')

  const feeVal = parseFloat(new_fee)
  if (isNaN(feeVal) || feeVal < 0) {
    throw new BadRequestError('Service fee must be a non-negative number.')
  }

  // ── Normalize ticket number: digits only ─────────────────────
  const rawTicket = String(original_ticket_number ?? '')
  const origTicketNum = rawTicket.replace(/\D/g, '')

  console.log('[reweigh] ticket raw:       ', JSON.stringify(rawTicket))
  console.log('[reweigh] ticket sanitized: ', JSON.stringify(origTicketNum))
  console.log('[reweigh] WHERE ticket_number =', origTicketNum)

  if (!origTicketNum) {
    throw new BadRequestError('Original ticket number is required (digits only).')
  }

  const conn = await getConnection()

  try {
    await conn.beginTransaction()

    // ── 1. Lock + load the sale to convert ────────────────────
    const [saleRows] = await conn.query(
      `SELECT s.sale_id, s.sale_uid, s.subtotal, s.tax_total, s.total,
              s.amount_paid, s.balance_due, s.is_reweigh, s.customer_id,
              s.occurred_at, s.created_at,
              st.code AS status_code
       FROM sales s
       LEFT JOIN status_catalogo st ON s.sale_status_id = st.status_id
       WHERE s.sale_uid = ?
       FOR UPDATE`,
      [saleUid]
    )
    if (saleRows.length === 0) throw new NotFoundError('Sale not found.')
    const sale = saleRows[0]

    // ── 2. Eligibility checks ──────────────────────────────────
    const invalidStatuses = ['CANCELLED', 'VOID', 'VOIDED', 'REFUNDED']
    if (invalidStatuses.includes((sale.status_code || '').toUpperCase())) {
      throw new BadRequestError('This sale cannot be converted — it is cancelled or voided.')
    }
    if (sale.is_reweigh === 1) {
      throw new BadRequestError('This sale is already marked as Reweigh.')
    }

    // ── 3. AR payment block (exact pattern from reassignment.service.js) ──
    const [arCheck] = await conn.query(
      `SELECT COUNT(*) AS cnt
       FROM ar_payment_allocations apa
       INNER JOIN ar_payments ap ON apa.ar_payment_id = ap.ar_payment_id
       INNER JOIN payments p ON apa.payment_uid COLLATE utf8mb4_general_ci = p.payment_uid
       WHERE p.sale_uid = ?
         AND ap.status != 'VOIDED'`,
      [saleUid]
    )
    if (arCheck[0].cnt > 0) {
      throw new ConflictError(
        'This sale cannot be converted because it has AR payments applied. ' +
        'Contact accounting to reverse the AR allocation first.'
      )
    }

    // ── 4. Load current driver info ────────────────────────────
    const [driverRows] = await conn.query(
      `SELECT account_number, vehicle_plates FROM sale_driver_info WHERE sale_uid = ?`,
      [saleUid]
    )
    if (driverRows.length === 0) throw new NotFoundError('Driver information not found for this sale.')
    const currentDriver = driverRows[0]

    // ── 5. Find original (Weigh) ticket ───────────────────────
    const [origTicketRows] = await conn.query(
      `SELECT ticket_id, ticket_uid, sale_uid AS orig_sale_uid, ticket_number
       FROM tickets
       WHERE ticket_number = ?
       LIMIT 1`,
      [origTicketNum]
    )
    if (origTicketRows.length === 0) {
      throw new NotFoundError(`Original ticket "${origTicketNum}" not found.`)
    }
    const origTicket = origTicketRows[0]

    if (origTicket.orig_sale_uid === saleUid) {
      throw new BadRequestError('The original ticket number cannot refer to the same sale being converted.')
    }

    // ── 6. Load original sale ──────────────────────────────────
    const [origSaleRows] = await conn.query(
      `SELECT s.sale_id, s.sale_uid, s.is_reweigh, s.occurred_at, s.created_at,
              st.code AS status_code
       FROM sales s
       LEFT JOIN status_catalogo st ON s.sale_status_id = st.status_id
       WHERE s.sale_uid = ?
       FOR UPDATE`,
      [origTicket.orig_sale_uid]
    )
    if (origSaleRows.length === 0) throw new NotFoundError('Original sale not found.')
    const origSale = origSaleRows[0]

    if (invalidStatuses.includes((origSale.status_code || '').toUpperCase())) {
      throw new BadRequestError('The original ticket belongs to a cancelled or voided sale.')
    }
    if (origSale.is_reweigh === 1) {
      throw new BadRequestError('The original ticket is already a Reweigh sale.')
    }

    // ── 7. Validate same customer + same vehicle plates ────────
    const [origDriverRows] = await conn.query(
      `SELECT account_number, vehicle_plates FROM sale_driver_info WHERE sale_uid = ?`,
      [origTicket.orig_sale_uid]
    )
    if (origDriverRows.length === 0) {
      throw new NotFoundError('Driver information not found for the original ticket.')
    }

    const origDriver = origDriverRows[0]

    const currentAccount = String(currentDriver.account_number ?? '').trim()
    const originalAccount = String(origDriver.account_number ?? '').trim()

    const currentPlates = String(currentDriver.vehicle_plates ?? '').trim().toUpperCase()
    const originalPlates = String(origDriver.vehicle_plates ?? '').trim().toUpperCase()

    const shouldValidateAccount = currentAccount !== '' && originalAccount !== ''

    // Solo validar cuenta cuando AMBOS tickets tengan account_number
    if (shouldValidateAccount && currentAccount !== originalAccount) {
      throw new BadRequestError(
        `Customer mismatch. Current sale: "${currentAccount}", ` +
        `original ticket: "${originalAccount}".`
      )
    }

    // Las placas siguen siendo obligatorias para validar el repesaje
    if (currentPlates !== originalPlates) {
      throw new BadRequestError(
        `Vehicle plates mismatch. Current sale: "${currentPlates}", ` +
        `original ticket: "${originalPlates}".`
      )
    }

    // ── 8. Time window check (skip if setting not configured) ──
    const [settingRows] = await conn.query(
      `SELECT value FROM settings WHERE \`key\` = 'reweigh.window_minutes' LIMIT 1`
    )
    if (settingRows.length > 0 && settingRows[0].value) {
      const windowMinutes = parseInt(settingRows[0].value, 10)
      if (!isNaN(windowMinutes) && windowMinutes > 0) {
        const origDate = new Date(origSale.occurred_at || origSale.created_at)
        const currentDate = new Date(sale.occurred_at || sale.created_at)
        const diffMinutes = Math.abs(currentDate.getTime() - origDate.getTime()) / 60000
        if (diffMinutes > windowMinutes) {
          throw new BadRequestError(
            `Reweigh must occur within ${windowMinutes} minutes of the original weigh. ` +
            `Time difference: ${Math.round(diffMinutes)} minutes.`
          )
        }
      }
    }

    // ── 9. Load current sale_line (for audit: from_product_id/name) ──
    const [fromLineRows] = await conn.query(
      `SELECT sl.product_id, p.name AS product_name
       FROM sale_lines sl
       INNER JOIN products p ON sl.product_id = p.product_id
       WHERE sl.sale_uid = ?
       LIMIT 1`,
      [saleUid]
    )
    const fromProductId = fromLineRows.length > 0 ? fromLineRows[0].product_id : null
    const fromProductName = fromLineRows.length > 0 ? fromLineRows[0].product_name : null

    // ── 10. Load reweigh product ───────────────────────────────
    const [prodRows] = await conn.query(
      `SELECT p.product_id, p.name, p.unit, p.taxable,
              t.percent AS tax_percent
       FROM products p
       LEFT JOIN tax_rates t ON p.default_tax_rate_id = t.tax_rate_id AND t.is_active = 1
       WHERE p.product_id = ? AND p.is_active = 1`,
      [product_id]
    )
    if (prodRows.length === 0) throw new NotFoundError('Reweigh product not found or inactive.')
    const reweighProduct = prodRows[0]

    // ── 11. Calculate new amounts ──────────────────────────────
    const oldSubtotal = parseFloat(sale.subtotal)
    const oldTaxTotal = parseFloat(sale.tax_total)
    const oldTotal = parseFloat(sale.total)

    const newSubtotal = parseFloat(feeVal.toFixed(2))
    const taxPct = parseFloat(reweighProduct.tax_percent) || 0
    const newTaxTotal = reweighProduct.taxable
      ? parseFloat((newSubtotal * taxPct / 100).toFixed(2))
      : 0
    const newTotal = parseFloat((newSubtotal + newTaxTotal).toFixed(2))

    // ── 12. Load payment record ────────────────────────────────
    const [payRows] = await conn.query(
      `SELECT p.payment_id, p.payment_uid, p.amount, p.amount_applied,
              pm.code AS method_code,
              ps.code AS payment_status_code
       FROM payments p
       INNER JOIN payment_methods pm ON p.method_id = pm.method_id
       INNER JOIN status_catalogo ps ON p.payment_status_id = ps.status_id
       WHERE p.sale_uid = ?
       ORDER BY p.payment_id
       LIMIT 1`,
      [saleUid]
    )
    if (payRows.length === 0) throw new NotFoundError('Payment record not found for this sale.')
    const payment = payRows[0]

    const isBusinessAccount = isBusinessPaymentMethod(payment)
    const isPaymentPending = payment.payment_status_code === 'PENDING'

    // ── 13. Adjust customer credit if business_account + PENDING ──
    if (isBusinessAccount && isPaymentPending && sale.customer_id) {
      const delta = parseFloat((newTotal - oldTotal).toFixed(2))

      if (delta !== 0) {
        const [ccRows] = await conn.query(
          `SELECT credit_type, current_balance, available_credit
           FROM customer_credit
           WHERE customer_id = ?
           FOR UPDATE`,
          [sale.customer_id]
        )
        if (ccRows.length === 0) throw new NotFoundError('Customer credit record not found.')
        const cc = ccRows[0]

        if (delta > 0 && parseFloat(cc.available_credit) < delta) {
          throw new BadRequestError(
            `Insufficient available credit for the price increase. ` +
            `Additional required: $${delta.toFixed(2)}, ` +
            `available: $${parseFloat(cc.available_credit).toFixed(2)}`
          )
        }

        const balBefore = parseFloat(cc.current_balance)
        const availBefore = parseFloat(cc.available_credit)

        if (cc.credit_type === 'POSTPAID') {
          await conn.query(
            `UPDATE customer_credit
             SET current_balance  = current_balance  + ?,
                 available_credit = available_credit - ?
             WHERE customer_id = ?`,
            [delta, delta, sale.customer_id]
          )
        } else {
          await conn.query(
            `UPDATE customer_credit
             SET available_credit = available_credit - ?
             WHERE customer_id = ?`,
            [delta, sale.customer_id]
          )
        }

        const balAfter = cc.credit_type === 'POSTPAID' ? balBefore + delta : balBefore
        const availAfter = availBefore - delta

        await conn.query(
          `INSERT INTO customer_credit_movements (
             customer_id, sale_uid, movement_type, reference_type, reference_id,
             amount, balance_before, balance_after, available_before, available_after,
             notes, created_by_user
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sale.customer_id, saleUid,
            delta > 0 ? 'REWEIGH_CHARGE_ADJUSTMENT' : 'REWEIGH_CREDIT_ADJUSTMENT',
            'SALE', saleUid,
            Math.abs(delta), balBefore, balAfter, availBefore, availAfter,
            `Reweigh conversion price adjustment (${delta >= 0 ? '+' : ''}${delta.toFixed(2)}) — original ticket ${origTicketNum}`,
            userId
          ]
        )
      }
    }

    // ── 14. UPDATE sales ───────────────────────────────────────
    const newAmountPaid = isBusinessAccount ? 0 : newTotal
    const newBalanceDue = isBusinessAccount ? newTotal : 0

    await conn.query(
      `UPDATE sales
        SET is_reweigh         = 1,
            reweigh_of_sale_id = ?,
            subtotal           = ?,
            tax_total          = ?,
            total              = ?,
            amount_paid        = ?,
            balance_due        = ?,
            updated_at         = NOW()
        WHERE sale_uid = ?`,
      [origSale.sale_uid, newSubtotal, newTaxTotal, newTotal, newAmountPaid, newBalanceDue, saleUid]
    )

    // ── 15. UPDATE sale_lines ──────────────────────────────────
    await conn.query(
      `UPDATE sale_lines
       SET product_id = ?,
           unit       = ?,
           unit_price = ?,
           line_total = ?
       WHERE sale_uid = ?`,
      [product_id, reweighProduct.unit || 'service', newSubtotal, newSubtotal, saleUid]
    )

    // ── 16. UPDATE payments ────────────────────────────────────
    const newAmountApplied = isBusinessAccount ? 0 : newTotal
    await conn.query(
      `UPDATE payments
       SET amount         = ?,
           amount_applied = ?
       WHERE sale_uid = ?`,
      [newTotal, newAmountApplied, saleUid]
    )

    // ── 17. Load ticket_uid for audit record ───────────────────
    const [ticketRows] = await conn.query(
      `SELECT ticket_uid FROM tickets WHERE sale_uid = ? LIMIT 1`,
      [saleUid]
    )
    const ticketUid = ticketRows.length > 0 ? ticketRows[0].ticket_uid : null

    // ── 18. INSERT audit record ────────────────────────────────
    await conn.query(
      `INSERT INTO sale_reweigh_conversions (
         sale_uid, ticket_uid, original_sale_id, original_ticket_number,
         from_product_id, to_product_id,
         from_product_name, to_product_name,
         old_subtotal, old_tax_total, old_total,
         new_subtotal, new_tax_total, new_total,
         notes, changed_by_user
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleUid, ticketUid, origSale.sale_id, origTicketNum,
        fromProductId, product_id,
        fromProductName, reweighProduct.name,
        oldSubtotal, oldTaxTotal, oldTotal,
        newSubtotal, newTaxTotal, newTotal,
        notes || null, userId
      ]
    )

    await conn.commit()

    return {
      sale_uid: saleUid,
      original_ticket_number: origTicketNum,
      old_total: oldTotal,
      new_total: newTotal,
      from_product: fromProductName,
      to_product: reweighProduct.name,
    }

  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

export default { getReweighProducts, convertToReweigh }
