import { query, getConnection } from '../../config/database.js'
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors.js'

/**
 * Ticket Customer Reassignment Service
 *
 * Handles the full transactional flow:
 *  1. Validate sale/ticket eligibility
 *  2. Check no AR payments exist
 *  3. Detect whether the sale payment method is Business Account
 *  4. Validate target customer
 *  5. Adjust credit only for Business Account sales
 *  6. Update sale_driver_info snapshot
 *  7. Insert audit history + credit movements
 */

const formatCurrency = (val) => {
  const n = Number(val) || 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const isBusinessPaymentMethod = (payment) => {
  const code = String(payment?.payment_method_code || payment?.method_code || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')

  return Number(payment?.method_id) === 3 ||
    code === 'business' ||
    code === 'business_account' ||
    code.includes('business')
}

/**
 * List active reassignment reasons (for dropdown)
 */
export const getReasons = async () => {
  return await query(
    `SELECT reassignment_reason_id, code, label
     FROM ticket_reassignment_reasons
     WHERE is_active = 1
     ORDER BY sort_order, label`
  )
}

/**
 * Get reassignment history for a given sale
 */
export const getHistory = async (saleUid) => {
  return await query(
    `SELECT
       r.reassignment_id,
       r.changed_at,
       CASE WHEN r.from_customer_id IS NULL THEN 1 ELSE 0 END AS is_initial_assignment,
       u.full_name AS changed_by_name,
       r.from_account_number, r.from_account_name,
       r.to_account_number,   r.to_account_name,
       r.moved_amount,
       rr.label AS reason_label,
       r.reason_notes
     FROM sale_customer_reassignments r
     LEFT JOIN users u ON r.changed_by_user = u.user_id
     LEFT JOIN ticket_reassignment_reasons rr ON r.reassignment_reason_id = rr.reassignment_reason_id
     WHERE r.sale_uid = ?
     ORDER BY r.changed_at ASC`,
    [saleUid]
  )
}

/**
 * Count reassignments for a sale (used to show/hide history button)
 */
export const getHistoryCount = async (saleUid) => {
  const rows = await query(
    `SELECT COUNT(*) AS cnt FROM sale_customer_reassignments WHERE sale_uid = ?`,
    [saleUid]
  )
  return rows[0].cnt
}

/**
 * Execute the full reassignment inside one DB transaction.
 *
 * @param {string} saleUid
 * @param {object} payload  { newCustomerId, reassignmentReasonId, reasonNotes }
 * @param {number} userId   authenticated user
 */
export const reassignCustomer = async (saleUid, payload, userId) => {
  const { newCustomerId, reassignmentReasonId, reasonNotes } = payload

  if (!newCustomerId) throw new BadRequestError('Target customer is required.')
  if (!reassignmentReasonId) throw new BadRequestError('A reassignment reason is required.')

  const conn = await getConnection()

  try {
    await conn.beginTransaction()

    const [sales] = await conn.query(
      `SELECT s.sale_id, s.sale_uid, s.total, s.sale_status_id,
              s.customer_id,
              st.code AS status_code
       FROM sales s
       LEFT JOIN status_catalogo st ON s.sale_status_id = st.status_id
       WHERE s.sale_uid = ?
       FOR UPDATE`,
      [saleUid]
    )
    if (sales.length === 0) throw new NotFoundError('Ticket not found.')

    const sale = sales[0]

    const ineligibleStatuses = ['CANCELLED', 'VOID', 'VOIDED', 'REFUNDED']
    if (ineligibleStatuses.includes((sale.status_code || '').toUpperCase())) {
      throw new BadRequestError('This ticket is not eligible for customer reassignment.')
    }

    const [driverRows] = await conn.query(
      `SELECT * FROM sale_driver_info WHERE sale_uid = ? FOR UPDATE`,
      [saleUid]
    )
    if (driverRows.length === 0) throw new NotFoundError('Ticket driver info not found.')

    const driverInfo = driverRows[0]
    const sourceSnapshot = {
      account_number: driverInfo.account_number || null,
      account_name: driverInfo.account_name || null,
      account_address: driverInfo.account_address || null,
      account_country: driverInfo.account_country || null,
      account_state: driverInfo.account_state || null
    }

    const [paymentRows] = await conn.query(
      `SELECT p.payment_id, p.method_id, pm.code AS payment_method_code
       FROM payments p
       INNER JOIN payment_methods pm ON p.method_id = pm.method_id
       WHERE p.sale_uid = ?
       ORDER BY p.payment_id
       LIMIT 1`,
      [saleUid]
    )
    if (paymentRows.length === 0) throw new NotFoundError('Payment record not found for this sale.')

    const payment = paymentRows[0]
    const isBusinessPayment = isBusinessPaymentMethod(payment)

    const customerLookupSql = `SELECT c.id_customer, c.account_number, c.account_name,
                                      c.account_address, c.account_country, c.account_state,
                                      c.is_active,
                                      cc.credit_type, cc.credit_limit, cc.current_balance, cc.available_credit,
                                      cc.is_suspended,
                                      CASE WHEN cc.customer_id IS NULL THEN 0 ELSE 1 END AS has_credit_record
                               FROM customers c
                               LEFT JOIN customer_credit cc ON c.id_customer = cc.customer_id`

    let srcCustomer = null

    if (sale.customer_id) {
      const [srcCustomers] = await conn.query(
        `${customerLookupSql}
         WHERE c.id_customer = ?
         FOR UPDATE`,
        [sale.customer_id]
      )
      if (srcCustomers.length === 0) throw new NotFoundError('Source customer not found.')
      srcCustomer = srcCustomers[0]
    } else if (sourceSnapshot.account_number) {
      const [srcCustomers] = await conn.query(
        `${customerLookupSql}
         WHERE c.account_number = ?
         FOR UPDATE`,
        [sourceSnapshot.account_number]
      )
      if (srcCustomers.length === 0) throw new NotFoundError('Source customer not found.')
      srcCustomer = srcCustomers[0]
    }

    if (srcCustomer && srcCustomer.id_customer === Number(newCustomerId)) {
      throw new BadRequestError('Source and target customer cannot be the same.')
    }

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
      throw new ConflictError('This ticket cannot be reassigned because it already has AR payments applied.')
    }

    const [tgtCustomers] = await conn.query(
      `${customerLookupSql}
       WHERE c.id_customer = ?
       FOR UPDATE`,
      [newCustomerId]
    )
    if (tgtCustomers.length === 0) throw new NotFoundError('Target customer not found.')

    const tgtCustomer = tgtCustomers[0]

    if (!tgtCustomer.is_active) {
      throw new BadRequestError('The selected customer is inactive.')
    }

    const movedAmount = parseFloat(sale.total)

    if (isBusinessPayment) {
      if (srcCustomer && !srcCustomer.has_credit_record) {
        throw new NotFoundError('Source customer credit record not found.')
      }
      if (!tgtCustomer.has_credit_record) {
        throw new NotFoundError('Target customer not found or has no credit record.')
      }
      if (tgtCustomer.is_suspended) {
        throw new BadRequestError('The selected customer is suspended and cannot receive new charges.')
      }
      if (parseFloat(tgtCustomer.available_credit) < movedAmount) {
        throw new BadRequestError(
          `Insufficient available credit. Selected customer has ${formatCurrency(tgtCustomer.available_credit)} available, but this ticket requires ${formatCurrency(movedAmount)}.`
        )
      }
    }

    const [reasons] = await conn.query(
      `SELECT reassignment_reason_id
       FROM ticket_reassignment_reasons
       WHERE reassignment_reason_id = ? AND is_active = 1`,
      [reassignmentReasonId]
    )
    if (reasons.length === 0) throw new BadRequestError('Invalid reassignment reason.')

    const [tickets] = await conn.query(
      `SELECT ticket_uid FROM tickets WHERE sale_uid = ? LIMIT 1`,
      [saleUid]
    )
    const ticketUid = tickets.length > 0 ? tickets[0].ticket_uid : null

    let srcBalanceBefore = null
    let srcAvailBefore = null
    let srcBalanceAfter = null
    let srcAvailAfter = null

    if (isBusinessPayment && srcCustomer) {
      srcBalanceBefore = parseFloat(srcCustomer.current_balance)
      srcAvailBefore = parseFloat(srcCustomer.available_credit)

      if (srcCustomer.credit_type === 'POSTPAID') {
        srcBalanceAfter = srcBalanceBefore - movedAmount
        srcAvailAfter = srcAvailBefore + movedAmount
        await conn.query(
          `UPDATE customer_credit
           SET current_balance = current_balance - ?,
               available_credit = available_credit + ?
           WHERE customer_id = ?`,
          [movedAmount, movedAmount, srcCustomer.id_customer]
        )
      } else {
        srcBalanceAfter = srcBalanceBefore
        srcAvailAfter = srcAvailBefore + movedAmount
        await conn.query(
          `UPDATE customer_credit
           SET available_credit = available_credit + ?
           WHERE customer_id = ?`,
          [movedAmount, srcCustomer.id_customer]
        )
      }
    }

    let tgtBalanceBefore = null
    let tgtAvailBefore = null
    let tgtBalanceAfter = null
    let tgtAvailAfter = null

    if (isBusinessPayment) {
      tgtBalanceBefore = parseFloat(tgtCustomer.current_balance)
      tgtAvailBefore = parseFloat(tgtCustomer.available_credit)

      if (tgtCustomer.credit_type === 'POSTPAID') {
        tgtBalanceAfter = tgtBalanceBefore + movedAmount
        tgtAvailAfter = tgtAvailBefore - movedAmount
        await conn.query(
          `UPDATE customer_credit
           SET current_balance = current_balance + ?,
               available_credit = available_credit - ?
           WHERE customer_id = ?`,
          [movedAmount, movedAmount, tgtCustomer.id_customer]
        )
      } else {
        tgtBalanceAfter = tgtBalanceBefore
        tgtAvailAfter = tgtAvailBefore - movedAmount
        await conn.query(
          `UPDATE customer_credit
           SET available_credit = available_credit - ?
           WHERE customer_id = ?`,
          [movedAmount, tgtCustomer.id_customer]
        )
      }
    }

    await conn.query(
      `UPDATE sales SET customer_id = ?, updated_at = NOW() WHERE sale_uid = ?`,
      [tgtCustomer.id_customer, saleUid]
    )

    await conn.query(
      `UPDATE sale_driver_info
       SET account_number = ?,
           account_name = ?,
           account_address = ?,
           account_country = ?,
           account_state = ?
       WHERE sale_uid = ?`,
      [
        tgtCustomer.account_number,
        tgtCustomer.account_name,
        tgtCustomer.account_address || null,
        tgtCustomer.account_country || null,
        tgtCustomer.account_state || null,
        saleUid
      ]
    )

    const fromSnapshot = {
      account_number: sourceSnapshot.account_number || srcCustomer?.account_number || null,
      account_name: sourceSnapshot.account_name || srcCustomer?.account_name || null,
      account_address: sourceSnapshot.account_address || srcCustomer?.account_address || null,
      account_country: sourceSnapshot.account_country || srcCustomer?.account_country || null,
      account_state: sourceSnapshot.account_state || srcCustomer?.account_state || null
    }

    const [histResult] = await conn.query(
      `INSERT INTO sale_customer_reassignments
        (sale_uid, ticket_uid,
         from_customer_id, to_customer_id,
         from_account_number, from_account_name, from_account_address, from_account_country, from_account_state,
         to_account_number, to_account_name, to_account_address, to_account_country, to_account_state,
         sale_total, moved_amount,
         from_credit_type, to_credit_type,
         reassignment_reason_id, reason_notes,
         changed_by_user)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        saleUid, ticketUid,
        srcCustomer?.id_customer || null, tgtCustomer.id_customer,
        fromSnapshot.account_number, fromSnapshot.account_name,
        fromSnapshot.account_address, fromSnapshot.account_country, fromSnapshot.account_state,
        tgtCustomer.account_number, tgtCustomer.account_name,
        tgtCustomer.account_address, tgtCustomer.account_country, tgtCustomer.account_state,
        sale.total, movedAmount,
        isBusinessPayment ? (srcCustomer?.credit_type || null) : null,
        isBusinessPayment ? (tgtCustomer.credit_type || null) : null,
        reassignmentReasonId, reasonNotes || null,
        userId
      ]
    )
    const reassignmentId = histResult.insertId

    if (isBusinessPayment && srcCustomer) {
      await conn.query(
        `INSERT INTO customer_credit_movements
          (customer_id, sale_uid, reassignment_id, movement_type, reference_type, reference_id,
           amount, balance_before, balance_after, available_before, available_after,
           notes, created_by_user)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          srcCustomer.id_customer, saleUid, reassignmentId,
          'SALE_REASSIGN_REVERSAL', 'REASSIGNMENT', String(reassignmentId),
          movedAmount, srcBalanceBefore, srcBalanceAfter, srcAvailBefore, srcAvailAfter,
          `Reversed charge - ticket reassigned to ${tgtCustomer.account_number} / ${tgtCustomer.account_name}`,
          userId
        ]
      )
    }

    if (isBusinessPayment) {
      const targetMovementNote = srcCustomer
        ? `Charge received - ticket reassigned from ${fromSnapshot.account_number || '-'} / ${fromSnapshot.account_name || '-'}`
        : 'Charge received - initial customer assignment'

      await conn.query(
        `INSERT INTO customer_credit_movements
          (customer_id, sale_uid, reassignment_id, movement_type, reference_type, reference_id,
           amount, balance_before, balance_after, available_before, available_after,
           notes, created_by_user)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          tgtCustomer.id_customer, saleUid, reassignmentId,
          'SALE_REASSIGN_CHARGE', 'REASSIGNMENT', String(reassignmentId),
          movedAmount, tgtBalanceBefore, tgtBalanceAfter, tgtAvailBefore, tgtAvailAfter,
          targetMovementNote,
          userId
        ]
      )
    }

    await conn.commit()

    return {
      reassignment_id: reassignmentId,
      sale_uid: saleUid,
      operation_type: srcCustomer ? 'REASSIGNMENT' : 'INITIAL_ASSIGNMENT',
      financial_effect_applied: isBusinessPayment,
      from_account: srcCustomer ? `${srcCustomer.account_number} / ${srcCustomer.account_name}` : null,
      to_account: `${tgtCustomer.account_number} / ${tgtCustomer.account_name}`,
      moved_amount: movedAmount,
      message: srcCustomer
        ? 'Customer reassignment completed successfully.'
        : 'Customer assignment completed successfully.'
    }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

export default { getReasons, getHistory, getHistoryCount, reassignCustomer }
