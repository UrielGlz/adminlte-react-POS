import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function CustomerStatement() {
  const [data, setData] = useState({ customer: null, transactions: [], totals: {} })
  const [filterOptions, setFilterOptions] = useState({})
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState({ pdf: false, excel: false })

  // Filtros - default: último mes
  const today = new Date().toISOString().split('T')[0]
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const [filters, setFilters] = useState({
    customer_id: '',
    date_from: lastMonth,
    date_to: today
  })

  useEffect(() => {
    loadFilterOptions()
  }, [])

  const loadFilterOptions = async () => {
    try {
      const response = await api.get('/reports/customer-statement/filters')
      console.log(response);
      setFilterOptions(response.data.data)
    } catch (error) {
      console.error('Error loading filter options:', error)
    }
  }

  const fetchData = async () => {
    if (!filters.customer_id) {
      Swal.fire('Warning', 'Please select a customer', 'warning')
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      const response = await api.get(`/reports/customer-statement?${params}`)
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
    if (!filters.customer_id) {
      Swal.fire('Warning', 'Please select a customer first', 'warning')
      return
    }

    try {
      setExporting(prev => ({ ...prev, [type]: true }))
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const response = await api.get(`/reports/customer-statement/${type}?${params}`, {
        responseType: 'blob'
      })

      const ext = type === 'pdf' ? 'pdf' : 'xlsx'
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `customer-statement-${Date.now()}.${ext}`)
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

  const getStatusBadge = (paymentStatus, saleStatus) => {
    if (saleStatus === 'CANCELLED') return <span className="badge bg-danger">Cancelled</span>
    if (paymentStatus === 'RECEIVED') return <span className="badge bg-success">Paid</span>
    if (paymentStatus === 'PENDING') return <span className="badge bg-warning text-dark">Pending</span>
    return <span className="badge bg-secondary">-</span>
  }

  const { customer, transactions, totals } = data

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Link to="/reports" className="text-decoration-none text-muted small">
            <i className="bi bi-arrow-left me-1"></i>Back to Reports
          </Link>
          <h3 className="mb-1 mt-2">
            <i className="bi bi-person-lines-fill me-2"></i>
            Customer Statement
          </h3>
          <p className="text-muted mb-0">Account summary and transaction history</p>
        </div>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-danger" 
            onClick={() => exportFile('pdf')}
            disabled={exporting.pdf || !customer}
          >
            {exporting.pdf ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-file-pdf me-2"></i>}
            Export PDF
          </button>
          <button 
            className="btn btn-success" 
            onClick={() => exportFile('excel')}
            disabled={exporting.excel || !customer}
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
            <div className="col-md-4">
              <label className="form-label small">Customer <span className="text-danger">*</span></label>
              <select 
                className="form-select" 
                name="customer_id" 
                value={filters.customer_id} 
                onChange={handleFilterChange}
              >
                <option value="">-- Select Customer --</option>
                {filterOptions.customers?.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.account_number})
                  </option>
                ))}
              </select>
            </div>
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
              <button className="btn btn-primary w-100" onClick={applyFilters}>
                <i className="bi bi-search me-2"></i>Generate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* No customer selected */}
      {!customer && !loading && (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-person-circle fs-1 d-block mb-3"></i>
            <h5>Select a customer to generate statement</h5>
            <p>Choose a customer from the dropdown and click "Generate"</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary mb-3"></div>
            <p className="text-muted">Loading statement...</p>
          </div>
        </div>
      )}

      {/* Customer Info & Summary */}
      {customer && !loading && (
        <>
          {/* Customer Info Card */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-primary text-white">
              <h6 className="mb-0"><i className="bi bi-person me-2"></i>Customer Information</h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <table className="table table-sm table-borderless mb-0">
                    <tbody>
                      <tr>
                        <td className="text-muted" style={{width: '120px'}}>Account #:</td>
                        <td className="fw-bold">{customer.account_number}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Name:</td>
                        <td className="fw-bold">{customer.account_name}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Address:</td>
                        <td>{customer.account_address || '-'}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">City/State:</td>
                        <td>{customer.city || '-'}, {customer.account_state || '-'}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Phone:</td>
                        <td>{customer.phone_number || '-'}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Tax ID:</td>
                        <td>{customer.tax_id || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="col-md-6">
                  {customer.has_credit ? (
                    <div className="bg-light rounded p-3">
                      <h6 className="text-primary mb-3">
                        <i className="bi bi-credit-card me-2"></i>
                        Credit Account ({customer.credit_type})
                      </h6>
                      <div className="row g-2">
                        <div className="col-6">
                          <small className="text-muted d-block">Credit Limit</small>
                          <strong>{formatCurrency(customer.credit_limit)}</strong>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Current Balance</small>
                          <strong className="text-danger">{formatCurrency(customer.current_balance)}</strong>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Available Credit</small>
                          <strong className="text-success">{formatCurrency(customer.available_credit)}</strong>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Payment Terms</small>
                          <strong>{customer.payment_terms_days || 30} days</strong>
                        </div>
                      </div>
                      {customer.is_suspended && (
                        <div className="alert alert-danger mt-3 mb-0 py-2">
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          Account Suspended
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-light rounded p-3 text-center text-muted">
                      <i className="bi bi-credit-card-2-back fs-3 d-block mb-2"></i>
                      No credit account
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="row mb-4">
            <div className="col">
              <div className="card bg-primary text-white">
                <div className="card-body py-3 text-center">
                  <h4 className="mb-0">{totals.total_transactions || 0}</h4>
                  <small>Transactions</small>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="card bg-info text-white">
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
                  <h4 className="mb-0">{totals.count_paid || 0}</h4>
                  <small>Paid</small>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="card bg-warning text-dark">
                <div className="card-body py-3 text-center">
                  <h4 className="mb-0">{totals.count_pending || 0}</h4>
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
              <div className="card shadow-sm h-100 border-primary">
                <div className="card-header bg-primary text-white">
                  <h6 className="mb-0"><i className="bi bi-cash-stack me-2"></i>Balance Due</h6>
                </div>
                <div className="card-body d-flex align-items-center justify-content-center">
                  <h2 className={totals.total_pending > 0 ? 'text-danger' : 'text-success'}>
                    {formatCurrency(totals.total_pending)}
                  </h2>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="card shadow-sm">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <h6 className="mb-0"><i className="bi bi-list-ul me-2"></i>Transaction Details</h6>
              <span className="badge bg-secondary">{transactions.length} tickets</span>
            </div>
            <div className="card-body p-0">
              {transactions.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  No transactions found for this period
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                  <table className="table table-sm table-hover mb-0">
                    <thead className="table-dark sticky-top">
                      <tr>
                        <th>Ticket #</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Driver</th>
                        <th>Plates</th>
                        <th className="text-end">Weight</th>
                        <th className="text-end">Subtotal</th>
                        <th className="text-end">Tax</th>
                        <th className="text-end">Total</th>
                        <th className="text-end">Paid</th>
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
                          <td>{formatDate(row.sale_date)}</td>
                          <td>{row.driver_first_name} {row.driver_last_name}</td>
                          <td>{row.vehicle_plates || '-'}</td>
                          <td className="text-end">{formatNumber(row.gross_weight)}</td>
                          <td className="text-end">{formatCurrency(row.subtotal)}</td>
                          <td className="text-end">{formatCurrency(row.tax_amount)}</td>
                          <td className="text-end fw-bold">{formatCurrency(row.total_amount)}</td>
                          <td className="text-end">{formatCurrency(row.amount_paid)}</td>
                          <td className="text-center">
                            {getStatusBadge(row.payment_status_code, row.sale_status_code)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CustomerStatement