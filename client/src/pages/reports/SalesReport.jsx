import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function SalesReport() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [data, setData] = useState([])
  const [totals, setTotals] = useState({})
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
  const normalizePaymentMethod = (value) => {
    const v = String(value || '').trim().toLowerCase()

    if (
      v === 'cash' ||
      v.includes('cash')
    ) return 'cash'

    if (
      v === 'card' ||
      v.includes('card') ||
      v.includes('credit') ||
      v.includes('debit')
    ) return 'card'

    if (
      v === 'business_account' ||
      v === 'business account' ||
      v.includes('business')
    ) return 'business_account'

    return null
  }

  const paymentBalanceSummary = useMemo(() => {
    const summary = {
      cash: { key: 'cash', label: 'Cash', count: 0, total: 0 },
      business_account: { key: 'business_account', label: 'Business Account', count: 0, total: 0 },
      card: { key: 'card', label: 'Card', count: 0, total: 0 }
    }

    data.forEach(row => {
      const paymentKey = normalizePaymentMethod(row.payment_method || row.payment_method_code)
      if (!paymentKey || !summary[paymentKey]) return

      summary[paymentKey].count += 1
      summary[paymentKey].total += Number(row.total_amount || 0)
    })

    return summary
  }, [data])

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
      color: '#0dcaf0',
      softBg: 'rgba(13, 202, 240, 0.12)',
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
      key: 'total',
      label: 'Total',
      value: formatCurrency(totals.total_amount),
      color: '#198754',
      softBg: 'rgba(25, 135, 84, 0.12)',
      icon: 'bi-currency-dollar'
    }
  ]

  const paymentSummaryCards = [
    {
      ...paymentBalanceSummary.cash,
      color: '#198754',
      softBg: 'rgba(25, 135, 84, 0.12)',
      icon: 'bi-cash-stack'
    },
    {
      ...paymentBalanceSummary.business_account,
      color: '#fd7e14',
      softBg: 'rgba(253, 126, 20, 0.12)',
      icon: 'bi-briefcase'
    },
    {
      ...paymentBalanceSummary.card,
      color: '#0d6efd',
      softBg: 'rgba(13, 110, 253, 0.12)',
      icon: 'bi-credit-card'
    }
  ]
  // const formatDate = (date) => {
  //   if (!date) return '-'
  //   return new Date(date).toLocaleString('en-US', {
  //     month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  //   })
  // }
  //TODO: importante mantener este formato
  const formatDate = (date) => {
    if (!date) return '-'

    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',        // respeta la hora del ...Z
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date))
  }


  const totalRows = data.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)

  const start = (safePage - 1) * pageSize
  const end = start + pageSize
  const pagedData = data.slice(start, end)

  return (
    <div className="container-fluid px-4 py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
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
              <label className="form-label small">Type (Weigh/Reweigh)</label>
              <select className="form-select" name="product_id" value={filters.product_id} onChange={handleFilterChange}>
                <option value="all">All Types</option>
                {filterOptions.products?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Customer</label>
              <select className="form-select" name="customer_id" value={filters.customer_id} onChange={handleFilterChange}>
                <option value="all">All Customers</option>
                {filterOptions.customers?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Payment Method</label>
              <select className="form-select" name="payment_method_id" value={filters.payment_method_id} onChange={handleFilterChange}>
                <option value="all">All Methods</option>
                {filterOptions.paymentMethods?.map(opt => (
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
          <div className="row g-3 mt-1">
            <div className="col-md-2">
              <label className="form-label small">Operator</label>
              <select className="form-select" name="operator_id" value={filters.operator_id} onChange={handleFilterChange}>
                <option value="all">All Operators</option>
                {filterOptions.users?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Status</label>
              <select className="form-select" name="status_id" value={filters.status_id} onChange={handleFilterChange}>
                <option value="all">All Status</option>
                {filterOptions.statuses?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>


      {/* Summary */}
      <div className="row g-3 mb-3">
        {summaryCards.map(card => (
          <div className="col-12 col-md-6 col-xl-3" key={card.key}>
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
                    <div className="h4 mb-0 fw-bold text-dark">
                      {card.value}
                    </div>
                  </div>

                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{
                      width: 42,
                      height: 42,
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

      {/* Payment Summary */}
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
      {/* Data Preview */}
      <div className="card shadow-sm border-0">

        <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center">
          <h6 className="mb-0"><i className="bi bi-table me-2"></i>Preview</h6>
          <span className="badge bg-secondary">{data.length} records</span>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary"></div>
              <p className="mt-2 text-muted">Loading data...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              No data found with current filters
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: '400px' }}>
              <table className="table table-sm table-hover mb-0">
                <thead className="table-dark sticky-top">
                  <tr>
                    <th>Ticket #</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Operator</th>
                    <th>Payment</th>
                    <th className="text-end">Weight</th>
                    <th className="text-end">Subtotal</th>
                    <th className="text-end">Tax</th>
                    <th className="text-end">Total</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedData.map(row => (
                    <tr key={row.sale_id}>
                      <td><code>{row.ticket_number}</code></td>
                      <td>
                        <span
                          className="badge"
                          style={{ backgroundColor: row.product_type === 'Weigh' ? '#17a2b8' : '#6f42c1' }}
                        >
                          {row.product_type}
                        </span>
                      </td>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.customer_name || <span className="text-muted">Walk-in</span>}</td>
                      <td>{row.operator_name || '-'}</td>
                      <td>{row.payment_method || '-'}</td>
                      <td className="text-end">{formatNumber(row.gross_weight)}</td>
                      <td className="text-end">{formatCurrency(row.subtotal)}</td>
                      <td className="text-end">{formatCurrency(row.tax_amount)}</td>
                      <td className="text-end fw-bold">{formatCurrency(row.total_amount)}</td>
                      {/* <td className="text-center">
                        <span className="badge bg-success">{row.status_label || row.status_code || '-'}</span>
                      </td> */}
                      <td className="text-center">
                        {(() => {
                          const s = (row.status_code || '').toUpperCase()
                          const badgeClass =
                            s === 'COMPLETED' ? 'bg-success'
                              : s === 'CANCELLED' ? 'bg-danger'
                                : 'bg-default'

                          return (
                            <span className={`badge ${badgeClass}`}>
                              {row.status_label || row.status_code || '-'}
                            </span>
                          )
                        })()}
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
    </div>
  )
}

export default SalesReport