import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

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

  const fetchHistory = useCallback(async (page = 1, limit = pagination.limit) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      params.append('limit', limit)
      
      if (filters.customer_id) params.append('customer_id', filters.customer_id)
      if (filters.status) params.append('status', filters.status)
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      
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

  const handleSearch = (e) => {
    e.preventDefault()
    fetchHistory(1, pagination.limit)
  }

  const handleClearFilters = () => {
    setFilters({
      customer_id: '',
      status: '',
      date_from: '',
      date_to: ''
    })
    // Fetch with cleared filters after state update
    setTimeout(() => fetchHistory(1, pagination.limit), 0)
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchHistory(newPage, pagination.limit)
    }
  }

  const handlePageSizeChange = (e) => {
    const newLimit = parseInt(e.target.value)
    fetchHistory(1, newLimit)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US')
  }

  const formatDateTime = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
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
                  <option value="PARTIAL">Partial</option>
                  <option value="VOIDED">Voided</option>
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
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>
            <i className="bi bi-list me-2"></i>
            Payment Records 
            {pagination.total > 0 && (
              <span className="text-muted ms-2">
                (Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total})
              </span>
            )}
          </span>
          <div className="d-flex align-items-center gap-2">
            <label className="mb-0 text-muted small">Rows:</label>
            <select 
              className="form-select form-select-sm" 
              style={{ width: 'auto' }}
              value={pagination.limit}
              onChange={handlePageSizeChange}
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
        
        {loading ? (
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary"></div>
            <p className="mt-2 text-muted">Loading...</p>
          </div>
        ) : history.length > 0 ? (
          <>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
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
                      <td>{formatDate(h.payment_date)}</td>
                      <td>{h.payment_method}</td>
                      <td>{h.reference_number || '-'}</td>
                      <td className="text-end">{formatCurrency(h.amount_received)}</td>
                      <td className="text-end text-success">{formatCurrency(h.amount_applied)}</td>
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
                        <small>{formatDateTime(h.created_at)}</small>
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

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="card-footer d-flex justify-content-between align-items-center">
                <div className="text-muted small">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <nav>
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(1)}
                        disabled={pagination.page === 1}
                      >
                        <i className="bi bi-chevron-double-left"></i>
                      </button>
                    </li>
                    <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>
                    </li>
                    
                    {getPageNumbers().map((pageNum, idx) => (
                      pageNum === '...' ? (
                        <li key={`ellipsis-${idx}`} className="page-item disabled">
                          <span className="page-link">...</span>
                        </li>
                      ) : (
                        <li 
                          key={pageNum} 
                          className={`page-item ${pagination.page === pageNum ? 'active' : ''}`}
                        >
                          <button 
                            className="page-link" 
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </button>
                        </li>
                      )
                    ))}
                    
                    <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </li>
                    <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(pagination.totalPages)}
                        disabled={pagination.page === pagination.totalPages}
                      >
                        <i className="bi bi-chevron-double-right"></i>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </>
        ) : (
          <div className="card-body text-center py-5">
            <i className="bi bi-inbox display-1 text-muted"></i>
            <h4 className="mt-3 text-muted">No Records Found</h4>
            <p className="text-muted">Try adjusting your filters or search criteria.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AllPaymentsHistory