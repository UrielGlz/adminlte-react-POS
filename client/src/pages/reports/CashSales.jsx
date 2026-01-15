import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function CashSales() {
  const [data, setData] = useState({ transactions: [], totals: {} })
  const [filterOptions, setFilterOptions] = useState({})
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState({ pdf: false, excel: false })

  // Filtros - default: último mes
  const today = new Date().toISOString().split('T')[0]
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const [filters, setFilters] = useState({
    date_from: lastMonth,
    date_to: today,
    payment_method: 'all',
    product_type: 'all',
    sale_status: 'all'
  })

  useEffect(() => {
    loadFilterOptions()
    fetchData()
  }, [])

  const loadFilterOptions = async () => {
    try {
      const response = await api.get('/reports/cash-sales/filters')
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
      const response = await api.get(`/reports/cash-sales?${params}`)
      setData(response.data.data)
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
      
      const response = await api.get(`/reports/cash-sales/${type}?${params}`, {
        responseType: 'blob'
      })

      const ext = type === 'pdf' ? 'pdf' : 'xlsx'
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `cash-sales-${Date.now()}.${ext}`)
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

  const getStatusBadge = (statusCode) => {
    const styles = {
      'COMPLETED': 'bg-success',
      'OPEN': 'bg-warning text-dark',
      'CANCELLED': 'bg-danger',
      'REFUNDED': 'bg-secondary'
    }
    return styles[statusCode] || 'bg-secondary'
  }

  const { transactions, totals } = data

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Link to="/reports" className="text-decoration-none text-muted small">
            <i className="bi bi-arrow-left me-1"></i>Back to Reports
          </Link>
          <h3 className="mb-1 mt-2">
            <i className="bi bi-cash-stack me-2 text-info"></i>
            Cash Sales Report
          </h3>
          <p className="text-muted mb-0">Transactions without associated customer account</p>
        </div>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-danger" 
            onClick={() => exportFile('pdf')}
            disabled={exporting.pdf}
          >
            {exporting.pdf ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-file-pdf me-2"></i>}
            Export PDF
          </button>
          <button 
            className="btn btn-success" 
            onClick={() => exportFile('excel')}
            disabled={exporting.excel}
          >
            {exporting.excel ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-file-excel me-2"></i>}
            Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-light">
          <h6 className="mb-0"><i className="bi bi-funnel me-2"></i>Filters</h6>
        </div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-2">
              <label className="form-label small">Date From</label>
              <input
                type="date"
                className="form-control"
                name="date_from"
                value={filters.date_from}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Date To</label>
              <input
                type="date"
                className="form-control"
                name="date_to"
                value={filters.date_to}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Payment Method</label>
              <select 
                className="form-select" 
                name="payment_method" 
                value={filters.payment_method} 
                onChange={handleFilterChange}
              >
                <option value="all">All Methods</option>
                {filterOptions.paymentMethods?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Transaction Type</label>
              <select 
                className="form-select" 
                name="product_type" 
                value={filters.product_type} 
                onChange={handleFilterChange}
              >
                <option value="all">All Types</option>
                {filterOptions.products?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Status</label>
              <select 
                className="form-select" 
                name="sale_status" 
                value={filters.sale_status} 
                onChange={handleFilterChange}
              >
                <option value="all">All Status</option>
                {filterOptions.saleStatuses?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary w-100" onClick={applyFilters}>
                <i className="bi bi-search me-2"></i>Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col">
          <div className="card bg-info text-white">
            <div className="card-body py-3 text-center">
              <h4 className="mb-0">{totals.total_transactions || 0}</h4>
              <small>Cash Transactions</small>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card text-white" style={{backgroundColor: '#17a2b8'}}>
            <div className="card-body py-3 text-center">
              <h4 className="mb-0">{totals.total_weigh || 0}</h4>
              <small>Weigh</small>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card text-white" style={{backgroundColor: '#6f42c1'}}>
            <div className="card-body py-3 text-center">
              <h4 className="mb-0">{totals.total_reweigh || 0}</h4>
              <small>Reweigh</small>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card bg-success text-white">
            <div className="card-body py-3 text-center">
              <h4 className="mb-0">{totals.count_completed || 0}</h4>
              <small>Completed</small>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card bg-warning text-dark">
            <div className="card-body py-3 text-center">
              <h4 className="mb-0">{totals.count_open || 0}</h4>
              <small>Pending</small>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card bg-danger text-white">
            <div className="card-body py-3 text-center">
              <h4 className="mb-0">{totals.count_cancelled || 0}</h4>
              <small>Cancelled</small>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-light">
              <h6 className="mb-0"><i className="bi bi-calculator me-2"></i>Financial Summary</h6>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col">
                  <small className="text-muted d-block">Total Weight</small>
                  <h5>{formatNumber(totals.total_weight)} lb</h5>
                </div>
                <div className="col">
                  <small className="text-muted d-block">Subtotal</small>
                  <h5>{formatCurrency(totals.total_subtotal)}</h5>
                </div>
                <div className="col">
                  <small className="text-muted d-block">Tax</small>
                  <h5>{formatCurrency(totals.total_tax)}</h5>
                </div>
                <div className="col">
                  <small className="text-muted d-block">Total</small>
                  <h5 className="fw-bold">{formatCurrency(totals.total_amount)}</h5>
                </div>
                <div className="col">
                  <small className="text-muted d-block">Paid</small>
                  <h5 className="text-success">{formatCurrency(totals.total_paid)}</h5>
                </div>
                <div className="col">
                  <small className="text-muted d-block">Pending</small>
                  <h5 className="text-danger">{formatCurrency(totals.total_pending)}</h5>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-light">
              <h6 className="mb-0"><i className="bi bi-credit-card me-2"></i>By Payment Method</h6>
            </div>
            <div className="card-body">
              {totals.by_payment_method && Object.entries(totals.by_payment_method).length > 0 ? (
                <ul className="list-unstyled mb-0">
                  {Object.entries(totals.by_payment_method).map(([method, data]) => (
                    <li key={method} className="d-flex justify-content-between border-bottom py-2">
                      <span>{method}</span>
                      <span>
                        <span className="badge bg-secondary me-2">{data.count}</span>
                        <strong>{formatCurrency(data.amount)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-center mb-0">No data</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-info mb-3"></div>
            <p className="text-muted">Loading transactions...</p>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      {!loading && (
        <div className="card shadow-sm">
          <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
            <h6 className="mb-0">
              <i className="bi bi-list-ul me-2"></i>Cash Transactions
            </h6>
            <span className="badge bg-light text-dark">{transactions.length} records</span>
          </div>
          <div className="card-body p-0">
            {transactions.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                No cash transactions found for the selected filters
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: '500px' }}>
                <table className="table table-sm table-hover mb-0">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th>Ticket #</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Driver</th>
                      <th>Phone</th>
                      <th>Plates</th>
                      <th className="text-end">Weight</th>
                      <th className="text-end">Subtotal</th>
                      <th className="text-end">Tax</th>
                      <th className="text-end">Total</th>
                      <th className="text-end">Paid</th>
                      <th>Method</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(row => (
                      <tr key={row.ticket_id}>
                        <td><code>{row.ticket_number}</code></td>
                        <td>
                          <span 
                            className="badge" 
                            style={{backgroundColor: row.product_type === 'Weigh' ? '#17a2b8' : '#6f42c1'}}
                          >
                            {row.product_type}
                          </span>
                        </td>
                        <td className="small">{formatDate(row.sale_date)}</td>
                        <td>{row.driver_first_name} {row.driver_last_name}</td>
                        <td className="small">{row.driver_phone || '-'}</td>
                        <td>{row.vehicle_plates || '-'}</td>
                        <td className="text-end">{formatNumber(row.gross_weight)}</td>
                        <td className="text-end">{formatCurrency(row.subtotal)}</td>
                        <td className="text-end">{formatCurrency(row.tax_amount)}</td>
                        <td className="text-end fw-bold">{formatCurrency(row.total_amount)}</td>
                        <td className="text-end">{formatCurrency(row.amount_paid)}</td>
                        <td>{row.payment_method || '-'}</td>
                        <td className="text-center">
                          <span className={`badge ${getStatusBadge(row.sale_status_code)}`}>
                            {row.sale_status_label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="card shadow-sm mt-4 border-info">
        <div className="card-body">
          <div className="d-flex align-items-start">
            <i className="bi bi-info-circle text-info fs-4 me-3"></i>
            <div>
              <h6 className="text-info mb-1">About Cash Sales</h6>
              <p className="text-muted mb-0 small">
                This report shows all transactions where no customer account was associated. 
                These are walk-in customers paying at the time of service without a credit account. 
                In accounting terms, these are "General Public Sales" or "Cash Sales".
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CashSales