import { useState, useEffect } from 'react'
import api from '../../services/api'

function CancelSaleModal({ sale, onClose, onSuccess }) {
  const [reasons, setReasons] = useState([])
  const [selectedReasonId, setSelectedReasonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    api.get('/sales/void-reasons')
      .then(res => setReasons(res.data.data || []))
      .catch(() => setReasons([]))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    setTouched(true)
    if (!selectedReasonId) return

    setSubmitting(true)
    try {
      await onSuccess(Number(selectedReasonId))
    } finally {
      setSubmitting(false)
    }
  }

  const showError = touched && !selectedReasonId

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header border-danger">
            <h5 className="modal-title text-danger">
              <i className="bi bi-x-octagon me-2"></i>Cancel Sale
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={submitting}></button>
          </div>

          <div className="modal-body">
            <div className="alert alert-warning d-flex align-items-center mb-3">
              <i className="bi bi-exclamation-triangle-fill me-2 flex-shrink-0"></i>
              <div>
                <strong>This action cannot be undone.</strong> The sale will be permanently cancelled
                and all associated payments will be voided.
              </div>
            </div>

            <div className="mb-1">
              <p className="mb-1 text-muted small">
                Ticket: <strong>#{sale.ticket_number || sale.sale_id}</strong>
              </p>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">
                Cancellation Reason <span className="text-danger">*</span>
              </label>
              {loading ? (
                <div className="text-muted small"><span className="spinner-border spinner-border-sm me-1"></span> Loading reasons...</div>
              ) : (
                <select
                  className={`form-select ${showError ? 'is-invalid' : ''}`}
                  value={selectedReasonId}
                  onChange={e => { setSelectedReasonId(e.target.value); setTouched(true) }}
                >
                  <option value="">-- Select a reason --</option>
                  {reasons.map(r => (
                    <option key={r.void_reason_id} value={r.void_reason_id}>{r.label}</option>
                  ))}
                </select>
              )}
              {showError && (
                <div className="invalid-feedback">A cancellation reason is required.</div>
              )}
            </div>
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
              className="btn btn-danger"
              onClick={handleSubmit}
              disabled={submitting || loading}
            >
              {submitting
                ? <><span className="spinner-border spinner-border-sm me-1"></span> Cancelling...</>
                : <><i className="bi bi-x-circle me-1"></i>Confirm Cancel</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CancelSaleModal
