import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'
import { formatDateTime, formatDateTimeCompact } from '../../utils/dateHelpers'

function AllPaymentsHistory() {
  // Filter states
  const [customers, setCustomers] = useState([])
  const [filters, setFilters] = useState({
    customer_id: '',
    status: '',
    date_from: '',
    date_to: ''
  })

  // Data states
  const [history, setHistory] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(false)

  // Page size options
  const pageSizeOptions = [10, 25, 50, 100]

  useEffect(() => {
    fetchCustomers()
    fetchHistory()
  }, [])

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/ar/customers')
      setCustomers(response.data.data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchHistory = useCallback(async (page = 1, limit = pagination.limit, overrideFilters = null) => {
    const f = overrideFilters ?? filters

    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      params.append('limit', limit)

      if (f.customer_id) params.append('customer_id', f.customer_id)
      if (f.status) params.append('status', f.status)
      if (f.date_from) params.append('date_from', f.date_from)
      if (f.date_to) params.append('date_to', f.date_to)

      const response = await api.get(`/ar/payments/all-history?${params.toString()}`)
      setHistory(response.data.data?.data || [])
      setPagination(response.data.data?.pagination || {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0
      })
    } catch (error) {
      console.error('Error fetching history:', error)
      Swal.fire('Error', 'Could not load payment history', 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.limit])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }
  const firstRow = pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1
  const lastRow = Math.min(pagination.page * pagination.limit, pagination.total)

  const handleSearch = (e) => {
    e.preventDefault()
    fetchHistory(1, pagination.limit)
  }

  const handleClearFilters = () => {
    const cleared = { customer_id: '', status: '', date_from: '', date_to: '' }
    setFilters(cleared)
    fetchHistory(1, pagination.limit, cleared)
  }


  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchHistory(newPage, pagination.limit)
    }
  }

  const handlePageSizeChange = (e) => {
    const newLimit = parseInt(e.target.value, 10)
    fetchHistory(1, newLimit)
  }


  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
  }


  const getStatusBadge = (status) => {
    const badges = {
      'APPLIED': 'bg-success',
      'PARTIAL': 'bg-warning text-dark',
      'VOIDED': 'bg-danger'
    }
    return badges[status] || 'bg-secondary'
  }

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = []
    const { page, totalPages } = pagination

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (page <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (page >= totalPages - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = page - 1; i <= page + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }
    return pages
  }

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h3 mb-0">
                <i className="bi bi-clock-history me-2"></i>
                All Payments History
              </h1>
              <p className="text-muted mb-0">View all A/R payment records</p>
            </div>
            <Link to="/ar" className="btn btn-outline-primary">
              <i className="bi bi-arrow-left me-1"></i>
              Back to A/R
            </Link>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card mb-4">
        <div className="card-header">
          <i className="bi bi-funnel me-2"></i>
          Filters
        </div>
        <div className="card-body">
          <form onSubmit={handleSearch}>
            <div className="row g-3">
              {/* Customer Filter */}
              <div className="col-md-3">
                <label className="form-label">Customer</label>
                <select
                  className="form-select"
                  name="customer_id"
                  value={filters.customer_id}
                  onChange={handleFilterChange}
                >
                  <option value="">All Customers</option>
                  {customers.map(c => (
                    <option key={c.id_customer} value={c.id_customer}>
                      {c.account_number} - {c.account_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="">All Status</option>
                  <option value="APPLIED">Applied</option>
                  <option value="CREDIT_BALANCE">Credit Balance</option>
                  {/* <option value="VOIDED">Voided</option> */}
                </select>
              </div>

              {/* Date From */}
              <div className="col-md-2">
                <label className="form-label">Created From</label>
                <input
                  type="date"
                  className="form-control"
                  name="date_from"
                  value={filters.date_from}
                  onChange={handleFilterChange}
                />
              </div>

              {/* Date To */}
              <div className="col-md-2">
                <label className="form-label">Created To</label>
                <input
                  type="date"
                  className="form-control"
                  name="date_to"
                  value={filters.date_to}
                  onChange={handleFilterChange}
                />
              </div>

              {/* Buttons */}
              <div className="col-md-3 d-flex align-items-end gap-2">
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-search me-1"></i>
                  Search
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleClearFilters}
                >
                  <i className="bi bi-x-lg me-1"></i>
                  Clear
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Results Table */}
      <div className="card shadow-sm">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <span><i className="bi bi-list me-2"></i>Payment Records</span>
          <span className="badge bg-secondary">{pagination.total} records</span>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary"></div>
              <p className="mt-2 text-muted">Loading...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              No records found
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Payment Date</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th className="text-end">Received</th>
                    <th className="text-end">Applied</th>
                    <th className="text-end">Unapplied</th>
                    <th className="text-center">Mode</th>
                    <th className="text-center">Status</th>
                    <th>Created By</th>
                    <th>Created At</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.ar_payment_id}>
                      <td>{h.ar_payment_id}</td>
                      <td>
                        <span className="fw-medium">{h.account_number}</span>
                        <br />
                        <small className="text-muted">{h.account_name}</small>
                      </td>
                      <td>{formatDateTime(h.payment_date)}</td>
                      <td>{h.payment_method}</td>
                      <td>{h.reference_number || '-'}</td>
                      <td className="text-end font-monospace">{formatCurrency(h.amount_received)}</td>
                      <td className="text-end text-success font-monospace">{formatCurrency(h.amount_applied)}</td>
                      <td className="text-end">
                        {parseFloat(h.amount_unapplied) > 0
                          ? <span className="text-warning">{formatCurrency(h.amount_unapplied)}</span>
                          : '-'}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${h.apply_method === 'FIFO' ? 'bg-info' : 'bg-secondary'}`}>
                          {h.apply_method}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`badge ${getStatusBadge(h.status)}`}>
                          {h.status}
                        </span>
                      </td>
                      <td>{h.created_by || '-'}</td>
                      <td>
                        <small>{formatDateTimeCompact(h.created_at)}</small>
                      </td>
                      <td>
                        <Link
                          to={`/ar/payments/${h.ar_payment_id}`}
                          className="btn btn-sm btn-outline-primary"
                          title="View Details"
                        >
                          <i className="bi bi-eye"></i>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {pagination.total > 0 && (
          <div className="d-flex flex-wrap justify-content-between align-items-center p-3 gap-2">
            <small className="text-muted">
              Showing <b>{firstRow}</b>–<b>{lastRow}</b> of <b>{pagination.total}</b>
            </small>
            <div className="d-flex align-items-center gap-2">
              <select
                className="form-select form-select-sm"
                style={{ width: 110 }}
                value={pagination.limit}
                onChange={handlePageSizeChange}
              >
                {pageSizeOptions.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <div className="btn-group">
                <button className="btn btn-outline-secondary btn-sm" disabled={pagination.page === 1} onClick={() => handlePageChange(1)}>«</button>
                <button className="btn btn-outline-secondary btn-sm" disabled={pagination.page === 1} onClick={() => handlePageChange(pagination.page - 1)}>‹</button>
                <button className="btn btn-outline-secondary btn-sm" disabled>{pagination.page} / {pagination.totalPages}</button>
                <button className="btn btn-outline-secondary btn-sm" disabled={pagination.page === pagination.totalPages} onClick={() => handlePageChange(pagination.page + 1)}>›</button>
                <button className="btn btn-outline-secondary btn-sm" disabled={pagination.page === pagination.totalPages} onClick={() => handlePageChange(pagination.totalPages)}>»</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AllPaymentsHistory