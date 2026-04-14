import { useState, useEffect } from 'react'
import api from '../../services/api'
import Swal from 'sweetalert2'

function ConvertToReweighModal({ sale, onClose, onSuccess }) {
  const [products, setProducts] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [originalTicketNumber, setOriginalTicketNumber] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [lockedProduct, setLockedProduct] = useState(null)
  const [newFee, setNewFee] = useState('')
  const [notes, setNotes] = useState('')

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)

  useEffect(() => {
    loadProducts()
  }, [])

  // Pre-fill fee when product selection changes
  useEffect(() => {
    if (selectedProductId && products.length > 0) {
      const prod = products.find(p => String(p.product_id) === String(selectedProductId))
      if (prod && prod.default_price != null) {
        setNewFee(String(prod.default_price))
      }
    }
  }, [selectedProductId, products])

  const loadProducts = async () => {
    try {
      setLoadingData(true)
      const res = await api.get('/sales/reweigh-products')
      const items = res.data.data || []
      setProducts(items)

      // Buscar producto oficial de Reweigh
      const fixedReweigh =
        items.find(p =>
          String(p.code || '').toLowerCase().includes('reweigh') ||
          String(p.name || '').toLowerCase().includes('reweigh')
        ) || items[0] || null

      if (!fixedReweigh) {
        Swal.fire('Error', 'No Reweigh product is configured.', 'error')
        return
      }

      setLockedProduct(fixedReweigh)
      setSelectedProductId(String(fixedReweigh.product_id))

      if (fixedReweigh.default_price != null) {
        setNewFee(String(fixedReweigh.default_price))
      }
    } catch (err) {
      console.error('Error loading products:', err)
      Swal.fire('Error', 'Could not load product catalog.', 'error')
    } finally {
      setLoadingData(false)
    }
  }

  const selectedProduct = lockedProduct
  const feeNum = parseFloat(newFee)
  const taxPct = selectedProduct ? (parseFloat(selectedProduct.tax_percent) || 0) : 0
  const previewTax = selectedProduct?.taxable ? parseFloat((feeNum * taxPct / 100).toFixed(2)) : 0
  const previewTotal = isNaN(feeNum) ? 0 : parseFloat((feeNum + previewTax).toFixed(2))

  const canSubmit =
    !submitting &&
    originalTicketNumber.trim().length > 0 &&
    selectedProductId !== '' &&
    !isNaN(feeNum) &&
    feeNum >= 0

  const handleSubmit = async () => {
    if (!canSubmit) return

    const confirm = await Swal.fire({
      title: 'Convert to Reweigh?',
      html: `
        <p class="mb-1">Ticket <b>#${sale.ticket_number || sale.sale_id}</b> will be converted to <b>Reweigh</b>.</p>
        <p class="mb-1">Original Weigh ticket: <b>${originalTicketNumber.trim()}</b></p>
        <p class="mb-1">New product: <b>${selectedProduct?.name || ''}</b></p>
        <p class="mb-0">New total: <b>${formatCurrency(previewTotal)}</b></p>
        <p class="mt-2 text-danger small"><i class="bi bi-exclamation-triangle me-1"></i>This action cannot be undone.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Yes, convert it'
    })

    if (!confirm.isConfirmed) return

    try {
      setSubmitting(true)
      await api.post(`/sales/${sale.sale_uid}/convert-to-reweigh`, {
        original_ticket_number: originalTicketNumber.trim(),
        product_id: Number(selectedProductId),
        new_fee: feeNum,
        notes: notes.trim() || null
      })
      Swal.fire({
        icon: 'success',
        title: 'Converted to Reweigh successfully',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      })
      onSuccess()
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Could not convert sale.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">

            <div className="modal-header bg-warning text-dark">
              <h5 className="modal-title">
                <i className="bi bi-arrow-repeat me-2"></i>Convert to Re-weigh
              </h5>
              <button type="button" className="btn-close" onClick={onClose} disabled={submitting}></button>
            </div>

            <div className="modal-body">
              {loadingData ? (
                <div className="text-center py-4"><div className="spinner-border text-warning"></div></div>
              ) : (
                <>
                  {/* Current ticket info (read-only) */}
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Current Ticket</label>
                      <input className="form-control form-control-sm" readOnly
                        value={`#${sale.ticket_number || sale.sale_id}`} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Customer</label>
                      <input className="form-control form-control-sm" readOnly
                        value={sale.driver_info?.account_name || sale.driver_info?.account_number || '-'} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Plates</label>
                      <input className="form-control form-control-sm" readOnly
                        value={sale.driver_info?.vehicle_plates || '-'} />
                    </div>
                  </div>

                  <hr />

                  {/* Original Weigh ticket */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      Original Weigh Ticket # <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="form-control form-control-sm"
                      placeholder="Enter ticket number"
                      value={originalTicketNumber}
                      onChange={e => setOriginalTicketNumber(e.target.value.replace(/\D/g, ''))}
                      disabled={submitting}
                      autoFocus
                    />
                    <div className="form-text text-muted">
                      Numbers only. Must belong to the same customer.
                    </div>
                  </div>

                  {/* Reweigh product */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      Reweigh Product <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={selectedProductId}
                      onChange={e => setSelectedProductId(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">-- Select product --</option>
                      {products.map(p => (
                        <option key={p.product_id} value={p.product_id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Service fee */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      Service Fee (pre-tax) <span className="text-danger">*</span>
                    </label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        step="0.01"
                        value={newFee}
                        onChange={e => setNewFee(e.target.value)}
                        disabled={submitting}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Price preview */}
                  {selectedProduct && !isNaN(feeNum) && (
                    <div className="alert alert-light border py-2 mb-3 small">
                      <div className="d-flex justify-content-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(feeNum)}</span>
                      </div>
                      {selectedProduct.taxable && (
                        <div className="d-flex justify-content-between">
                          <span>Tax ({taxPct}%)</span>
                          <span>{formatCurrency(previewTax)}</span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between fw-bold border-top pt-1 mt-1">
                        <span>New Total</span>
                        <span className="text-success">{formatCurrency(previewTotal)}</span>
                      </div>
                      <div className="d-flex justify-content-between text-muted mt-1">
                        <span>Current Total</span>
                        <span>{formatCurrency(sale.total)}</span>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="mb-1">
                    <label className="form-label small fw-bold">
                      Notes <span className="text-muted">(optional)</span>
                    </label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="2"
                      maxLength={500}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      disabled={submitting}
                      placeholder="Reason or additional details..."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                className="btn btn-warning btn-sm"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Processing...</>
                  : <><i className="bi bi-arrow-repeat me-1"></i>Convert to Re-weigh</>}
              </button>
            </div>

          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
    </>
  )
}

export default ConvertToReweighModal
