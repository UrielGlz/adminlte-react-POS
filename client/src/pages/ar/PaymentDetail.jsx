import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'
import { formatDateTime, formatDateTimeCompact } from '../../utils/dateHelpers'

const INITIAL_FORM = { newAmount: '', reason: '', notes: '' }

function PaymentDetail() {
  const { id } = useParams()
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPaymentDetail()
  }, [id])

  const fetchPaymentDetail = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/ar/payments/${id}`)
      setPayment(response.data.data)
    } catch (error) {
      console.error('Error fetching payment detail:', error)
      Swal.fire('Error', 'Could not load payment details', 'error')
    } finally {
      setLoading(false)
    }
  }

  const openModal = () => {
    setForm({ newAmount: payment.amount_received ?? '', reason: '', notes: '' })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setForm(INITIAL_FORM)
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newAmount = parseFloat(form.newAmount)

    if (!form.newAmount || isNaN(newAmount) || newAmount <= 0) {
      Swal.fire('Validation', 'New amount must be greater than 0.', 'warning')
      return
    }
    if (!form.reason.trim()) {
      Swal.fire('Validation', 'Reason is required.', 'warning')
      return
    }

    const appliedAmount = parseFloat(payment.real_applied_amount ?? 0)
    const oldAmount = parseFloat(payment.amount_received)

    if (appliedAmount > 0 && newAmount < appliedAmount) {
      Swal.fire(
        'Not allowed',
        `New amount cannot be less than the already applied amount (${formatCurrency(appliedAmount)}).`,
        'warning'
      )
      return
    }

    setSaving(true)
    try {
      await api.patch(`/ar/payments/${id}/amount`, {
        new_amount_received: newAmount,
        reason: form.reason.trim(),
        notes: form.notes.trim() || undefined
      })
      closeModal()
      await fetchPaymentDetail()
      Swal.fire({ icon: 'success', title: 'Updated', text: 'Payment amount updated successfully.', timer: 2000, showConfirmButton: false })
    } catch (error) {
      const msg = error.response?.data?.message || 'Could not update payment amount.'
      Swal.fire('Error', msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)

  if (loading) {
    return (
      <div className="container-fluid text-center py-5">
        <div className="spinner-border text-primary"></div>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="container-fluid">
        <div className="alert alert-danger">Payment not found</div>
        <Link to="/ar/all-payments" className="btn btn-primary">Back to History</Link>
      </div>
    )
  }

  const appliedAmount = parseFloat(payment.real_applied_amount ?? 0)
  const hasPartialApplication = appliedAmount > 0

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h3 mb-0">
                <i className="bi bi-receipt me-2"></i>
                Payment Detail #{payment.ar_payment_id}
              </h1>
              <p className="text-muted mb-0">A/R Payment Record</p>
            </div>
            <div className="d-flex gap-2">
              {payment.is_editable && (
                <button className="btn btn-outline-warning" onClick={openModal}>
                  <i className="bi bi-pencil me-1"></i>
                  Edit Payment Amount
                </button>
              )}
              <Link to="/ar/all-payments" className="btn btn-outline-primary">
                <i className="bi bi-arrow-left me-1"></i>
                Back to History
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Payment Info */}
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header">
              <i className="bi bi-info-circle me-2"></i>
              Payment Information
            </div>
            <div className="card-body">
              <table className="table table-borderless mb-0">
                <tbody>
                  <tr>
                    <td className="text-muted" style={{ width: '40%' }}>Customer:</td>
                    <td><strong>{payment.account_name}</strong> ({payment.account_number})</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Account Type:</td>
                    <td>
                      <span className={`badge ${payment.credit_type === 'PREPAID' ? 'bg-info' : 'bg-secondary'}`}>
                        {payment.credit_type}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted">Payment Date:</td>
                    <td>{formatDateTime(payment.payment_date)}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Payment Method:</td>
                    <td>{payment.payment_method}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Reference:</td>
                    <td>{payment.reference_number || '-'}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Apply Method:</td>
                    <td>
                      <span className={`badge ${payment.apply_method === 'FIFO' ? 'bg-info' : 'bg-secondary'}`}>
                        {payment.apply_method}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted">Status:</td>
                    <td>
                      <span className={`badge ${payment.status === 'APPLIED' ? 'bg-success' : payment.status === 'VOIDED' ? 'bg-danger' : 'bg-warning'}`}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted">Created By:</td>
                    <td>{payment.created_by || '-'}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Created At:</td>
                    <td>{formatDateTimeCompact(payment.created_at)}</td>
                  </tr>
                  {payment.notes && (
                    <tr>
                      <td className="text-muted">Notes:</td>
                      <td>{payment.notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Amount Summary + Adjustment History */}
        <div className="col-md-6">
          <div className="card mb-3">
            <div className="card-header">
              <i className="bi bi-currency-dollar me-2"></i>
              Amount Summary
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col">
                  <h6 className="text-muted">Received</h6>
                  <h3 className="text-primary">{formatCurrency(payment.amount_received)}</h3>
                </div>
                <div className="col">
                  <h6 className="text-muted">Applied</h6>
                  <h3 className="text-success">{formatCurrency(payment.amount_applied)}</h3>
                </div>
                <div className="col">
                  <h6 className="text-muted">Unapplied</h6>
                  <h3 className={parseFloat(payment.amount_unapplied) > 0 ? 'text-warning' : 'text-muted'}>
                    {formatCurrency(payment.amount_unapplied)}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Adjustment History — compact list in right column */}
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>
                <i className="bi bi-clock-history me-2"></i>
                Adjustment History
              </span>
              {payment.adjustments?.length > 0 && (
                <span className="badge bg-secondary">{payment.adjustments.length}</span>
              )}
            </div>
            <div className="card-body p-0">
              {(!payment.adjustments || payment.adjustments.length === 0) ? (
                <p className="text-center text-muted small py-3 mb-0">No payment adjustments recorded.</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {payment.adjustments.map((adj) => {
                    const delta = parseFloat(adj.delta_amount)
                    const isPositive = delta > 0
                    return (
                      <li key={adj.adjustment_id} className="list-group-item px-3 py-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <small className="text-muted">{formatDateTimeCompact(adj.adjusted_at)}</small>
                          <small className="text-muted">{adj.adjusted_by_name || '-'}</small>
                        </div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="text-muted small">{formatCurrency(adj.old_amount_received)}</span>
                          <i className="bi bi-arrow-right small text-muted"></i>
                          <span className="fw-semibold">{formatCurrency(adj.new_amount_received)}</span>
                          <span className={`badge ms-auto ${isPositive ? 'bg-success' : 'bg-danger'}`}>
                            {isPositive ? '+' : ''}{formatCurrency(delta)}
                          </span>
                        </div>
                        <div className="small text-muted">{adj.reason}</div>
                        {adj.notes && <div className="small fst-italic text-muted">{adj.notes}</div>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Allocations */}
      <div className="card mb-4">
        <div className="card-header">
          <i className="bi bi-list-check me-2"></i>
          Applied to Transactions ({payment.allocations?.length || 0})
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Ticket #</th>
                <th>Date</th>
                <th>Scale Op</th>
                <th>Driver</th>
                <th className="text-end">Amount Applied</th>
                <th>Applied At</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations?.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-3">
                    No active allocations
                  </td>
                </tr>
              )}
              {payment.allocations?.map((a, index) => (
                <tr key={a.allocation_id}>
                  <td>{index + 1}</td>
                  <td><strong>{a.ticket_number || a.sale_uid}</strong></td>
                  <td>{formatDateTimeCompact(a.printed_at)}</td>
                  <td>{a.operator_user}</td>
                  <td>{a.driver_name}</td>
                  <td className="text-end text-success">{formatCurrency(a.amount_applied)}</td>
                  <td>{formatDateTimeCompact(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-light">
              <tr>
                <th colSpan="5">Total Applied</th>
                <th className="text-end text-success">{formatCurrency(payment.amount_applied)}</th>
                <th></th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Reversed Allocations */}
      {payment.reversed_allocations?.length > 0 && (
        <div className="card mb-4">
          <div className="card-header text-muted">
            <i className="bi bi-arrow-counterclockwise me-2"></i>
            Reversed Transactions ({payment.reversed_allocations.length})
            <span className="ms-2 badge bg-secondary">Not counted in applied total</span>
          </div>
          <div className="table-responsive">
            <table className="table mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Ticket #</th>
                  <th>Date</th>
                  <th>Scale Op</th>
                  <th>Driver</th>
                  <th className="text-end">Original Amount</th>
                  <th>Reversed At</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {payment.reversed_allocations.map((a, index) => (
                  <tr key={a.allocation_id} className="text-muted">
                    <td>{index + 1}</td>
                    <td>
                      <span className="text-decoration-line-through">{a.ticket_number || a.sale_uid}</span>
                      {' '}<span className="badge bg-secondary">Reversed</span>
                    </td>
                    <td>{formatDateTimeCompact(a.printed_at)}</td>
                    <td>{a.operator_user}</td>
                    <td>{a.driver_name}</td>
                    <td className="text-end text-decoration-line-through">{formatCurrency(a.amount_applied)}</td>
                    <td>{formatDateTimeCompact(a.reversed_at)}</td>
                    <td className="small">{a.reversal_note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Payment Amount Modal */}
      {showModal && (
        <>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <form onSubmit={handleSubmit}>
                  <div className="modal-header">
                    <h5 className="modal-title">
                      <i className="bi bi-pencil me-2"></i>
                      Edit Payment Amount
                    </h5>
                    <button type="button" className="btn-close" onClick={closeModal} disabled={saving} />
                  </div>
                  <div className="modal-body">
                    {hasPartialApplication && (
                      <div className="alert alert-warning d-flex align-items-start gap-2 mb-3">
                        <i className="bi bi-exclamation-triangle-fill mt-1"></i>
                        <div>
                          <strong>Partially applied payment.</strong>
                          <br />
                          This prepaid payment has already been partially applied. You can decrease it only down to the applied amount ({formatCurrency(appliedAmount)}).
                        </div>
                      </div>
                    )}

                    {/* Read-only summary */}
                    <div className="row g-2 mb-3">
                      <div className="col-4 text-center">
                        <small className="text-muted d-block">Current Amount</small>
                        <strong>{formatCurrency(payment.amount_received)}</strong>
                      </div>
                      <div className="col-4 text-center">
                        <small className="text-muted d-block">Applied</small>
                        <strong className="text-success">{formatCurrency(appliedAmount)}</strong>
                      </div>
                      <div className="col-4 text-center">
                        <small className="text-muted d-block">Unapplied</small>
                        <strong className="text-warning">{formatCurrency(payment.amount_unapplied)}</strong>
                      </div>
                    </div>

                    <hr />

                    <div className="mb-3">
                      <label className="form-label fw-semibold">
                        New Amount Received <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          className="form-control"
                          name="newAmount"
                          value={form.newAmount}
                          onChange={handleFormChange}
                          min={hasPartialApplication ? appliedAmount : '0.01'}
                          step="0.01"
                          required
                          disabled={saving}
                          autoFocus
                        />
                      </div>
                      {hasPartialApplication && (
                        <div className="form-text text-muted">
                          Minimum: {formatCurrency(appliedAmount)} (already applied amount)
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold">
                        Reason <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        name="reason"
                        value={form.reason}
                        onChange={handleFormChange}
                        placeholder="e.g. Corrected wrong received amount"
                        maxLength={255}
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="mb-1">
                      <label className="form-label fw-semibold">Notes <span className="text-muted fw-normal">(optional)</span></label>
                      <textarea
                        className="form-control"
                        name="notes"
                        value={form.notes}
                        onChange={handleFormChange}
                        rows={2}
                        maxLength={500}
                        placeholder="Additional context..."
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-warning" disabled={saving}>
                      {saving
                        ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</>
                        : <><i className="bi bi-check-lg me-1" />Save Changes</>
                      }
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={!saving ? closeModal : undefined} />
        </>
      )}
    </div>
  )
}

export default PaymentDetail
