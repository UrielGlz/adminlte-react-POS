import { useState, useMemo } from 'react'
import api from '../../services/api'

function ChangePaymentMethodModal({ sale, paymentMethods, onClose, onSuccess }) {
  const total = Number(sale.total || 0)

  // Active payments: not VOIDED, not REFUNDED
  const activePayments = (sale.payments || []).filter(
    p => p.payment_status_code !== 'VOIDED' && p.payment_status_code !== 'REFUNDED'
  )
  const hasBusinessPayment = activePayments.some(p => p.method_code === 'business')
  const isCurrentlySplit   = activePayments.length > 1

  // Split mode: only cash and card
  const splitMethods = useMemo(
    () => (paymentMethods || []).filter(pm => pm.code === 'cash' || pm.code === 'card'),
    [paymentMethods]
  )

  // Start in split mode when ticket already has split payment
  const [mode, setMode] = useState(isCurrentlySplit ? 'split' : 'single')
  const [selectedMethodId, setSelectedMethodId] = useState('')
  const [splitAmounts, setSplitAmounts] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState(false)

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)

  // --- Split helpers ---
  const activeSplitPayments = splitMethods
    .map(pm => ({ method_id: pm.method_id, amount: parseFloat(splitAmounts[pm.method_id] || 0) }))
    .filter(p => !isNaN(p.amount) && p.amount > 0)

  const splitTotal     = activeSplitPayments.reduce((sum, p) => sum + p.amount, 0)
  const remainingCents = Math.round(total * 100) - Math.round(splitTotal * 100)
  const remaining      = remainingCents / 100
  const splitBalanced  = remainingCents === 0

  const handleModeChange = (newMode) => {
    if (hasBusinessPayment) return
    if (newMode === 'single' && isCurrentlySplit) return
    setMode(newMode)
    setTouched(false)
    setError(null)
  }

  const handleSplitAmountChange = (methodId, value) => {
    setSplitAmounts(prev => ({ ...prev, [methodId]: value }))
  }

  const handleSubmit = async () => {
    setTouched(true)
    setError(null)

    if (mode === 'single') {
      if (!selectedMethodId) return
    } else {
      if (activeSplitPayments.length < 2) {
        setError('Enter amounts for at least 2 payment methods.')
        return
      }
      if (!splitBalanced) return
    }

    const body = mode === 'single'
      ? { mode: 'single', method_id: Number(selectedMethodId) }
      : { mode: 'split', payments: activeSplitPayments }

    setSubmitting(true)
    try {
      const res = await api.put(`/sales/${sale.sale_id}/payment-method`, body)
      onSuccess(res.data.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update payment method.')
    } finally {
      setSubmitting(false)
    }
  }

  const showSingleError = touched && mode === 'single' && !selectedMethodId

  // Business Account: block everything
  if (hasBusinessPayment) {
    return (
      <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-credit-card me-2"></i>Change Payment Method
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning mb-0">
                <i className="bi bi-lock me-2"></i>
                <strong>Not available.</strong><br />
                Business Account tickets cannot be split or changed to regular payment methods.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-credit-card me-2"></i>Change Payment Method
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={submitting}></button>
          </div>

          <div className="modal-body">
            <p className="text-muted small mb-3">
              Ticket: <strong>#{sale.ticket_number || sale.sale_id}</strong>
              &nbsp;&nbsp;|&nbsp;&nbsp;
              Total: <strong>{formatCurrency(total)}</strong>
            </p>

            {/* Mode toggle */}
            <div className="mb-3">
              <div className="btn-group w-100" role="group">
                <button
                  type="button"
                  className={`btn btn-sm ${mode === 'single' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => handleModeChange('single')}
                  disabled={submitting || isCurrentlySplit}
                  title={isCurrentlySplit ? 'This ticket already has split payment' : ''}
                >
                  <i className="bi bi-credit-card me-1"></i>Single Payment
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${mode === 'split' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => handleModeChange('split')}
                  disabled={submitting}
                >
                  <i className="bi bi-layout-split me-1"></i>Split Payment
                </button>
              </div>
              {isCurrentlySplit && (
                <div className="text-muted small mt-1">
                  <i className="bi bi-info-circle me-1"></i>
                  This ticket already has split payment and cannot be changed back to single payment.
                </div>
              )}
            </div>

            {/* Single mode */}
            {mode === 'single' && (
              <div className="mb-3">
                <label className="form-label fw-semibold">
                  Payment Method <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${showSingleError ? 'is-invalid' : ''}`}
                  value={selectedMethodId}
                  onChange={e => { setSelectedMethodId(e.target.value); setTouched(true) }}
                >
                  <option value="">-- Select a method --</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.method_id} value={pm.method_id}>{pm.name}</option>
                  ))}
                </select>
                {showSingleError && (
                  <div className="invalid-feedback">A payment method is required.</div>
                )}
              </div>
            )}

            {/* Split mode */}
            {mode === 'split' && (
              <div>
                {splitMethods.map(pm => {
                  const val = splitAmounts[pm.method_id] || ''
                  const isInvalid = touched && (!val || parseFloat(val) <= 0)
                  return (
                    <div key={pm.method_id} className="mb-3">
                      <label className="form-label fw-semibold">{pm.name}</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          className={`form-control ${isInvalid ? 'is-invalid' : ''}`}
                          min="0.01"
                          step="0.01"
                          placeholder="0.00"
                          value={val}
                          onChange={e => handleSplitAmountChange(pm.method_id, e.target.value)}
                        />
                        {isInvalid && (
                          <div className="invalid-feedback">Enter an amount greater than zero.</div>
                        )}
                      </div>
                    </div>
                  )
                })}

                <div className={`alert py-2 mb-2 ${splitBalanced ? 'alert-success' : 'alert-warning'}`}>
                  <div className="d-flex justify-content-between small">
                    <span>Sale Total</span>
                    <strong>{formatCurrency(total)}</strong>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span>Allocated</span>
                    <strong>{formatCurrency(splitTotal)}</strong>
                  </div>
                  <hr className="my-1" />
                  <div className="d-flex justify-content-between small fw-bold">
                    <span>Remaining</span>
                    <span className={remaining !== 0 ? 'text-danger' : 'text-success'}>
                      {formatCurrency(remaining)}
                    </span>
                  </div>
                </div>

                {touched && !splitBalanced && (
                  <div className="text-danger small">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    Payment amounts must equal the sale total.
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="alert alert-danger py-2 mt-2 mb-0 small">
                <i className="bi bi-x-circle me-1"></i>{error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
                : <><i className="bi bi-check-circle me-1"></i>Confirm</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChangePaymentMethodModal
