import { useState, useEffect } from 'react'
import api from '../../services/api'
import Swal from 'sweetalert2'

function ReassignCustomerModal({ sale, onClose, onSuccess }) {
  const [customers, setCustomers] = useState([])
  const [reasons, setReasons] = useState([])
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [reasonId, setReasonId] = useState('')
  const [notes, setNotes] = useState('')
  const [walkInMode, setWalkInMode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoadingData(true)
      const [custRes, reasonRes] = await Promise.all([
        api.get('/ar/customers'),
        api.get('/sales/reassignment-reasons')
      ])
      setCustomers(custRes.data.data || [])
      setReasons(reasonRes.data.data || [])
    } catch (err) {
      console.error('Error loading modal data:', err)
    } finally {
      setLoadingData(false)
    }
  }

  const currentAccountNumber = sale?.driver_info?.account_number
  const currentAccountName = sale?.driver_info?.account_name
  const hasSourceCustomer = Boolean(currentAccountNumber || currentAccountName || sale?.customer_id)
  const currentCustomerLabel = hasSourceCustomer
    ? `${currentAccountNumber || '-'} / ${currentAccountName || '-'}`
    : 'No customer assigned'
  const isBusinessPayment = Array.isArray(sale?.payments) && sale.payments.some(p =>
    Number(p.method_id) === 3 || String(p.method_name || '').toLowerCase().includes('business')
  )
  const saleTotal = parseFloat(sale?.total) || 0
  const sourceCustomerFromList = customers.find(c => c.account_number === currentAccountNumber)
  const sourceIsPrepaid = sourceCustomerFromList?.credit_type === 'PREPAID'

  const filtered = customers.filter(c => {
    if (c.account_number === currentAccountNumber) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      c.account_name?.toLowerCase().includes(s) ||
      c.account_number?.toLowerCase().includes(s)
    )
  })

  const selectCustomer = (c) => {
    setSelectedCustomer(c)
    setSearch('')
  }

  const canSubmit = (() => {
    if (submitting || !reasonId) return false
    if (walkInMode) return true
    if (!selectedCustomer) return false
    if (isBusinessPayment && selectedCustomer.is_suspended) return false
    return true
  })()

  const handleSubmit = async () => {
    if (!walkInMode && !selectedCustomer) return
    if (!reasonId) {
      Swal.fire('Validation', 'Please select a reassignment reason.', 'warning')
      return
    }

    const confirmResult = walkInMode
      ? await Swal.fire({
          title: 'Convert to Walk-in Customer',
          html: `
            <p class="mb-1">Ticket <b>#${sale.ticket_number || sale.sale_id}</b> — ${formatCurrency(saleTotal)}</p>
            <p class="mb-1">From: <b>${currentCustomerLabel}</b></p>
            <p class="mb-2">To: <b>Walk-in Customer</b></p>
            <div class="alert alert-warning py-1 mb-0 small text-start">
              The PREPAID balance of <b>${formatCurrency(saleTotal)}</b> will be returned to the source account.
              This action cannot be undone without another reassignment.
            </div>
          `,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, convert to Walk-in',
          confirmButtonColor: '#dc3545'
        })
      : await Swal.fire({
          title: hasSourceCustomer ? 'Confirm Reassignment' : 'Confirm Customer Assignment',
          html: `
            <p class="mb-1">Move ticket <b>#${sale.ticket_number || sale.sale_id}</b> (${formatCurrency(saleTotal)})</p>
            <p class="mb-1">From: <b>${currentCustomerLabel}</b></p>
            <p class="mb-0">To: <b>${selectedCustomer.account_number} / ${selectedCustomer.account_name}</b></p>
          `,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: hasSourceCustomer ? 'Yes, reassign' : 'Yes, assign',
          confirmButtonColor: '#0d6efd'
        })

    if (!confirmResult.isConfirmed) return

    try {
      setSubmitting(true)
      const payload = walkInMode
        ? { newCustomerId: null, targetType: 'WALK_IN', reassignmentReasonId: Number(reasonId), reasonNotes: notes || null }
        : { newCustomerId: selectedCustomer.id_customer, reassignmentReasonId: Number(reasonId), reasonNotes: notes || null }

      const res = await api.post(`/sales/${sale.sale_uid}/reassign-customer`, payload)
      Swal.fire({
        icon: 'success',
        title: res.data?.data?.message || res.data?.message || 'Operation completed successfully.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      })
      onSuccess()
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Could not complete the operation.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title"><i className="bi bi-arrow-left-right me-2"></i>Change Customer</h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={submitting}></button>
            </div>
            <div className="modal-body">
              {loadingData ? (
                <div className="text-center py-4"><div className="spinner-border text-primary"></div></div>
              ) : (
                <>
                  {/* Current info (read-only) */}
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Ticket</label>
                      <input className="form-control form-control-sm" readOnly
                        value={`#${sale.ticket_number || sale.sale_id}`} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Current Customer</label>
                      <input className="form-control form-control-sm" readOnly
                        value={currentCustomerLabel} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Amount to Move</label>
                      <input className="form-control form-control-sm fw-bold text-success" readOnly
                        value={formatCurrency(saleTotal)} />
                    </div>
                  </div>

                  <hr />

                  {!isBusinessPayment && (
                    <div className="alert alert-secondary py-2 small">
                      Non-Business Account correction: only the sale record and audit history will be updated. Credit balances will not change.
                    </div>
                  )}
                  {isBusinessPayment && !walkInMode && (
                    <div className="alert alert-info py-2 small">
                      Business Account correction: credit balances will be updated for both customers.
                    </div>
                  )}

                  {/* Walk-in toggle — only for PREPAID Business Account sales */}
                  {isBusinessPayment && sourceIsPrepaid && (
                    <div className="mb-3">
                      <div className="btn-group w-100" role="group">
                        <button
                          type="button"
                          className={`btn btn-sm ${!walkInMode ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => { setWalkInMode(false); setSelectedCustomer(null) }}
                          disabled={submitting}
                        >
                          <i className="bi bi-person-check me-1"></i>Select Customer
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${walkInMode ? 'btn-warning' : 'btn-outline-warning'}`}
                          onClick={() => { setWalkInMode(true); setSelectedCustomer(null) }}
                          disabled={submitting}
                        >
                          <i className="bi bi-person-x me-1"></i>Convert to Walk-in
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Walk-in mode info */}
                  {walkInMode ? (
                    <div className="alert alert-warning py-2 small mb-3">
                      PREPAID to Walk-in conversion: the account will be unlinked and the ticket amount will be returned to the original PREPAID balance.
                    </div>
                  ) : (
                    <>
                  {/* New customer selector */}
                  <label className="form-label small fw-bold">New Customer <span className="text-danger">*</span></label>

                  {selectedCustomer ? (
                    <div className="alert alert-info py-2 d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <strong>{selectedCustomer.account_number}</strong> — {selectedCustomer.account_name}
                        <span className="ms-3 badge bg-secondary">{selectedCustomer.credit_type}</span>
                        <span className="ms-2">Available: <b>{formatCurrency(selectedCustomer.available_credit)}</b></span>
                      </div>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedCustomer(null)}>
                        <i className="bi bi-x"></i> Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="input-group input-group-sm mb-2">
                        <span className="input-group-text"><i className="bi bi-search"></i></span>
                        <input type="text" className="form-control" placeholder="Search by name or account number..."
                          value={search} onChange={e => setSearch(e.target.value)} />
                        {search && (
                          <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>
                            <i className="bi bi-x"></i>
                          </button>
                        )}
                      </div>
                      <div className="border rounded" style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                          <div className="text-center text-muted py-3 small">No customers found</div>
                        ) : (
                          <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.8rem' }}>
                            <thead className="table-light sticky-top">
                              <tr>
                                <th>Account</th>
                                <th>Name</th>
                                <th>Type</th>
                                <th className="text-end">Available</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.slice(0, 50).map(c => {
                                const hasEnough = !isBusinessPayment || parseFloat(c.available_credit) >= saleTotal
                                const isBlocked = isBusinessPayment && c.is_suspended
                                return (
                                  <tr key={c.id_customer}
                                    className={isBusinessPayment ? (c.is_suspended ? 'table-warning' : (!hasEnough ? 'table-danger' : '')) : ''}
                                    style={{ cursor: isBlocked ? 'not-allowed' : 'pointer' }}
                                    onClick={() => { if (!isBlocked) selectCustomer(c) }}>
                                    <td><code>{c.account_number}</code></td>
                                    <td>{c.account_name}</td>
                                    <td><span className="badge bg-secondary">{c.credit_type}</span></td>
                                    <td className={`text-end fw-bold ${hasEnough ? 'text-success' : 'text-danger'}`}>
                                      {formatCurrency(c.available_credit)}
                                    </td>
                                    <td className="text-center">
                                      {c.is_suspended && <span className="badge bg-warning text-dark">Suspended</span>}
                                      {!c.is_suspended && !hasEnough && <span className="badge bg-danger">Insufficient</span>}
                                      {!c.is_suspended && hasEnough && <i className="bi bi-check-circle text-success"></i>}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </>
                  )}

                  {/* Validation messages */}
                  {isBusinessPayment && selectedCustomer && selectedCustomer.is_suspended && (
                    <div className="alert alert-danger py-1 mt-2 small mb-0">
                      <i className="bi bi-x-circle me-1"></i>
                      This customer is suspended and cannot receive corrected charges. Please select another customer or contact an administrator.
                    </div>
                  )}
                  {isBusinessPayment && selectedCustomer && parseFloat(selectedCustomer.available_credit) < saleTotal && !selectedCustomer.is_suspended && (
                    <div className="alert alert-warning py-1 mt-2 small mb-0">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      Low credit notice: this correction will be applied even if the customer's available credit becomes negative.
                    </div>
                  )}
                    </>
                  )}

                  <hr />

                  {/* Reason */}
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Reason <span className="text-danger">*</span></label>
                      <select className="form-select form-select-sm" value={reasonId} onChange={e => setReasonId(e.target.value)}>
                        <option value="">-- Select reason --</option>
                        {reasons.map(r => (
                          <option key={r.reassignment_reason_id} value={r.reassignment_reason_id}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Notes <span className="text-muted">(optional)</span></label>
                      <textarea className="form-control form-control-sm" rows="2" maxLength={500}
                        value={notes} onChange={e => setNotes(e.target.value)}
                        placeholder="Additional details..." />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>Cancel</button>
              <button
                className={`btn btn-sm ${walkInMode ? 'btn-warning' : 'btn-primary'}`}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Processing...</>
                  : walkInMode
                    ? <><i className="bi bi-person-x me-1"></i>Convert to Walk-in</>
                    : <><i className="bi bi-check-circle me-1"></i>{hasSourceCustomer ? 'Reassign Customer' : 'Assign Customer'}</>}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
    </>
  )
}

export default ReassignCustomerModal
