import { randomUUID } from 'crypto'
import * as ArModel from './ar.model.js'
import { query, getConnection } from '../../config/database.js'
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors.js'

const PAYMENT_STATUS = {
  PENDING: 5,
  RECEIVED: 6
}

/**
 * Get customers with credit for dropdown
 */
export const getCustomersWithCredit = async () => {
  return await ArModel.getCustomersWithCredit()
}

/**
 * Get customer summary with last payment info
 */
export const getCustomerSummary = async (customerId) => {
  const customer = await ArModel.getCustomerSummary(customerId)
  
  if (!customer) {
    throw new NotFoundError('Customer not found')
  }
  
  const lastPayment = await ArModel.getLastPayment(customerId)
  const pendingTransactions = await ArModel.getPendingTransactions(customerId)
  const totalPending = pendingTransactions.reduce((sum, t) => sum + parseFloat(t.pending_amount), 0)
  
  return {
    ...customer,
    last_payment: lastPayment,
    total_pending: totalPending,
    pending_count: pendingTransactions.length
  }
}

/**
 * Get pending transactions for customer
 */
export const getPendingTransactions = async (customerId) => {
  const customer = await ArModel.getCustomerSummary(customerId)
  
  if (!customer) {
    throw new NotFoundError('Customer not found')
  }
  
  const transactions = await ArModel.getPendingTransactions(customerId)
  
  const totals = {
    count: transactions.length,
    total_original: transactions.reduce((sum, t) => sum + parseFloat(t.original_amount), 0),
    total_applied: transactions.reduce((sum, t) => sum + parseFloat(t.amount_applied), 0),
    total_pending: transactions.reduce((sum, t) => sum + parseFloat(t.pending_amount), 0)
  }
  
  const aging = {
    current: transactions.filter(t => t.aging_bucket === 'CURRENT').reduce((sum, t) => sum + parseFloat(t.pending_amount), 0),
    '31_60': transactions.filter(t => t.aging_bucket === '31-60').reduce((sum, t) => sum + parseFloat(t.pending_amount), 0),
    '61_90': transactions.filter(t => t.aging_bucket === '61-90').reduce((sum, t) => sum + parseFloat(t.pending_amount), 0),
    '90_plus': transactions.filter(t => t.aging_bucket === '90+').reduce((sum, t) => sum + parseFloat(t.pending_amount), 0)
  }
  
  return { transactions, totals, aging }
}

/**
 * Get payment methods for A/R
 */
export const getPaymentMethods = async () => {
  return await ArModel.getPaymentMethods()
}

/**
 * Apply payment - Main function (FIFO, Manual, or Credit Balance)
 */
export const applyPayment = async (data, userId) => {
  const { 
    customer_id, 
    payment_date, 
    method_id, 
    reference_number,
    amount_received,
    apply_method,
    allocations,
    notes,
    is_credit_balance = false  // Nueva opción para marcar como saldo a favor
  } = data
  
  // Validate customer
  const customer = await ArModel.getCustomerSummary(customer_id)
  if (!customer) {
    throw new NotFoundError('Customer not found')
  }
  
  // MEJORA 1: Se eliminó la validación de cuenta suspendida
  // Los usuarios de contabilidad PUEDEN agregar pagos aunque la cuenta esté suspendida
  
  // Validate amount
  if (!amount_received || amount_received <= 0) {
    throw new BadRequestError('Amount received must be greater than 0')
  }
  
  // MEJORA 2: Permitir CREDIT_BALANCE solo para clientes PREPAID
  if (is_credit_balance) {
    if (customer.credit_type !== 'PREPAID') {
      throw new BadRequestError('Credit balance payments are only allowed for PREPAID customers')
    }
    
    // Para CREDIT_BALANCE, no necesitamos pending transactions ni allocations
    return await applyCreditBalancePayment({
      customer_id,
      customer,
      payment_date,
      method_id,
      reference_number,
      amount_received,
      notes,
      userId
    })
  }
  
  // Flujo normal: requiere pending transactions
  const pending = await ArModel.getPendingTransactions(customer_id)
  if (pending.length === 0) {
    throw new BadRequestError('No pending transactions found for this customer')
  }
  
  // Calculate allocations
  let finalAllocations = []
  let totalApplied = 0
  
  if (apply_method === 'FIFO') {
    let remaining = parseFloat(amount_received)
    
    for (const transaction of pending) {
      if (remaining <= 0) break
      
      const pendingAmount = parseFloat(transaction.pending_amount)
      const toApply = Math.min(remaining, pendingAmount)
      
      finalAllocations.push({
        sale_uid: transaction.sale_uid,
        payment_uid: transaction.payment_uid,
        ticket_uid: transaction.ticket_uid,
        ticket_number: transaction.ticket_number,
        amount_applied: toApply,
        original_pending: pendingAmount
      })
      
      totalApplied += toApply
      remaining -= toApply
    }
  } else {
    // Manual mode
    if (!allocations || allocations.length === 0) {
      throw new BadRequestError('Manual mode requires allocations')
    }
    
    for (const alloc of allocations) {
      const transaction = pending.find(t => t.payment_uid === alloc.payment_uid)
      
      if (!transaction) {
        throw new BadRequestError(`Transaction ${alloc.payment_uid} not found or not pending`)
      }
      
      const pendingAmount = parseFloat(transaction.pending_amount)
      const toApply = parseFloat(alloc.amount)
      
      if (toApply <= 0) {
        throw new BadRequestError('Allocation amount must be greater than 0')
      }
      
      if (toApply > pendingAmount) {
        throw new BadRequestError(`Cannot apply $${toApply} to ticket ${transaction.ticket_number}. Pending amount is $${pendingAmount}`)
      }
      
      finalAllocations.push({
        sale_uid: transaction.sale_uid,
        payment_uid: transaction.payment_uid,
        ticket_uid: transaction.ticket_uid,
        ticket_number: transaction.ticket_number,
        amount_applied: toApply,
        original_pending: pendingAmount
      })
      
      totalApplied += toApply
    }
    
    if (totalApplied > parseFloat(amount_received)) {
      throw new BadRequestError(`Total allocations ($${totalApplied}) exceed amount received ($${amount_received})`)
    }
  }
  
  const amountUnapplied = parseFloat(amount_received) - totalApplied
  const status = totalApplied > 0 ? 'APPLIED' : 'PARTIAL'
  
  // Execute transaction
  const connection = await getConnection()
  
  try {
    await connection.beginTransaction()
    
    // 1. Create A/R payment header
    const [arPaymentResult] = await connection.query(
      `INSERT INTO ar_payments (
        customer_id, payment_date, method_id, reference_number,
        amount_received, amount_applied, apply_method, status,
        notes, created_by_user
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id,
        payment_date,
        method_id,
        reference_number || null,
        amount_received,
        totalApplied,
        apply_method,
        status,
        notes || null,
        userId
      ]
    )
    
    const arPaymentId = arPaymentResult.insertId
    
    // 2. Create allocations and update payments
    for (const alloc of finalAllocations) {
      await connection.query(
        `INSERT INTO ar_payment_allocations (
          ar_payment_id, sale_uid, payment_uid, ticket_uid, ticket_number, amount_applied,
          active_ticket_uid
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [arPaymentId, alloc.sale_uid, alloc.payment_uid, alloc.ticket_uid, alloc.ticket_number, alloc.amount_applied,
         alloc.ticket_uid]
      )
      
      await connection.query(
        `UPDATE payments SET amount_applied = amount_applied + ? WHERE payment_uid = ?`,
        [alloc.amount_applied, alloc.payment_uid]
      )
      
      const newPending = alloc.original_pending - alloc.amount_applied
      if (newPending <= 0.01) {
        await connection.query(
          `UPDATE payments SET payment_status_id = ? WHERE payment_uid = ?`,
          [PAYMENT_STATUS.RECEIVED, alloc.payment_uid]
        )
      }
    }
    
    // 3. Update customer credit
    if (customer.credit_type === 'POSTPAID') {
      await connection.query(
        `UPDATE customer_credit 
         SET current_balance = current_balance - ?,
             available_credit = available_credit + ?,
             last_payment_date = NOW()
         WHERE customer_id = ?`,
        [totalApplied, totalApplied, customer_id]
      )
    } else {
      await connection.query(
        `UPDATE customer_credit 
         SET available_credit = available_credit + ?,
             last_payment_date = NOW()
         WHERE customer_id = ?`,
        [totalApplied, customer_id]
      )
    }
    
    await connection.commit()
    
    return {
      ar_payment_id: arPaymentId,
      amount_received: parseFloat(amount_received),
      amount_applied: totalApplied,
      amount_unapplied: amountUnapplied,
      allocations_count: finalAllocations.length,
      status,
      message: amountUnapplied > 0 
        ? `Payment applied. $${amountUnapplied.toFixed(2)} unapplied (overpayment).`
        : 'Payment applied successfully.'
    }
    
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Apply Credit Balance Payment (PREPAID customers only)
 * Este tipo de pago NO se asigna a ningún ticket - es saldo a favor para futuras compras
 */
const applyCreditBalancePayment = async (data) => {
  const {
    customer_id,
    customer,
    payment_date,
    method_id,
    reference_number,
    amount_received,
    notes,
    userId
  } = data
  
  const connection = await getConnection()
  
  try {
    await connection.beginTransaction()
    
    // 1. Create A/R payment with CREDIT_BALANCE status
    const [arPaymentResult] = await connection.query(
      `INSERT INTO ar_payments (
        customer_id, payment_date, method_id, reference_number,
        amount_received, amount_applied, apply_method, status,
        notes, created_by_user
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id,
        payment_date,
        method_id,
        reference_number || null,
        amount_received,
        0,  // amount_applied = 0 porque no se asigna a ningún ticket
        'FIFO',  // Default apply_method
        'CREDIT_BALANCE',  // Nuevo status
        notes || 'Credit balance - prepayment for future purchases',
        userId
      ]
    )
    
    const arPaymentId = arPaymentResult.insertId
    
    // 2. Update customer credit - incrementar el saldo disponible
    await connection.query(
      `UPDATE customer_credit 
       SET available_credit = available_credit + ?,
           last_payment_date = NOW()
       WHERE customer_id = ?`,
      [amount_received, customer_id]
    )
    
    // NO se crean allocations porque este pago no se asigna a ningún ticket
    
    await connection.commit()
    
    return {
      ar_payment_id: arPaymentId,
      amount_received: parseFloat(amount_received),
      amount_applied: 0,
      amount_unapplied: parseFloat(amount_received),
      allocations_count: 0,
      status: 'CREDIT_BALANCE',
      message: `Credit balance of $${parseFloat(amount_received).toFixed(2)} added successfully. Available for future purchases.`
    }
    
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Adjust amount_received on a PREPAID A/R payment.
 * Rules:
 *   - Only PREPAID customers.
 *   - VOIDED / voided_at not null → blocked.
 *   - new_amount_received must be > 0.
 *   - applied_amount = real SUM of active ar_payment_allocations.
 *   - new_amount_received must be >= applied_amount (cannot go below applied).
 *   - customer_credit.available_credit + delta must be >= 0.
 *   - amount_unapplied is a generated column → NOT included in UPDATE.
 *   - customer_credit.available_credit adjusted by delta.
 *   - Audit inserted into ar_payment_adjustments.
 */
export const adjustPaymentAmount = async (arPaymentId, body, userId) => {
  const { new_amount_received, reason, notes } = body

  const newAmountReceived = parseFloat(new_amount_received)
  if (!new_amount_received || isNaN(newAmountReceived) || newAmountReceived <= 0) {
    throw new BadRequestError('New amount received must be greater than 0.')
  }
  if (!reason || reason.trim().length === 0) {
    throw new BadRequestError('Reason is required.')
  }

  const connection = await getConnection()

  try {
    await connection.beginTransaction()

    // 1. Lock ar_payments row for this payment
    const [paymentRows] = await connection.query(
      `SELECT ar_payment_id, ar_payment_uid, customer_id,
              amount_received, amount_applied, amount_unapplied,
              status, voided_at
       FROM ar_payments
       WHERE ar_payment_id = ?
       FOR UPDATE`,
      [arPaymentId]
    )
    if (paymentRows.length === 0) throw new NotFoundError('A/R Payment not found.')
    const payment = paymentRows[0]

    // 2. Lock customer_credit row
    const [creditRows] = await connection.query(
      `SELECT customer_id, credit_type, available_credit
       FROM customer_credit
       WHERE customer_id = ?
       FOR UPDATE`,
      [payment.customer_id]
    )
    if (creditRows.length === 0) throw new NotFoundError('Customer credit record not found.')
    const credit = creditRows[0]

    // 3. PREPAID only
    if (credit.credit_type !== 'PREPAID') {
      throw new BadRequestError('Postpaid payments cannot be edited from this screen.')
    }

    // 4. Status guard
    if (payment.status === 'VOIDED' || payment.voided_at !== null) {
      throw new BadRequestError('Voided payments cannot be edited.')
    }

    // 5. Real applied amount from active allocations (authoritative, avoids drift)
    const [allocRows] = await connection.query(
      `SELECT COALESCE(SUM(amount_applied), 0) AS real_applied
       FROM ar_payment_allocations
       WHERE ar_payment_id = ? AND reversed_at IS NULL`,
      [arPaymentId]
    )
    const appliedAmount = parseFloat(allocRows[0].real_applied)

    const oldAmountReceived = parseFloat(payment.amount_received)
    const roundedNew = Math.round(newAmountReceived * 100) / 100
    const roundedOld = Math.round(oldAmountReceived * 100) / 100

    if (roundedNew === roundedOld) {
      throw new BadRequestError('New amount is the same as the current amount. No changes made.')
    }

    // 6. Cannot go below already applied amount
    if (roundedNew < appliedAmount) {
      throw new BadRequestError(
        `New amount ($${roundedNew.toFixed(2)}) cannot be less than the already applied amount ($${appliedAmount.toFixed(2)}).`
      )
    }

    const delta = roundedNew - roundedOld
    const oldAmountUnapplied = parseFloat(payment.amount_unapplied ?? (oldAmountReceived - appliedAmount))
    const newAmountUnapplied = roundedNew - appliedAmount
    const oldAvailableCredit = parseFloat(credit.available_credit)
    const newAvailableCredit = oldAvailableCredit + delta

    // 7. Cannot leave available_credit below zero
    if (newAvailableCredit < 0) {
      const minFromCredit = Math.round((roundedOld - oldAvailableCredit) * 100) / 100
      const minimumAllowed = Math.max(minFromCredit, appliedAmount)
      throw new BadRequestError(
        `This adjustment would reduce the customer's available credit to $${newAvailableCredit.toFixed(2)}. ` +
        `The minimum receivable amount for this payment is $${minimumAllowed.toFixed(2)}.`
      )
    }

    // 8. Update amount_received only — amount_unapplied is a generated column, recalculates automatically
    await connection.query(
      `UPDATE ar_payments SET amount_received = ? WHERE ar_payment_id = ?`,
      [roundedNew, arPaymentId]
    )

    // 9. Adjust available_credit by delta
    await connection.query(
      `UPDATE customer_credit SET available_credit = ? WHERE customer_id = ?`,
      [newAvailableCredit, payment.customer_id]
    )

    // 10. Audit record
    await connection.query(
      `INSERT INTO ar_payment_adjustments (
        adjustment_uid, ar_payment_id, ar_payment_uid, customer_id,
        old_amount_received, new_amount_received, delta_amount,
        applied_amount, old_amount_unapplied, new_amount_unapplied,
        old_available_credit, new_available_credit,
        payment_status, reason, notes,
        adjusted_by_user
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        arPaymentId, payment.ar_payment_uid, payment.customer_id,
        oldAmountReceived, roundedNew, delta,
        appliedAmount, oldAmountUnapplied, newAmountUnapplied,
        oldAvailableCredit, newAvailableCredit,
        payment.status, reason.trim(), notes?.trim() || null,
        userId
      ]
    )

    await connection.commit()

    return {
      ar_payment_id: parseInt(arPaymentId),
      old_amount_received: oldAmountReceived,
      new_amount_received: roundedNew,
      delta_amount: delta,
      applied_amount: appliedAmount,
      new_amount_unapplied: newAmountUnapplied,
      old_available_credit: oldAvailableCredit,
      new_available_credit: newAvailableCredit,
      message: 'Payment amount updated successfully.'
    }

  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Get payment history
 */
export const getPaymentHistory = async (customerId) => {
  const customer = await ArModel.getCustomerSummary(customerId)
  if (!customer) {
    throw new NotFoundError('Customer not found')
  }
  return await ArModel.getPaymentHistory(customerId)
}

/**
 * Get payment detail
 */
export const getPaymentDetail = async (arPaymentId) => {
  const data = await ArModel.getPaymentDetail(arPaymentId)
  if (!data) {
    throw new NotFoundError('A/R Payment not found')
  }
  return data
}

/**
 * Get all payment history with filters and pagination
 */
export const getAllPaymentHistory = async (filters) => {
  const detail = await ArModel.getAllPaymentHistory(filters)
  if (!detail) {
    throw new NotFoundError('A/R Payment History not found')
  }
  return detail
}

export default {
  getCustomersWithCredit,
  getCustomerSummary,
  getPendingTransactions,
  getPaymentMethods,
  applyPayment,
  getPaymentHistory,
  getPaymentDetail,
  adjustPaymentAmount,
  getAllPaymentHistory
}