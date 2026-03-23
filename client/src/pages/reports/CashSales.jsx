import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'
import { formatDateTime, todayDateString, pastDateString } from '../../utils/dateHelpers'

function CashSales() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [data, setData] = useState({
    transactions: [],
    totals: {},
    payment_summary: {}
  })

  const [filterOptions, setFilterOptions] = useState({})
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState({ pdf: false, excel: false })

  // Filtros - default: último mes
  const today = todayDateString()
  const lastMonth = pastDateString(30)

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
      console.log(response.data.data);
      setData(response.data.data)
      setPage(1)
    } catch (error) {
      Swal.fire('Error', 'Could not load report data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setPage(1)

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

  const formatDate = formatDateTime




  const getStatusBadge = (statusCode) => {
    const styles = {
      'COMPLETED': 'bg-success',
      'OPEN': 'bg-warning text-dark',
      'CANCELLED': 'bg-danger',
      'REFUNDED': 'bg-secondary'
    }
    return styles[statusCode] || 'bg-secondary'
  }

  const { transactions = [], totals = {}, payment_summary = {} } = data

  const totalRows = transactions.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)

  const start = (safePage - 1) * pageSize
  const end = start + pageSize
  const pagedTransactions = transactions.slice(start, end)
  const summaryCards = [
    {
      key: 'transactions',
      label: 'Transactions',
      value: totals.total_transactions || 0,
      color: '#0d6efd',
      softBg: 'rgba(13, 110, 253, 0.12)',
      icon: 'bi-receipt'
    },
    {
      key: 'weigh',
      label: 'Weigh',
      value: totals.total_weigh || 0,
      color: '#17a2b8',
      softBg: 'rgba(23, 162, 184, 0.12)',
      icon: 'bi-speedometer2'
    },
    {
      key: 'reweigh',
      label: 'Reweigh',
      value: totals.total_reweigh || 0,
      color: '#6f42c1',
      softBg: 'rgba(111, 66, 193, 0.12)',
      icon: 'bi-arrow-repeat'
    },
    {
      key: 'completed',
      label: 'Completed',
      value: totals.count_completed || 0,
      color: '#198754',
      softBg: 'rgba(25, 135, 84, 0.12)',
      icon: 'bi-check-circle'
    },
    {
      key: 'open',
      label: 'Pending',
      value: totals.count_open || 0,
      color: '#ffc107',
      softBg: 'rgba(255, 193, 7, 0.18)',
      icon: 'bi-hourglass-split',
      textClass: 'text-dark'
    },
    {
      key: 'cancelled',
      label: 'Cancelled',
      value: totals.count_cancelled || 0,
      color: '#dc3545',
      softBg: 'rgba(220, 53, 69, 0.12)',
      icon: 'bi-x-circle'
    }
  ]

  const paymentSummaryCards = [
    {
      ...(payment_summary.cash || { key: 'cash', label: 'Cash', count: 0, total: 0 }),
      color: '#198754',
      softBg: 'rgba(25, 135, 84, 0.12)',
      icon: 'bi-cash-stack'
    },
    {
      ...(payment_summary.business_account || { key: 'business_account', label: 'Business Account', count: 0, total: 0 }),
      color: '#fd7e14',
      softBg: 'rgba(253, 126, 20, 0.12)',
      icon: 'bi-briefcase'
    },
    {
      ...(payment_summary.card || { key: 'card', label: 'Card', count: 0, total: 0 }),
      color: '#0d6efd',
      softBg: 'rgba(13, 110, 253, 0.12)',
      icon: 'bi-credit-card'
    }
  ]

  const financialItems = [
    { label: 'Total Weight', value: `${formatNumber(totals.total_weight)} lb`, valueClass: 'text-dark' },
    { label: 'Subtotal', value: formatCurrency(totals.total_subtotal), valueClass: 'text-dark' },
    { label: 'Tax', value: formatCurrency(totals.total_tax), valueClass: 'text-dark' },
    { label: 'Total', value: formatCurrency(totals.total_amount), valueClass: 'text-dark fw-bold' },
    { label: 'Paid', value: formatCurrency(totals.total_paid), valueClass: 'text-success fw-bold' },
    { label: 'Pending', value: formatCurrency(totals.total_pending), valueClass: 'text-danger fw-bold' }
  ]
  return (
    <div className="container-fluid px-4 py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
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
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-light py-2">
          <h6 className="mb-0"><i className="bi bi-funnel me-2"></i>Filters</h6>
        </div>
        <div className="card-body py-3">
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

      {/* KPI Summary */}
      <div className="row g-3 mb-3">
        {summaryCards.map(card => (
          <div className="col-12 col-md-6 col-xl-2" key={card.key}>
            <div
              className="card shadow-sm border-0 h-100"
              style={{ borderTop: `4px solid ${card.color}` }}
            >
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="text-muted small fw-semibold text-uppercase mb-1">
                      {card.label}
                    </div>
                    <div className={`h4 mb-0 fw-bold ${card.textClass || 'text-dark'}`}>
                      {card.value}
                    </div>
                  </div>

                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: card.softBg,
                      color: card.color
                    }}
                  >
                    <i className={`bi ${card.icon}`}></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Balance Summary by Payment Method */}
      <div className="d-flex align-items-center mb-2">
        <div
          className="rounded-circle d-flex align-items-center justify-content-center me-2"
          style={{
            width: 34,
            height: 34,
            backgroundColor: '#f1f3f5',
            color: '#495057'
          }}
        >
          <i className="bi bi-wallet2"></i>
        </div>
        <div>
          <h6 className="mb-0">Balance Summary by Payment Method</h6>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {paymentSummaryCards.map(item => (
          <div className="col-12 col-md-6 col-xl-4" key={item.key}>
            <div
              className="card shadow-sm border-0 h-100"
              style={{ borderTop: `4px solid ${item.color}` }}
            >
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="d-flex align-items-center">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-2"
                      style={{
                        width: 38,
                        height: 38,
                        backgroundColor: item.softBg,
                        color: item.color
                      }}
                    >
                      <i className={`bi ${item.icon}`}></i>
                    </div>

                    <div>
                      <div className="fw-semibold text-dark">{item.label}</div>
                      <div className="small text-muted">Total Amount</div>
                    </div>
                  </div>

                  <span className="badge rounded-pill bg-light text-dark border">
                    {item.count}
                  </span>
                </div>

                <div className="d-flex justify-content-between align-items-end">
                  <span className="text-muted small">Transactions</span>
                  <span className="h5 mb-0 fw-bold" style={{ color: item.color }}>
                    {formatCurrency(item.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Financial Summary */}
      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-light py-2">
              <h6 className="mb-0"><i className="bi bi-calculator me-2"></i>Financial Summary</h6>
            </div>
            <div className="card-body py-3">
              <div className="row g-3">
                {financialItems.map(item => (
                  <div className="col-6 col-md-4" key={item.label}>
                    <div className="border rounded-3 p-3 h-100 text-center">
                      <div className="text-muted small text-uppercase fw-semibold mb-1">{item.label}</div>
                      <div className={item.valueClass}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card shadow-sm border-0 h-100" style={{ borderTop: '4px solid #0d6efd' }}>
            <div className="card-header bg-light py-2">
              <h6 className="mb-0"><i className="bi bi-cash-stack me-2"></i>Balance Due</h6>
            </div>
            <div className="card-body d-flex flex-column justify-content-center align-items-center py-4">
              <div className="text-muted small text-uppercase fw-semibold mb-2">Outstanding Balance</div>
              <div className={`display-6 fw-bold ${totals.total_pending > 0 ? 'text-danger' : 'text-success'}`}>
                {formatCurrency(totals.total_pending)}
              </div>
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
        <div className="card shadow-sm border-0">
          <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center">
            <h6 className="mb-0">
              <i className="bi bi-list-ul me-2 text-info"></i>Cash Transactions
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
                      <th>Service</th>
                      <th>Date</th>
                      <th>Driver</th>
                      <th>Triler #</th>
                      <th>Tractor #</th>
                      <th>Scale Op</th>
                      <th>Plates</th>
                      <th className="text-end">Weight</th>
                      {/* <th className="text-end">Subtotal</th> */}
                      {/* <th className="text-end">Tax</th> */}
                      <th className="text-end">Total</th>
                      <th className="text-end">Paid</th>
                      <th>Method</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTransactions.map(row => (
                      <tr key={`${row.ticket_id}-${row.sale_uid || row.ticket_number}-${row.payment_method_code || 'na'}`}>
                        <td><code>{row.ticket_number}</code></td>
                        <td>
                          <span
                            className="badge"
                            style={{ backgroundColor: row.product_type === 'Weigh' ? '#17a2b8' : '#6f42c1' }}
                          >
                            {row.product_type}
                          </span>
                        </td>
                        <td className="small">{formatDate(row.sale_date)}</td>
                        <td>{row.driver_first_name} {row.driver_last_name}</td>

                        <td className="small">{row.trailer_number}</td>
                        <td className="small">{row.tractor_number}</td>
                        <td className="small">{row.operator_name}</td>
                        <td className="small">{row.vehicle_plates}</td>

                        {/* <td className="small">{row.driver_phone || '-'}</td> */}
                        {/* <td>{row.vehicle_plates || '-'}</td> */}
                        <td className="text-end">{formatNumber(row.gross_weight)}</td>
                        {/* <td className="text-end">{formatCurrency(row.subtotal)}</td> */}
                        {/* <td className="text-end">{formatCurrency(row.tax_amount)}</td> */}
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
            <div className="d-flex flex-wrap justify-content-between align-items-center p-3 gap-2">
              <small className="text-muted">
                Showing <b>{totalRows === 0 ? 0 : start + 1}</b>–<b>{Math.min(end, totalRows)}</b> of <b>{totalRows}</b>
              </small>

              <div className="d-flex align-items-center gap-2">
                <select
                  className="form-select form-select-sm"
                  style={{ width: 110 }}
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>

                <div className="btn-group">
                  <button className="btn btn-outline-secondary btn-sm" disabled={safePage === 1} onClick={() => setPage(1)}>«</button>
                  <button className="btn btn-outline-secondary btn-sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button>
                  <button className="btn btn-outline-secondary btn-sm" disabled>{safePage} / {totalPages}</button>
                  <button className="btn btn-outline-secondary btn-sm" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button>
                  <button className="btn btn-outline-secondary btn-sm" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>»</button>
                </div>
              </div>
            </div>

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