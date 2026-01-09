import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function SaleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sale, setSale] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paymentMethods, setPaymentMethods] = useState([])

  useEffect(() => {
    fetchSale()
    fetchPaymentMethods()
  }, [id])

  const fetchSale = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/sales/${id}`)
      setSale(response.data.data)
    } catch (error) {
      Swal.fire('Error', 'Could not load sale', 'error')
      navigate('/sales')
    } finally { setLoading(false) }
  }

  const fetchPaymentMethods = async () => {
    try {
      const response = await api.get('/catalogs/payment-methods')
      setPaymentMethods(response.data.data)
    } catch (error) { console.error(error) }
  }

  const handleCancel = async () => {
    const result = await Swal.fire({
      title: 'Cancel Sale?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Yes, cancel it'
    })
    if (result.isConfirmed) {
      try {
        await api.put(`/sales/${id}/cancel`, { reason_id: 1 })
        Swal.fire({ icon: 'success', title: 'Cancelled!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
        fetchSale()
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not cancel', 'error')
      }
    }
  }

  const handleChangePaymentMethod = async () => {
    const options = paymentMethods.reduce((acc, pm) => {
      acc[pm.method_id] = pm.name
      return acc
    }, {})

    const { value } = await Swal.fire({
      title: 'Change Payment Method',
      input: 'select',
      inputOptions: options,
      showCancelButton: true
    })

    if (value) {
      try {
        await api.put(`/sales/${id}/payment-method`, { method_id: value })
        Swal.fire({ icon: 'success', title: 'Updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
        fetchSale()
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not update', 'error')
      }
    }
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)
  const formatDate = (d) => d ? new Date(d).toLocaleString() : '-'

  const getStatusBadge = (code) => {
    const colors = { 'OPEN': 'warning', 'COMPLETED': 'success', 'CANCELLED': 'danger', 'REFUNDED': 'info' }
    return colors[code] || 'secondary'
  }

  if (loading) return <div className="container-fluid p-4 text-center"><div className="spinner-border text-primary"></div></div>
  if (!sale) return null

  const isCancelled = sale.status_code === 'CANCELLED'

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-receipt me-2"></i>
            Sale #{sale.sale_id}
            {sale.is_reweigh === 1 && <span className="badge bg-info ms-2">Re-weigh</span>}
          </h3>
          <p className="text-muted mb-0">{formatDate(sale.created_at)}</p>
        </div>
        <div>
          {!isCancelled && (
            <>
              <button className="btn btn-outline-primary me-2" onClick={handleChangePaymentMethod}>
                <i className="bi bi-credit-card me-1"></i>Change Payment
              </button>
              <button className="btn btn-outline-danger me-2" onClick={handleCancel}>
                <i className="bi bi-x-circle me-1"></i>Cancel Sale
              </button>
            </>
          )}
          <Link to="/sales" className="btn btn-outline-secondary">
            <i className="bi bi-arrow-left me-1"></i>Back
          </Link>
        </div>
      </div>

      <div className="row">
        {/* Left Column */}
        <div className="col-md-8">
          {/* Status & Totals */}
          <div className="card shadow-sm mb-3">
            <div className="card-body">
              <div className="row">
                <div className="col-md-3 text-center border-end">
                  <small className="text-muted">Status</small>
                  <h4><span className={`badge bg-${getStatusBadge(sale.status_code)}`}>{sale.status_label}</span></h4>
                </div>
                <div className="col-md-3 text-center border-end">
                  <small className="text-muted">Subtotal</small>
                  <h4>{formatCurrency(sale.subtotal)}</h4>
                </div>
                <div className="col-md-3 text-center border-end">
                  <small className="text-muted">Tax</small>
                  <h4>{formatCurrency(sale.tax_total)}</h4>
                </div>
                <div className="col-md-3 text-center">
                  <small className="text-muted">Total</small>
                  <h4 className="text-success fw-bold">{formatCurrency(sale.total)}</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Lines */}
          <div className="card shadow-sm mb-3">
            <div className="card-header"><h5 className="mb-0">Items</h5></div>
            <div className="card-body p-0">
              <table className="table mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th className="text-end">Qty</th>
                    <th className="text-end">Unit Price</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines?.map(line => (
                    <tr key={line.line_id}>
                      <td>{line.seq}</td>
                      <td>{line.product_name || line.description}</td>
                      <td className="text-end">{line.qty} {line.unit}</td>
                      <td className="text-end">{formatCurrency(line.unit_price)}</td>
                      <td className="text-end fw-bold">{formatCurrency(line.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments */}
          <div className="card shadow-sm mb-3">
            <div className="card-header"><h5 className="mb-0">Payments</h5></div>
            <div className="card-body p-0">
              <table className="table mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Method</th>
                    <th className="text-end">Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Received At</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.payments?.map(pay => (
                    <tr key={pay.payment_id}>
                      <td><i className="bi bi-credit-card me-2"></i>{pay.method_name}</td>
                      <td className="text-end fw-bold">{formatCurrency(pay.amount)}</td>
                      <td>{pay.reference_number || '-'}</td>
                      <td><span className="badge bg-success">{pay.status_label}</span></td>
                      <td><small>{formatDate(pay.received_at)}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-md-4">
          {/* Driver Info */}
          {sale.driver_info && (
            <div className="card shadow-sm mb-3">
              <div className="card-header"><h5 className="mb-0"><i className="bi bi-person me-2"></i>Driver Info</h5></div>
              <div className="card-body">
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr><th>Customer</th><td>{sale.driver_info.account_name || '-'}</td></tr>
                    <tr><th>Account #</th><td><code>{sale.driver_info.account_number || '-'}</code></td></tr>
                    <tr><th>Driver</th><td>{[sale.driver_info.driver_first_name, sale.driver_info.driver_last_name].filter(Boolean).join(' ') || '-'}</td></tr>
                    <tr><th>License</th><td>{sale.driver_info.license_number || '-'}</td></tr>
                    <tr><th>Plates</th><td><code>{sale.driver_info.vehicle_plates || '-'}</code></td></tr>
                    <tr><th>Trailer</th><td>{sale.driver_info.trailer_number || '-'}</td></tr>
                    <tr><th>Tractor</th><td>{sale.driver_info.tractor_number || '-'}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tickets */}
          {sale.tickets?.length > 0 && (
            <div className="card shadow-sm mb-3">
              <div className="card-header"><h5 className="mb-0"><i className="bi bi-printer me-2"></i>Tickets</h5></div>
              <ul className="list-group list-group-flush">
                {sale.tickets.map(t => (
                  <li key={t.ticket_id} className="list-group-item d-flex justify-content-between">
                    <span><code>{t.ticket_number}</code></span>
                    <span className="badge bg-secondary">{t.status_label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Original Sale (if reweigh) */}
          {sale.original_sale && (
            <div className="card shadow-sm border-info">
              <div className="card-header bg-info text-white"><h6 className="mb-0">Original Weigh</h6></div>
              <div className="card-body">
                <p className="mb-1"><b>Sale #:</b> {sale.original_sale.sale_id}</p>
                <p className="mb-1"><b>Total:</b> {formatCurrency(sale.original_sale.total)}</p>
                <p className="mb-0"><b>Date:</b> {formatDate(sale.original_sale.created_at)}</p>
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className="card shadow-sm mt-3">
            <div className="card-header"><h6 className="mb-0">Details</h6></div>
            <div className="card-body small">
              <p className="mb-1"><b>Operator:</b> {sale.operator_name}</p>
              <p className="mb-1"><b>Terminal:</b> {sale.terminal_id}</p>
              <p className="mb-1"><b>Site:</b> {sale.site_id}</p>
              <p className="mb-0"><b>UID:</b> <code className="small">{sale.sale_uid}</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SaleDetail