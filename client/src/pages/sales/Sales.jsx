import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function Sales() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({})
  const [filters, setFilters] = useState({
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    status_id: '',
    is_reweigh: ''
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      if (filters.status_id) params.append('status_id', filters.status_id)
      if (filters.is_reweigh !== '') params.append('is_reweigh', filters.is_reweigh)

      const [salesRes, summaryRes] = await Promise.all([
        api.get(`/sales?${params.toString()}`),
        api.get(`/sales/summary?${params.toString()}`)
      ])
      setItems(salesRes.data.data)
      setSummary(summaryRes.data.data)
    } catch (error) {
      Swal.fire('Error', 'Could not load sales', 'error')
    } finally { setLoading(false) }
  }

  const handleFilter = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const applyFilters = () => fetchData()

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)
  const formatDate = (d) => d ? new Date(d).toLocaleString() : '-'

  const getStatusBadge = (code) => {
    const colors = { 'OPEN': 'warning', 'COMPLETED': 'success', 'CANCELLED': 'danger', 'REFUNDED': 'info' }
    return colors[code] || 'secondary'
  }

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1"><i className="bi bi-receipt me-2"></i>Daily Operations</h3>
          <p className="text-muted mb-0">View and manage transactions</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white">
            <div className="card-body py-3">
              <h6 className="mb-0">Total Transactions</h6>
              <h3 className="mb-0">{summary.total_transactions || 0}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-success text-white">
            <div className="card-body py-3">
              <h6 className="mb-0">Total Sales</h6>
              <h3 className="mb-0">{formatCurrency(summary.total_sales)}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-info text-white">
            <div className="card-body py-3">
              <h6 className="mb-0">Re-weighs</h6>
              <h3 className="mb-0">{summary.total_reweighs || 0}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-danger text-white">
            <div className="card-body py-3">
              <h6 className="mb-0">Cancelled</h6>
              <h3 className="mb-0">{summary.total_cancelled || 0}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-4">
        <div className="card-body py-2">
          <div className="row align-items-end">
            <div className="col-md-2">
              <label className="form-label small">From</label>
              <input type="date" className="form-control form-control-sm" name="date_from" value={filters.date_from} onChange={handleFilter} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">To</label>
              <input type="date" className="form-control form-control-sm" name="date_to" value={filters.date_to} onChange={handleFilter} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Status</label>
              <select className="form-select form-select-sm" name="status_id" value={filters.status_id} onChange={handleFilter}>
                <option value="">All</option>
                <option value="1">Open</option>
                <option value="2">Completed</option>
                <option value="3">Cancelled</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Type</label>
              <select className="form-select form-select-sm" name="is_reweigh" value={filters.is_reweigh} onChange={handleFilter}>
                <option value="">All</option>
                <option value="0">Weigh</option>
                <option value="1">Re-weigh</option>
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary btn-sm w-100" onClick={applyFilters}>
                <i className="bi bi-search me-1"></i>Filter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 table-sm">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Date/Time</th>
                    <th>Customer</th>
                    <th>Driver</th>
                    <th>Plates</th>
                    <th className="text-center">Type</th>
                    <th className="text-end">Total</th>
                    <th className="text-center">Status</th>
                    <th>Operator</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan="10" className="text-center py-4 text-muted">No transactions found</td></tr>
                  ) : items.map(item => (
                    <tr key={item.sale_id} className={item.status_code === 'CANCELLED' ? 'table-secondary' : ''}>
                      <td><small className="text-muted">#{item.sale_id}</small></td>
                      <td><small>{formatDate(item.created_at)}</small></td>
                      <td><small>{item.account_name || '-'}</small></td>
                      <td><small>{[item.driver_first_name, item.driver_last_name].filter(Boolean).join(' ') || '-'}</small></td>
                      <td><code className="small">{item.vehicle_plates || '-'}</code></td>
                      <td className="text-center">
                        {item.is_reweigh ? <span className="badge bg-info">Re-weigh</span> : <span className="badge bg-secondary">Weigh</span>}
                      </td>
                      <td className="text-end fw-bold">{formatCurrency(item.total)}</td>
                      <td className="text-center">
                        <span className={`badge bg-${getStatusBadge(item.status_code)}`}>{item.status_label}</span>
                      </td>
                      <td><small className="text-muted">{item.operator_name}</small></td>
                      <td className="text-center">
                        <Link to={`/sales/${item.sale_id}`} className="btn btn-sm btn-outline-primary">
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
        <div className="card-footer text-muted small">{items.length} transaction(s)</div>
      </div>
    </div>
  )
}

export default Sales