import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function SalesReport() {
  const [data, setData] = useState([])
  const [totals, setTotals] = useState({})
  const [paymentSummary, setPaymentSummary] = useState({})
  const [filterOptions, setFilterOptions] = useState({})
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState({ pdf: false, excel: false })

  // Filtros - default: últimos 7 días
  const today = new Date().toISOString().split('T')[0]
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [filters, setFilters] = useState({
    date_from: lastWeek,
    date_to: today,
    product_id: 'all',
    customer_id: 'all',
    operator_id: 'all',
    payment_method_id: 'all',
    status_id: 'all'
  })

  useEffect(() => {
    loadFilterOptions()
    fetchData()
  }, [])

  const loadFilterOptions = async () => {
    try {
      const response = await api.get('/reports/sales/filters')
      setFilterOptions(response.data.data)
    } catch (error) {
      console.error('Error loading filter options:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      const response = await api.get(`/reports/sales?${params}`)
      setData(response.data.data.data)
      setTotals(response.data.data.totals)
      setPaymentSummary(response.data.data.payment_summary || {})
    } catch (error) {
      Swal.fire('Error', 'Could not load report data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const applyFilters = () => fetchData()

  const exportFile = async (type) => {
    try {
      setExporting(prev => ({ ...prev, [type]: true }))
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })

      const response = await api.get(`/reports/sales/${type}?${params}`, {
        responseType: 'blob'
      })

      const ext = type === 'pdf' ? 'pdf' : 'xlsx'
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `sales-report-${Date.now()}.${ext}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      Swal.fire({
        icon: 'success',
        title: `${type.toUpperCase()} Downloaded!`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      })
    } catch (error) {
      Swal.fire('Error', `Could not generate ${type.toUpperCase()}`, 'error')
    } finally {
      setExporting(prev => ({ ...prev, [type]: false }))
    }
  }

  const formatCurrency = (val) => {
    if (!val) return '$0.00'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
  }

  const formatNumber = (val) => {
    if (!val) return '0.00'
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(val)
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Link to="/reports" className="text-decoration-none text-muted small">
            <i className="bi bi-arrow-left me-1"></i>Back to Reports
          </Link>
          <h3 className="mb-1 mt-2">
            <i className="bi bi-receipt me-2"></i>
            Sales Report
          </h3>
          <p className="text-muted mb-0">Transaction details and sales summary</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-danger"
            onClick={() => exportFile('pdf')}
            disabled={exporting.pdf || data.length === 0}
          >
            {exporting.pdf ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-file-pdf me-2"></i>}
            Export PDF
          </button>
          <button
            className="btn btn-success"
            onClick={() => exportFile('excel')}
            disabled={exporting.excel || data.length === 0}
          >
            {exporting.excel ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-file-excel me-2"></i>}
            Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-header bg-white">
          <i className="bi bi-funnel me-2"></i>Filters
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-2">
              <label className="form-label small">From</label>
              <input type="date" className="form-control form-control-sm" name="date_from" value={filters.date_from} onChange={handleFilterChange} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">To</label>
              <input type="date" className="form-control form-control-sm" name="date_to" value={filters.date_to} onChange={handleFilterChange} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Type</label>
              <select className="form-select form-select-sm" name="product_id" value={filters.product_id} onChange={handleFilterChange}>
                <option value="all">All</option>
                {(filterOptions.products || []).map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Customer</label>
              <select className="form-select form-select-sm" name="customer_id" value={filters.customer_id} onChange={handleFilterChange}>
                <option value="all">All</option>
                {(filterOptions.customers || []).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Scale Op</label>
              <select className="form-select form-select-sm" name="operator_id" value={filters.operator_id} onChange={handleFilterChange}>
                <option value="all">All</option>
                {(filterOptions.users || []).map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Payment</label>
              <select className="form-select form-select-sm" name="payment_method_id" value={filters.payment_method_id} onChange={handleFilterChange}>
                <option value="all">All</option>
                {(filterOptions.paymentMethods || []).map(pm => (
                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Status</label>
              <select className="form-select form-select-sm" name="status_id" value={filters.status_id} onChange={handleFilterChange}>
                <option value="all">All</option>
                {(filterOptions.statuses || []).map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-primary btn-sm w-100" onClick={applyFilters} disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-search me-2"></i>}
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {totals.total_transactions > 0 && (
        <div className="row g-3 mb-4">
          <div className="col">
            <div className="card text-center">
              <div className="card-body py-2">
                <h4 className="mb-0 text-primary">{totals.total_transactions}</h4>
                <small className="text-muted">Transactions</small>
              </div>
            </div>
          </div>
          <div className="col">
            <div className="card text-center">
              <div className="card-body py-2">
                <h4 className="mb-0" style={{ color: '#17a2b8' }}>{totals.total_weigh}</h4>
                <small className="text-muted">Weigh</small>
              </div>
            </div>
          </div>
          <div className="col">
            <div className="card text-center">
              <div className="card-body py-2">
                <h4 className="mb-0" style={{ color: '#6f42c1' }}>{totals.total_reweigh}</h4>
                <small className="text-muted">Reweigh</small>
              </div>
            </div>
          </div>
          <div className="col">
            <div className="card text-center">
              <div className="card-body py-2">
                <h4 className="mb-0 text-dark">{formatNumber(totals.total_gross_weight)} lb</h4>
                <small className="text-muted">Total Weight</small>
              </div>
            </div>
          </div>
          <div className="col">
            <div className="card text-center">
              <div className="card-body py-2">
                <h4 className="mb-0 fw-bold">{formatCurrency(totals.total_amount)}</h4>
                <small className="text-muted">Total</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Summary */}
      {Object.keys(paymentSummary).length > 0 && (
        <div className="card mb-4">
          <div className="card-header bg-white">
            <i className="bi bi-wallet2 me-2"></i>Balance Summary by Payment Method
          </div>
          <div className="card-body p-0">
            <table className="table table-sm mb-0">
              <thead className="table-light">
                <tr>
                  <th>Method</th>
                  <th className="text-end">Qty</th>
                  <th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(paymentSummary).map(item => (
                  <tr key={item.key}>
                    <td>{item.label}</td>
                    <td className="text-end">{item.count}</td>
                    <td className="text-end">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <span><i className="bi bi-table me-2"></i>Transactions</span>
          <span className="badge bg-secondary">{data.length} records</span>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary"></div>
              <p className="mt-2 text-muted">Loading...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              No transactions found for this period
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: '500px' }}>
              <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.8rem' }}>
                <thead className="table-dark sticky-top">
                  <tr>
                    <th>Ticket #</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Driver</th>
                    <th>Trailer#</th>
                    <th>Tractor#</th>
                    <th>Scale Op</th>
                    <th>Plates</th>
                    <th>Payment</th>
                    <th className="text-end">Weight</th>
                    <th className="text-end">Subtotal</th>
                    <th className="text-end">Tax</th>
                    <th className="text-end">Total</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => {
                    const driverName = [row.driver_first_name, row.driver_last_name].filter(Boolean).join(' ') || '-'
                    return (
                      <tr key={`${row.ticket_number}-${index}`}>
                        <td><code>{row.ticket_number}</code></td>
                        <td>
                          <span
                            className="badge"
                            style={{ backgroundColor: row.product_type === 'Weigh' ? '#17a2b8' : '#6f42c1' }}
                          >
                            {row.product_type}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(row.created_at)}</td>
                        <td>{row.customer_name || <span className="text-muted">Walk-in</span>}</td>
                        <td>{driverName}</td>
                        <td>{row.trailer_number || '-'}</td>
                        <td>{row.tractor_number || '-'}</td>
                        <td>{row.operator_name || '-'}</td>
                        <td>{row.vehicle_plates || '-'}</td>
                        <td>{row.payment_method || '-'}</td>
                        <td className="text-end">{formatNumber(row.gross_weight)}</td>
                        <td className="text-end">{formatCurrency(row.subtotal)}</td>
                        <td className="text-end">{formatCurrency(row.tax_amount)}</td>
                        <td className="text-end fw-bold">{formatCurrency(row.total_amount)}</td>
                        <td className="text-center">
                          <span className="badge bg-success">{row.status_label || row.status_code || '-'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SalesReport