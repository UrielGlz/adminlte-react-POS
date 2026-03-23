import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'
import { formatDateTime, todayDateString } from '../../utils/dateHelpers'

function AccountsReceivable() {
  // State
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSummary, setCustomerSummary] = useState(null)
  const [pendingData, setPendingData] = useState({ transactions: [], totals: {}, aging: {} })
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingCustomer, setLoadingCustomer] = useState(false)

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    payment_date: todayDateString(),
    method_id: '',
    reference_number: '',
    amount_received: '',
    apply_method: 'FIFO',
    notes: '',
    is_credit_balance: false  // Nueva opción para PREPAID customers
  })

  // Manual allocation state
  const [manualAllocations, setManualAllocations] = useState({})

  // Load initial data
  useEffect(() => {
    fetchCustomers()
    fetchPaymentMethods()
  }, [])

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/ar/customers')
      setCustomers(response.data.data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      Swal.fire('Error', 'Could not load customers', 'error')
    }
  }

  const fetchPaymentMethods = async () => {
    try {
      const response = await api.get('/ar/payment-methods')
      setPaymentMethods(response.data.data || [])
    } catch (error) {
      console.error('Error fetching payment methods:', error)
    }
  }

  const fetchCustomerData = useCallback(async (customerId) => {
    if (!customerId) {
      setCustomerSummary(null)
      setPendingData({ transactions: [], totals: {}, aging: {} })
      return
    }

    setLoadingCustomer(true)
    try {
      const [summaryRes, pendingRes] = await Promise.all([
        api.get(`/ar/customers/${customerId}/summary`),
        api.get(`/ar/customers/${customerId}/pending`)
      ])

      setCustomerSummary(summaryRes.data.data)
      setPendingData(pendingRes.data.data || { transactions: [], totals: {}, aging: {} })
      setManualAllocations({})
    } catch (error) {
      console.error('Error fetching customer data:', error)
      Swal.fire('Error', error.response?.data?.message || 'Could not load customer data', 'error')
    } finally {
      setLoadingCustomer(false)
    }
  }, [])

  // Handle customer selection
  const handleCustomerChange = (e) => {
    const customerId = e.target.value
    setSelectedCustomerId(customerId)
    fetchCustomerData(customerId)
    setPaymentForm(prev => ({
      ...prev,
      amount_received: '',
      reference_number: '',
      is_credit_balance: false
    }))
  }

  // Handle payment form changes
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target

    // Si se marca/desmarca credit balance, resetear otros campos
    if (name === 'is_credit_balance') {
      setPaymentForm(prev => ({
        ...prev,
        [name]: checked,
        apply_method: 'FIFO',  // Reset apply method cuando cambia
        amount_received: ''
      }))
      setManualAllocations({})
    } else {
      setPaymentForm(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }))
    }
  }

  // Handle manual allocation change
  const handleAllocationChange = (paymentUid, value) => {
    const numValue = parseFloat(value) || 0
    setManualAllocations(prev => ({
      ...prev,
      [paymentUid]: numValue
    }))
  }

  // Apply full amount to a transaction
  const applyFullAmount = (transaction) => {
    setManualAllocations(prev => ({
      ...prev,
      [transaction.payment_uid]: parseFloat(transaction.pending_amount)
    }))
  }

  // Calculate totals for manual mode
  const calculateManualTotal = () => {
    return Object.values(manualAllocations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
  }

  // Auto-fill amount with total pending
  const fillTotalPending = () => {
    setPaymentForm(prev => ({
      ...prev,
      amount_received: pendingData.totals.total_pending?.toFixed(2) || ''
    }))
  }

  // Submit payment
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedCustomerId) {
      Swal.fire('Warning', 'Please select a customer', 'warning')
      return
    }

    if (!paymentForm.method_id) {
      Swal.fire('Warning', 'Please select a payment method', 'warning')
      return
    }

    if (!paymentForm.amount_received || parseFloat(paymentForm.amount_received) <= 0) {
      Swal.fire('Warning', 'Please enter a valid amount', 'warning')
      return
    }

    // Validar credit balance solo para PREPAID
    if (paymentForm.is_credit_balance && customerSummary.credit_type !== 'PREPAID') {
      Swal.fire('Warning', 'Credit balance is only available for PREPAID customers', 'warning')
      return
    }

    // Validate manual allocations (solo si NO es credit balance)
    if (!paymentForm.is_credit_balance && paymentForm.apply_method === 'MANUAL') {
      const manualTotal = calculateManualTotal()
      if (manualTotal <= 0) {
        Swal.fire('Warning', 'Please allocate amounts to at least one transaction', 'warning')
        return
      }
      if (manualTotal > parseFloat(paymentForm.amount_received)) {
        Swal.fire('Warning', 'Total allocations exceed amount received', 'warning')
        return
      }
    }

    // Confirm
    const confirmMessage = paymentForm.is_credit_balance
      ? `<p><strong>Type:</strong> Credit Balance (Prepayment)</p>
         <p><strong>Amount:</strong> $${parseFloat(paymentForm.amount_received).toFixed(2)}</p>
         <p><strong>Method:</strong> ${paymentMethods.find(m => m.method_id == paymentForm.method_id)?.name}</p>
         <p class="text-info"><small>This amount will be available for future purchases</small></p>`
      : `<p><strong>Amount:</strong> $${parseFloat(paymentForm.amount_received).toFixed(2)}</p>
         <p><strong>Method:</strong> ${paymentMethods.find(m => m.method_id == paymentForm.method_id)?.name}</p>
         <p><strong>Apply Mode:</strong> ${paymentForm.apply_method}</p>`

    const result = await Swal.fire({
      title: 'Confirm Payment',
      html: confirmMessage,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Apply Payment',
      confirmButtonColor: '#28a745'
    })

    if (!result.isConfirmed) return

    setLoading(true)
    try {
      const payload = {
        customer_id: parseInt(selectedCustomerId),
        payment_date: paymentForm.payment_date,
        method_id: parseInt(paymentForm.method_id),
        reference_number: paymentForm.reference_number || null,
        amount_received: parseFloat(paymentForm.amount_received),
        apply_method: paymentForm.apply_method,
        notes: paymentForm.notes || null,
        is_credit_balance: paymentForm.is_credit_balance  // Nuevo flag
      }

      // Add allocations for manual mode (solo si NO es credit balance)
      if (!paymentForm.is_credit_balance && paymentForm.apply_method === 'MANUAL') {
        payload.allocations = Object.entries(manualAllocations)
          .filter(([_, amount]) => amount > 0)
          .map(([payment_uid, amount]) => ({ payment_uid, amount }))
      }

      const response = await api.post('/ar/payments', payload)

      const successMessage = paymentForm.is_credit_balance
        ? `<p><strong>Credit Balance Added:</strong> $${response.data.data.amount_received.toFixed(2)}</p>
           <p class="text-success">Amount available for future purchases</p>`
        : `<p><strong>Amount Applied:</strong> $${response.data.data.amount_applied.toFixed(2)}</p>
           <p><strong>Transactions:</strong> ${response.data.data.allocations_count}</p>
           ${response.data.data.amount_unapplied > 0
          ? `<p class="text-warning"><strong>Unapplied:</strong> $${response.data.data.amount_unapplied.toFixed(2)}</p>`
          : ''}`

      await Swal.fire({
        title: 'Payment Applied',
        html: successMessage,
        icon: 'success'
      })

      // Refresh data
      fetchCustomerData(selectedCustomerId)
      setPaymentForm(prev => ({
        ...prev,
        amount_received: '',
        reference_number: '',
        notes: '',
        is_credit_balance: false
      }))
      setManualAllocations({})

    } catch (error) {
      console.error('Error applying payment:', error)
      Swal.fire('Error', error.response?.data?.message || 'Could not apply payment', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
  }



  // Get aging badge color
  const getAgingBadge = (bucket) => {
    const badges = {
      'CURRENT': 'bg-success',
      '31-60': 'bg-warning',
      '61-90': 'bg-orange',
      '90+': 'bg-danger'
    }
    return badges[bucket] || 'bg-secondary'
  }

  // Determinar si mostrar pending transactions
  const showPendingTransactions = !paymentForm.is_credit_balance && pendingData.transactions.length > 0
  const isPrepaid = customerSummary?.credit_type === 'PREPAID'

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h3 mb-0">
                <i className="bi bi-cash-coin me-2"></i>
                Accounts Receivable
              </h1>
              <p className="text-muted mb-0">Apply customer payments to pending transactions</p>
            </div>
            <Link to="/ar/history" className="btn btn-outline-primary">
              <i className="bi bi-clock-history me-1"></i>
              Payment History
            </Link>
          </div>
        </div>
      </div>

      {/* Customer Selector */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <i className="bi bi-person me-2"></i>
              Select Customer
            </div>
            <div className="card-body">
              <select
                className="form-select form-select-lg"
                value={selectedCustomerId}
                onChange={handleCustomerChange}
              >
                <option value="">-- Select a customer --</option>
                {customers.map(c => (
                  <option key={c.id_customer} value={c.id_customer}>
                    {c.account_number} - {c.account_name}
                    {c.is_suspended ? ' (SUSPENDED)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {loadingCustomer && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {customerSummary && !loadingCustomer && (
        <>
          {/* Customer Summary */}
          <div className="row mb-4">
            {/* Customer Info */}
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-header">
                  <i className="bi bi-info-circle me-2"></i>
                  Customer Information
                </div>
                <div className="card-body">
                  <h5 className="card-title">{customerSummary.account_name}</h5>
                  <p className="text-muted mb-2">{customerSummary.account_number}</p>

                  {/* MEJORA 1: Mostrar advertencia pero permitir pagos */}
                  {customerSummary.is_suspended && (
                    <div className="alert alert-warning py-2">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      <strong>SUSPENDED:</strong> {customerSummary.suspension_reason || 'No reason provided'}
                      <br />
                      <small className="text-muted">Accounting can still apply payments</small>
                    </div>
                  )}

                  <table className="table table-sm table-borderless mb-0">
                    <tbody>
                      <tr>
                        <td className="text-muted">Credit Type:</td>
                        <td>
                          <span className={`badge ${customerSummary.credit_type === 'POSTPAID' ? 'bg-primary' : 'bg-info'}`}>
                            {customerSummary.credit_type}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="text-muted">Credit Limit:</td>
                        <td>{isPrepaid ? '-' : formatCurrency(customerSummary.credit_limit)}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Payment Terms:</td>
                        <td>{isPrepaid ? '-' : `${customerSummary.payment_terms_days ?? 0} days`}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Contact:</td>
                        <td>{customerSummary.contact_name || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Balance Info */}
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-header">
                  <i className="bi bi-wallet2 me-2"></i>
                  Balance Summary
                </div>
                <div className="card-body">
                  {customerSummary.credit_type === 'POSTPAID' ? (
                    <>
                      <div className="d-flex justify-content-between mb-3">
                        <span className="text-muted">Current Balance (Debt):</span>
                        <span className="h5 text-danger mb-0">{formatCurrency(customerSummary.current_balance)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-3">
                        <span className="text-muted">Available Credit:</span>
                        <span className={`h5 mb-0 ${customerSummary.available_credit > 0 ? 'text-success' : 'text-danger'}`}>
                          {formatCurrency(customerSummary.available_credit)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="d-flex justify-content-between mb-3">
                      <span className="text-muted">Available Balance:</span>
                      <span className={`h5 mb-0 ${customerSummary.available_credit > 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(customerSummary.available_credit)}
                      </span>
                    </div>
                  )}

                  <hr />

                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Pending Transactions:</span>
                    <span className="badge bg-warning text-dark">{customerSummary.pending_count}</span>
                  </div>
                  <div className="d-flex justify-content-between mt-2">
                    <span className="text-muted">Total Pending:</span>
                    <span className="h5 text-primary mb-0">{formatCurrency(customerSummary.total_pending)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Last Payment */}
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-header">
                  <i className="bi bi-clock-history me-2"></i>
                  Last Payment
                </div>
                <div className="card-body">
                  {customerSummary.last_payment ? (
                    <>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Date:</span>
                        <span>{formatDateTime(customerSummary.last_payment.payment_date)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Amount:</span>
                        <span className="text-success">{formatCurrency(customerSummary.last_payment.amount_received)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Method:</span>
                        <span>{customerSummary.last_payment.payment_method}</span>
                      </div>
                      {customerSummary.last_payment.reference_number && (
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">Reference:</span>
                          <span>{customerSummary.last_payment.reference_number}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted text-center mb-0">No payments recorded</p>
                  )}

                  {customerSummary.last_payment_date && (
                    <div className="mt-3 pt-3 border-top">
                      <small className="text-muted">
                        Last payment date: {formatDateTime(customerSummary.last_payment_date)}
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Aging Summary */}
          {pendingData.transactions.length > 0 && !paymentForm.is_credit_balance && (
            <div className="row mb-4">
              <div className="col-12">
                <div className="card">
                  <div className="card-header">
                    <i className="bi bi-calendar3 me-2"></i>
                    Aging Summary
                  </div>
                  <div className="card-body">
                    <div className="row text-center">
                      <div className="col">
                        <div className="p-3 bg-success bg-opacity-10 rounded">
                          <h6 className="text-muted mb-1">Current (0-30)</h6>
                          <h4 className="text-success mb-0">{formatCurrency(pendingData.aging.current)}</h4>
                        </div>
                      </div>
                      <div className="col">
                        <div className="p-3 bg-warning bg-opacity-10 rounded">
                          <h6 className="text-muted mb-1">31-60 Days</h6>
                          <h4 className="text-warning mb-0">{formatCurrency(pendingData.aging['31_60'])}</h4>
                        </div>
                      </div>
                      <div className="col">
                        <div className="p-3 bg-orange bg-opacity-10 rounded" style={{ backgroundColor: 'rgba(253, 126, 20, 0.1)' }}>
                          <h6 className="text-muted mb-1">61-90 Days</h6>
                          <h4 style={{ color: '#fd7e14' }} className="mb-0">{formatCurrency(pendingData.aging['61_90'])}</h4>
                        </div>
                      </div>
                      <div className="col">
                        <div className="p-3 bg-danger bg-opacity-10 rounded">
                          <h6 className="text-muted mb-1">90+ Days</h6>
                          <h4 className="text-danger mb-0">{formatCurrency(pendingData.aging['90_plus'])}</h4>
                        </div>
                      </div>
                      <div className="col">
                        <div className="p-3 bg-primary bg-opacity-10 rounded">
                          <h6 className="text-muted mb-1">Total Pending</h6>
                          <h4 className="text-primary mb-0">{formatCurrency(pendingData.totals.total_pending)}</h4>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Form & Pending Transactions */}
          <div className="row">
            {/* Payment Form */}
            <div className="col-md-4">
              <div className="card sticky-top" style={{ top: '1rem' }}>
                <div className="card-header bg-primary text-white">
                  <i className="bi bi-plus-circle me-2"></i>
                  Apply Payment
                </div>
                <div className="card-body">
                  <form onSubmit={handleSubmit}>
                    {/* MEJORA 2: Credit Balance Option (solo PREPAID) */}
                    {customerSummary.credit_type === 'PREPAID' && (
                      <div className="mb-3">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="creditBalanceSwitch"
                            name="is_credit_balance"
                            checked={paymentForm.is_credit_balance}
                            onChange={handleFormChange}
                          />
                          <label className="form-check-label" htmlFor="creditBalanceSwitch">
                            <strong>Credit Balance</strong>
                            <br />
                            <small className="text-muted">Prepayment for future purchases</small>
                          </label>
                        </div>
                        {paymentForm.is_credit_balance && (
                          <div className="alert alert-info mt-2 py-2">
                            <small>
                              <i className="bi bi-info-circle me-1"></i>
                              This payment will NOT be applied to any tickets.
                              It will be available as credit for future purchases.
                            </small>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment Date */}
                    <div className="mb-3">
                      <label className="form-label">Payment Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        name="payment_date"
                        value={paymentForm.payment_date}
                        onChange={handleFormChange}
                        required
                      />
                    </div>

                    {/* Payment Method */}
                    <div className="mb-3">
                      <label className="form-label">Payment Method *</label>
                      <select
                        className="form-select"
                        name="method_id"
                        value={paymentForm.method_id}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="">-- Select --</option>
                        {paymentMethods.map(m => (
                          <option key={m.method_id} value={m.method_id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Reference Number */}
                    <div className="mb-3">
                      <label className="form-label">Reference / Check #</label>
                      <input
                        type="text"
                        className="form-control"
                        name="reference_number"
                        value={paymentForm.reference_number}
                        onChange={handleFormChange}
                        placeholder="Check #, Wire #, etc."
                      />
                    </div>

                    {/* Amount Received */}
                    <div className="mb-3">
                      <label className="form-label">Amount Received *</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          className="form-control"
                          name="amount_received"
                          value={paymentForm.amount_received}
                          onChange={handleFormChange}
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          required
                        />
                        {!paymentForm.is_credit_balance && pendingData.transactions.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={fillTotalPending}
                            title="Fill total pending"
                          >
                            <i className="bi bi-arrow-down-circle"></i>
                          </button>
                        )}
                      </div>
                      {!paymentForm.is_credit_balance && (
                        <small className="text-muted">
                          Total pending: {formatCurrency(pendingData.totals.total_pending)}
                        </small>
                      )}
                    </div>

                    {/* Apply Method - Solo si NO es credit balance */}
                    {!paymentForm.is_credit_balance && (
                      <div className="mb-3">
                        <label className="form-label">Apply Method *</label>
                        <div className="btn-group w-100" role="group">
                          <input
                            type="radio"
                            className="btn-check"
                            name="apply_method"
                            id="fifo"
                            value="FIFO"
                            checked={paymentForm.apply_method === 'FIFO'}
                            onChange={handleFormChange}
                          />
                          <label className="btn btn-outline-primary" htmlFor="fifo">
                            <i className="bi bi-sort-numeric-down me-1"></i>
                            FIFO (Auto)
                          </label>

                          <input
                            type="radio"
                            className="btn-check"
                            name="apply_method"
                            id="manual"
                            value="MANUAL"
                            checked={paymentForm.apply_method === 'MANUAL'}
                            onChange={handleFormChange}
                          />
                          <label className="btn btn-outline-primary" htmlFor="manual">
                            <i className="bi bi-hand-index me-1"></i>
                            Manual
                          </label>
                        </div>
                        <small className="text-muted">
                          {paymentForm.apply_method === 'FIFO'
                            ? 'Applies from oldest to newest automatically'
                            : 'Select transactions manually below'}
                        </small>
                      </div>
                    )}

                    {/* Manual Mode Total */}
                    {!paymentForm.is_credit_balance && paymentForm.apply_method === 'MANUAL' && (
                      <div className="alert alert-info py-2">
                        <div className="d-flex justify-content-between">
                          <span>Manual Allocation:</span>
                          <strong>{formatCurrency(calculateManualTotal())}</strong>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="mb-3">
                      <label className="form-label">Notes</label>
                      <textarea
                        className="form-control"
                        name="notes"
                        value={paymentForm.notes}
                        onChange={handleFormChange}
                        rows="2"
                        placeholder="Optional notes..."
                      />
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      className="btn btn-success w-100"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-2"></i>
                          {paymentForm.is_credit_balance ? 'Add Credit Balance' : 'Apply Payment'}
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Pending Transactions - Solo si NO es credit balance */}
            {showPendingTransactions && (
              <div className="col-md-8">
                <div className="card">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <span>
                      <i className="bi bi-list-ul me-2"></i>
                      Pending Transactions ({pendingData.transactions.length})
                    </span>
                    <span className="badge bg-primary">
                      Total: {formatCurrency(pendingData.totals.total_pending)}
                    </span>
                  </div>
                  <div className="card-body p-0">
                    <div className="table-responsive">
                      <table className="table table-hover table-striped mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Ticket #</th>
                            <th>Date</th>
                            <th className="text-end">Original</th>
                            <th className="text-end">Applied</th>
                            <th className="text-end">Pending</th>
                            <th className="text-center">Aging</th>
                            {paymentForm.apply_method === 'MANUAL' && (
                              <th className="text-end" style={{ width: '150px' }}>Apply</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {pendingData.transactions.map((t, index) => (
                            <tr key={t.payment_uid}>
                              <td>
                                <strong>{t.ticket_number || `Sale #${t.sale_id}`}</strong>
                              </td>
                              <td>{formatDateTime(t.transaction_date)}</td>
                              <td className="text-end">{formatCurrency(t.original_amount)}</td>
                              <td className="text-end text-success">
                                {parseFloat(t.amount_applied) > 0 ? formatCurrency(t.amount_applied) : '-'}
                              </td>
                              <td className="text-end text-danger fw-bold">
                                {formatCurrency(t.pending_amount)}
                              </td>
                              <td className="text-center">
                                <span className={`badge ${getAgingBadge(t.aging_bucket)}`}>
                                  {t.days_outstanding}d
                                </span>
                              </td>
                              {paymentForm.apply_method === 'MANUAL' && (
                                <td>
                                  <div className="input-group input-group-sm">
                                    <span className="input-group-text">$</span>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={manualAllocations[t.payment_uid] || ''}
                                      onChange={(e) => handleAllocationChange(t.payment_uid, e.target.value)}
                                      step="0.01"
                                      min="0"
                                      max={t.pending_amount}
                                      placeholder="0.00"
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-outline-secondary btn-sm"
                                      onClick={() => applyFullAmount(t)}
                                      title="Apply full amount"
                                    >
                                      <i className="bi bi-check"></i>
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="table-light">
                          <tr>
                            <th colSpan={paymentForm.apply_method === 'MANUAL' ? 4 : 4}>Totals</th>
                            <th className="text-end text-danger">
                              {formatCurrency(pendingData.totals.total_pending)}
                            </th>
                            <th></th>
                            {paymentForm.apply_method === 'MANUAL' && (
                              <th className="text-end text-primary">
                                {formatCurrency(calculateManualTotal())}
                              </th>
                            )}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* No pending transactions & not credit balance */}
            {pendingData.transactions.length === 0 && !paymentForm.is_credit_balance && (
              <div className="col-md-8">
                <div className="alert alert-success">
                  <i className="bi bi-check-circle me-2"></i>
                  This customer has no pending transactions. All payments are up to date!
                  {customerSummary.credit_type === 'PREPAID' && (
                    <>
                      <br />
                      <small className="text-muted">
                        You can still add a credit balance by checking the option above.
                      </small>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* No customer selected */}
      {!selectedCustomerId && !loadingCustomer && (
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-body text-center py-5">
                <i className="bi bi-person-circle display-1 text-muted"></i>
                <h4 className="mt-3 text-muted">Select a Customer</h4>
                <p className="text-muted">Choose a customer from the dropdown to view their pending transactions and apply payments.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountsReceivable