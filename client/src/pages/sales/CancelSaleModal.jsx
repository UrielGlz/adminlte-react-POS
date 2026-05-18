import { useState, useEffect } from 'react'
import api from '../../services/api'

function CancelSaleModal({ sale, onClose, onSuccess }) {
  const [reasons, setReasons] = useState([])
  const [selectedReasonId, setSelectedReasonId] = useState('')
  const [voidReasonNote, setVoidReasonNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)
  const [noteTouched, setNoteTouched] = useState(false)

  useEffect(() => {
    api.get('/sales/void-reasons')
      .then(res => setReasons(res.data.data || []))
      .catch(() => setReasons([]))
      .finally(() => setLoading(false))
  }, [])

  const selectedReason = reasons.find(r => String(r.void_reason_id) === String(selectedReasonId))
  const isOther = selectedReason?.code === 'OTHER'

  const handleReasonChange = (e) => {
    setSelectedReasonId(e.target.value)
    setTouched(true)
    setVoidReasonNote('')
    setNoteTouched(false)
  }

  const handleSubmit = async () => {
    setTouched(true)
    if (isOther) setNoteTouched(true)
    if (!selectedReasonId) return
    if (isOther && !voidReasonNote.trim()) return

    setSubmitting(true)
    try {
      await onSuccess({
        void_reason_id: Number(selectedReasonId),
        void_reason_note: isOther ? voidReasonNote.trim() : null
      })
    } finally {
      setSubmitting(false)
    }
  }

  const showReasonError = touched && !selectedReasonId
  const showNoteError = isOther && noteTouched && !voidReasonNote.trim()

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
                  className={`form-select ${showReasonError ? 'is-invalid' : ''}`}
                  value={selectedReasonId}
                  onChange={handleReasonChange}
                >
                  <option value="">-- Select a reason --</option>
                  {reasons.map(r => (
                    <option key={r.void_reason_id} value={r.void_reason_id}>{r.label}</option>
                  ))}
                </select>
              )}
              {showReasonError && (
                <div className="invalid-feedback">A cancellation reason is required.</div>
              )}
            </div>

            {isOther && (
              <div className="mb-3">
                <label className="form-label fw-semibold">
                  Reason Details <span className="text-danger">*</span>
                </label>
                <textarea
                  className={`form-control ${showNoteError ? 'is-invalid' : ''}`}
                  rows={3}
                  maxLength={500}
                  placeholder="Please describe the reason for cancellation..."
                  value={voidReasonNote}
                  onChange={e => { setVoidReasonNote(e.target.value); setNoteTouched(true) }}
                />
                <div className="d-flex justify-content-between align-items-start mt-1">
                  {showNoteError
                    ? <div className="text-danger small">A reason description is required.</div>
                    : <div />
                  }
                  <small className="text-muted ms-auto">{voidReasonNote.length}/500</small>
                </div>
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
