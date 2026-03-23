import { useState, useEffect } from 'react'
import api from '../../services/api'

function ReassignmentHistoryModal({ saleUid, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  useEffect(() => {
    fetchHistory()
  }, [saleUid])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/sales/${saleUid}/reassignment-history`)
      setHistory(res.data.data || [])
    } catch (err) {
      console.error('Error loading reassignment history:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-secondary text-white">
              <h5 className="modal-title"><i className="bi bi-clock-history me-2"></i>Reassignment History</h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {loading ? (
                <div className="text-center py-4"><div className="spinner-border text-primary"></div></div>
              ) : history.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-inbox fs-2 d-block mb-2"></i>
                  No reassignment history for this ticket.
                </div>
              ) : (
                <div className="timeline">
                  {history.map((item, idx) => (
                    <div key={item.reassignment_id} className="d-flex mb-3">
                      {/* Timeline dot */}
                      <div className="d-flex flex-column align-items-center me-3" style={{ minWidth: 30 }}>
                        <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center"
                          style={{ width: 28, height: 28, flexShrink: 0 }}>
                          <i className="bi bi-arrow-left-right text-white" style={{ fontSize: '0.7rem' }}></i>
                        </div>
                        {idx < history.length - 1 && (
                          <div style={{ width: 2, flexGrow: 1, backgroundColor: '#dee2e6', marginTop: 4 }}></div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="card flex-grow-1 shadow-sm">
                        <div className="card-body py-2 px-3">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <small className="text-muted">{formatDate(item.changed_at)}</small>
                            <span className="badge bg-light text-dark border">{formatCurrency(item.moved_amount)}</span>
                          </div>
                          <p className="mb-1 small">
                            <strong>{item.changed_by_name || 'System'}</strong> changed customer
                            from <code>{item.from_account_number}</code> / <em>{item.from_account_name}</em>
                            {' '}to <code>{item.to_account_number}</code> / <em>{item.to_account_name}</em>
                          </p>
                          <div className="d-flex gap-3">
                            <small className="text-muted">
                              <i className="bi bi-tag me-1"></i>{item.reason_label || '-'}
                            </small>
                            {item.reason_notes && (
                              <small className="text-muted">
                                <i className="bi bi-chat-left-text me-1"></i>{item.reason_notes}
                              </small>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
    </>
  )
}

export default ReassignmentHistoryModal