import { randomUUID } from 'crypto'
import { getConnection, query } from '../../config/database.js'
import { BadRequestError, NotFoundError } from '../../utils/errors.js'

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Get status_id by module + code (never hardcode IDs).
 * conn is a pool connection already in a transaction.
 */
const getStatusId = async (conn, module, code) => {
  const [rows] = await conn.query(
    `SELECT status_id FROM status_catalogo
     WHERE module = ? AND code = ? AND is_active = 1 LIMIT 1`,
    [module.toUpperCase(), code.toUpperCase()]
  )
  if (!rows || rows.length === 0) {
    throw new BadRequestError(
      `Status ${module}/${code} not found in status_catalogo. Verify catalog data.`
    )
  }
  return rows[0].status_id
}

/**
 * Attempt to resolve a status, returning null if not found (fallback safe).
 */
const tryGetStatusId = async (conn, module, code) => {
  const [rows] = await conn.query(
    `SELECT status_id FROM status_catalogo
     WHERE module = ? AND code = ? AND is_active = 1 LIMIT 1`,
    [module.toUpperCase(), code.toUpperCase()]
  )
  return (rows && rows.length > 0) ? rows[0].status_id : null
}

/**
 * Atomic sequence increment using the system's number_sequences table.
 * Uses SELECT ... FOR UPDATE to prevent concurrent collisions.
 *
 * Assumes number_sequences has columns: site_id, scope, current_value, step, prefix.
 * Verify with: DESCRIBE number_sequences;
 *
 * @param {object} conn   - pool connection already in a transaction
 * @param {string} scope  - 'TICKETS.NUMBER' or 'SALES.RECEIPT'
 * @param {number} siteId - site_id from req.user.siteId (JWT)
 * @returns {string} formatted folio: prefix + zero-padded current_value+step
 */
const getNextSequence = async (conn, scope, siteId) => {
  const [rows] = await conn.query(
    `SELECT current_value, step, prefix
     FROM number_sequences
     WHERE site_id = ? AND scope = ?
     FOR UPDATE`,
    [siteId, scope]
  )
  if (!rows || rows.length === 0) {
    throw new BadRequestError(
      `Sequence '${scope}' not found for site_id ${siteId}. Verify number_sequences table.`
    )
  }
  const row = rows[0]
  const next = Number(row.current_value) + Number(row.step || 1)
  await conn.query(
    `UPDATE number_sequences SET current_value = ? WHERE site_id = ? AND scope = ?`,
    [next, siteId, scope]
  )
  // Pad to 6 digits. If number_sequences has a pad_length column, read it here instead.
  const padded = String(next).padStart(6, '0')
  const prefix = row.prefix || ''
  return `${prefix}${padded}`
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Return catalog data needed by the manual ticket form.
 * Each list is obtained from existing catalog routes/tables.
 */
export const getFormCatalogs = async () => {
  const [products, paymentMethods, driverProducts, vehicleTypes, licenseStates, customers] =
    await Promise.all([
      query(`SELECT product_id, code, name, unit, taxable, default_price,
                    t.percent AS tax_percent
             FROM products p
             LEFT JOIN tax_rates t ON p.default_tax_rate_id = t.tax_rate_id AND t.is_active = 1
             WHERE p.is_active = 1
             ORDER BY p.name`),

      query(`SELECT method_id, code, name, is_cash, allow_reference
             FROM payment_methods
             WHERE is_active = 1
             ORDER BY name`),

      query(`SELECT product_id, code, name
             FROM driver_products
             WHERE is_active = 1
             ORDER BY name`),

      query(`SELECT vehicle_type_id, code, name
             FROM vehicle_types
             WHERE is_active = 1
             ORDER BY name`),

      query(`SELECT id_state, state_code, state_name, country_code
             FROM license_states
             WHERE is_active = 1
             ORDER BY state_name`),

      query(`SELECT c.id_customer AS customer_id, c.account_number, c.account_name, c.has_credit,
                    cc.credit_type, cc.available_credit, cc.credit_limit, cc.is_suspended
             FROM customers c
             LEFT JOIN customer_credit cc ON c.id_customer = cc.customer_id
             WHERE c.is_active = 1
             ORDER BY c.account_name`)
    ])

  return { products, paymentMethods, driverProducts, vehicleTypes, licenseStates, customers }
}

/**
 * Create a complete manual ticket/sale transaction.
 *
 * Inserts: sales, tickets, sale_driver_info, scale_session_axles,
 *          sale_lines, payments, and (if business_account) updates
 *          customer_credit + inserts customer_credit_movements.
 *
 * @param {object} payload  - form data from the web
 * @param {number} userId   - req.user.userId (JWT)
 * @returns {{ sale_id, sale_uid, ticket_number }}
 */
export const createManualTicket = async (payload, userId, siteId) => {
  const {
    occurred_at,          // REQUIRED — ISO datetime string
    customer_id,          // optional (required if business_account)
    product_id,           // REQUIRED
    weigh_fee,            // REQUIRED — pre-tax service fee (decimal)
    driver_first_name,    // REQUIRED
    driver_last_name,     // REQUIRED
    driver_phone,         // optional
    vehicle_plates,       // REQUIRED
    license_number,       // optional
    license_state,        // optional
    tractor_number,       // optional
    trailer_number,       // optional
    driver_product_id,    // optional
    vehicle_type_id,      // optional
    product_description,  // optional — free text snapshot for ticket
    eje1,                 // REQUIRED — axle 1 weight
    eje2,                 // REQUIRED — axle 2 weight
    eje3,                 // optional — axle 3 weight (default 0)
    payment_method_id,    // REQUIRED
    reference_number,     // optional
  } = payload

  // ── Basic input validation ──────────────────────────────────
  if (!occurred_at) throw new BadRequestError('Transaction date/time (occurred_at) is required')
  if (!product_id)  throw new BadRequestError('Product/service (product_id) is required')

  const feeVal = parseFloat(weigh_fee)
  if (isNaN(feeVal) || feeVal < 0) throw new BadRequestError('Service fee (weigh_fee) must be a non-negative number')

  if (!String(driver_first_name || '').trim()) throw new BadRequestError('Driver first name is required')
  if (!String(driver_last_name  || '').trim()) throw new BadRequestError('Driver last name is required')
  if (!String(vehicle_plates    || '').trim()) throw new BadRequestError('Vehicle plates are required')

  const eje1Val = parseFloat(eje1)
  const eje2Val = parseFloat(eje2)
  if (isNaN(eje1Val)) throw new BadRequestError('Axle 1 weight (eje1) is required')
  if (isNaN(eje2Val)) throw new BadRequestError('Axle 2 weight (eje2) is required')
  if (!payment_method_id) throw new BadRequestError('Payment method is required')

  // Validate occurred_at is not in the future
  const occurredDate = new Date(occurred_at)
  if (isNaN(occurredDate.getTime())) throw new BadRequestError('Invalid transaction date/time format')
  if (occurredDate > new Date()) throw new BadRequestError('Transaction date/time cannot be in the future')

  const conn = await getConnection()

  try {
    await conn.beginTransaction()

    // ── Resolve status IDs by code (no hardcoded IDs) ──────────
    const [saleCompletedId, payPendingId, payReceivedId] = await Promise.all([
      getStatusId(conn, 'SALES',    'COMPLETED'),
      getStatusId(conn, 'PAYMENTS', 'PENDING'),
      getStatusId(conn, 'PAYMENTS', 'RECEIVED'),
    ])

    // TICKETS/COMPLETED — fall back to SALES/COMPLETED if not configured
    const ticketCompletedId = await tryGetStatusId(conn, 'TICKETS', 'COMPLETED')
      ?? await tryGetStatusId(conn, 'TICKETS', 'PRINTED')
      ?? saleCompletedId

    // ── Resolve product (for tax calculation and unit snapshot) ─
    const [prodRows] = await conn.query(
      `SELECT p.product_id, p.code, p.name, p.unit, p.taxable, p.default_price,
              t.percent AS tax_percent
       FROM products p
       LEFT JOIN tax_rates t
         ON p.default_tax_rate_id = t.tax_rate_id AND t.is_active = 1
       WHERE p.product_id = ? AND p.is_active = 1`,
      [product_id]
    )
    if (!prodRows || prodRows.length === 0) throw new NotFoundError('Product not found or inactive')
    const product = prodRows[0]

    // ── Calculate amounts ───────────────────────────────────────
    const subtotal  = parseFloat(feeVal.toFixed(2))
    const taxPct    = parseFloat(product.tax_percent) || 0
    const taxTotal  = product.taxable
      ? parseFloat((subtotal * taxPct / 100).toFixed(2))
      : 0
    const total     = parseFloat((subtotal + taxTotal).toFixed(2))

    // ── Resolve payment method ──────────────────────────────────
    const [pmRows] = await conn.query(
      `SELECT method_id, code, name, is_cash
       FROM payment_methods WHERE method_id = ? AND is_active = 1`,
      [payment_method_id]
    )
    if (!pmRows || pmRows.length === 0) throw new NotFoundError('Payment method not found or inactive')
    const paymentMethod     = pmRows[0]
    const isBusinessAccount = paymentMethod.code === 'business_account'

    const amountPaid = isBusinessAccount ? 0    : total
    const balanceDue = isBusinessAccount ? total : 0

    // ── Business account: validate credit ──────────────────────
    let account_number = null
    let account_name   = null

    if (isBusinessAccount) {
      if (!customer_id) throw new BadRequestError('Customer is required when using business account payment')

      const [custCreditRows] = await conn.query(
        `SELECT c.id_customer, c.account_number, c.account_name,
                cc.credit_type, cc.credit_limit,
                cc.current_balance, cc.available_credit,
                cc.is_suspended, cc.suspension_reason
         FROM customers c
         INNER JOIN customer_credit cc ON c.id_customer = cc.customer_id
         WHERE c.id_customer = ? AND c.is_active = 1
         FOR UPDATE`,
        [customer_id]
      )
      if (!custCreditRows || custCreditRows.length === 0) {
        throw new NotFoundError('Customer with credit account not found')
      }
      const cc = custCreditRows[0]

      if (cc.is_suspended) {
        throw new BadRequestError(
          `Customer account is suspended: ${cc.suspension_reason || 'contact administrator'}`
        )
      }
      if (parseFloat(cc.available_credit) < total) {
        throw new BadRequestError(
          `Insufficient available credit. ` +
          `Available: $${parseFloat(cc.available_credit).toFixed(2)}, ` +
          `Required: $${total.toFixed(2)}`
        )
      }

      account_number = cc.account_number
      account_name   = cc.account_name

      // Credit update (POSTPAID: balance up + available down; PREPAID: available down only)
      if (cc.credit_type === 'POSTPAID') {
        await conn.query(
          `UPDATE customer_credit
           SET current_balance  = current_balance  + ?,
               available_credit = available_credit - ?
           WHERE customer_id = ?`,
          [total, total, customer_id]
        )
      } else {
        await conn.query(
          `UPDATE customer_credit
           SET available_credit = available_credit - ?
           WHERE customer_id = ?`,
          [total, customer_id]
        )
      }

      // Credit movement ledger (same pattern as reassignment.service.js)
      const balBefore  = parseFloat(cc.current_balance)
      const availBefore = parseFloat(cc.available_credit)
      const balAfter   = cc.credit_type === 'POSTPAID' ? balBefore + total : balBefore
      const availAfter = availBefore - total

      await conn.query(
        `INSERT INTO customer_credit_movements (
           customer_id, sale_uid, movement_type, reference_type, reference_id,
           amount, balance_before, balance_after, available_before, available_after,
           notes, created_by_user
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customer_id,
          null,  // sale_uid filled in below via UPDATE after insert — avoids chicken-egg
          'MANUAL_TICKET_CHARGE', 'SALE', null,
          total, balBefore, balAfter, availBefore, availAfter,
          `Manual ticket charge — pending ticket assignment`,
          userId
        ]
      )

    } else if (customer_id) {
      // Cash/card with customer: snapshot name for driver info
      const [custRows] = await conn.query(
        `SELECT account_number, account_name
         FROM customers WHERE id_customer = ? AND is_active = 1`,
        [customer_id]
      )
      if (custRows && custRows.length > 0) {
        account_number = custRows[0].account_number
        account_name   = custRows[0].account_name
      }
    }

    // ── Generate UUIDs ──────────────────────────────────────────
    const saleUid    = randomUUID()
    const ticketUid  = randomUUID()
    const paymentUid = randomUUID()
    const uuidWeight = randomUUID()  // links sale_driver_info.match_key ↔ scale_session_axles.uuid_weight

    // ── Atomic sequence numbers (number_sequences, FOR UPDATE) ─
    // receipt_number → SALES.RECEIPT sequence (goes into sales table)
    // ticket_number  → TICKETS.NUMBER sequence (goes into tickets table)
    const receiptNumber = await getNextSequence(conn, 'SALES.RECEIPT',   siteId)
    const ticketNumber  = await getNextSequence(conn, 'TICKETS.NUMBER',   siteId)

    // ── Calculate axle weights ──────────────────────────────────
    const axle1     = parseFloat(eje1Val.toFixed(2))
    const axle2     = parseFloat(eje2Val.toFixed(2))
    const axle3     = parseFloat(parseFloat(eje3 || 0).toFixed(2))
    const pesoTotal = parseFloat((axle1 + axle2 + axle3).toFixed(2))

    // ── INSERT sales ────────────────────────────────────────────
    await conn.query(
      `INSERT INTO sales (
         sale_uid, receipt_number, sale_status_id,
         subtotal, discount_total, tax_total, total,
         amount_paid, balance_due, currency,
         reweigh_of_sale_id, is_reweigh,
         occurred_at, operator_id, customer_id,
         capture_source, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        saleUid, receiptNumber, saleCompletedId,
        subtotal, 0, taxTotal, total,
        amountPaid, balanceDue, 'USD',
        null, 0,
        occurred_at, userId, customer_id || null,
        'WEB_MANUAL'
      ]
    )

    const [[newSale]] = await conn.query(
      'SELECT sale_id FROM sales WHERE sale_uid = ? LIMIT 1', [saleUid]
    )
    const saleId = newSale.sale_id

    // ── Back-fill sale_uid on the credit movement (if any) ─────
    if (isBusinessAccount) {
      await conn.query(
        `UPDATE customer_credit_movements
         SET sale_uid = ?, reference_id = ?
         WHERE customer_id = ? AND sale_uid IS NULL
         ORDER BY movement_id DESC LIMIT 1`,
        [saleUid, saleUid, customer_id]
      )
    }

    // ── INSERT tickets ──────────────────────────────────────────
    await conn.query(
      `INSERT INTO tickets (
         ticket_uid, sale_uid, ticket_number,
         ticket_status_id, printed_at, reprint_count
       ) VALUES (?, ?, ?, ?, ?, 0)`,
      [ticketUid, saleUid, ticketNumber, ticketCompletedId, occurred_at]
    )

    // ── INSERT sale_driver_info ─────────────────────────────────
    await conn.query(
      `INSERT INTO sale_driver_info (
         sale_uid, account_number, account_name,
         driver_first_name, driver_last_name, driver_phone,
         vehicle_plates, license_number, license_state,
         tractor_number, trailer_number,
         driver_product_id, vehicle_type_id,
         match_key, product_description, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        saleUid,
        account_number, account_name,
        String(driver_first_name).trim(),
        String(driver_last_name).trim(),
        driver_phone    || null,
        String(vehicle_plates).trim(),
        license_number  || null,
        license_state   || null,
        tractor_number  || null,
        trailer_number  || null,
        driver_product_id || null,
        vehicle_type_id   || null,
        uuidWeight,
        product_description || null
      ]
    )

    // ── INSERT scale_session_axles ──────────────────────────────
    await conn.query(
      `INSERT INTO scale_session_axles (
         uuid_weight, eje1, eje2, eje3, peso_total, weight_lb,
         captured_local, operator_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidWeight,
        axle1, axle2, axle3, pesoTotal,
        pesoTotal,   // weight_lb = peso_total (scale unit is lb in this system)
        occurred_at,
        userId
      ]
    )

    // ── INSERT sale_lines ───────────────────────────────────────
    // unit_price and line_total = subtotal (pre-tax fee, consistent with dashboard SUM)
    await conn.query(
      `INSERT INTO sale_lines (
         sale_uid, product_id, seq, qty, unit, unit_price, line_total
       ) VALUES (?, ?, 1, 1, ?, ?, ?)`,
      [
        saleUid,
        product_id,
        product.unit || 'service',
        subtotal,
        subtotal
      ]
    )

    // ── INSERT payments ─────────────────────────────────────────
    const paymentStatusId = isBusinessAccount ? payPendingId  : payReceivedId
    const receivedAt      = isBusinessAccount ? null          : occurred_at
    const amountApplied   = isBusinessAccount ? 0             : total

    await conn.query(
      `INSERT INTO payments (
         payment_uid, sale_uid, method_id, amount, amount_applied,
         payment_status_id, received_at, reference_number
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentUid, saleUid,
        payment_method_id, total, amountApplied,
        paymentStatusId, receivedAt,
        reference_number || null
      ]
    )

    // ── COMMIT ──────────────────────────────────────────────────
    await conn.commit()

    return {
      sale_id:       saleId,
      sale_uid:      saleUid,
      ticket_number: ticketNumber,
      total,
    }

  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

export default { getFormCatalogs, createManualTicket }
