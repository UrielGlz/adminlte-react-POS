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
          ar_payment_id, sale_uid, payment_uid, ticket_uid, ticket_number, amount_applied
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [arPaymentId, alloc.sale_uid, alloc.payment_uid, alloc.ticket_uid, alloc.ticket_number, alloc.amount_applied]
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
  console.log(detail);
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
  getAllPaymentHistory
}