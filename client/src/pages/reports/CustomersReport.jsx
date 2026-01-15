import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function CustomersReport() {
  const [data, setData] = useState([])
  const [totals, setTotals] = useState({})
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState({ pdf: false, excel: false })

  // Filtros
  const [filters, setFilters] = useState({
    status: 'all',
    has_credit: 'all'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams(filters)
      const response = await api.get(`/reports/customers?${params}`)
      setData(response.data.data.data)
      setTotals(response.data.data.totals)
    } catch (error) {
      Swal.fire('Error', 'Could not load report data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const applyFilters = () => {
    fetchData()
  }

  const exportPdf = async () => {
    try {
      setExporting(prev => ({ ...prev, pdf: true }))
      const params = new URLSearchParams(filters)
      const response = await api.get(`/reports/customers/pdf?${params}`, {
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `customers-report-${Date.now()}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      Swal.fire({
        icon: 'success',
        title: 'PDF Downloaded!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      })
    } catch (error) {
      Swal.fire('Error', 'Could not generate PDF', 'error')
    } finally {
      setExporting(prev => ({ ...prev, pdf: false }))
    }
  }

  const exportExcel = async () => {
    try {
      setExporting(prev => ({ ...prev, excel: true }))
      const params = new URLSearchParams(filters)
      const response = await api.get(`/reports/customers/excel?${params}`, {
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `customers-report-${Date.now()}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      Swal.fire({
        icon: 'success',
        title: 'Excel Downloaded!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      })
    } catch (error) {
      Swal.fire('Error', 'Could not generate Excel', 'error')
    } finally {
      setExporting(prev => ({ ...prev, excel: false }))
    }
  }

  const formatCurrency = (val) => {
    if (!val) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
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
            <i className="bi bi-people me-2"></i>
            Customers Report
          </h3>
          <p className="text-muted mb-0">Complete list of customers with status and credit information</p>
        </div>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-danger" 
            onClick={exportPdf}
            disabled={exporting.pdf || data.length === 0}
          >
            {exporting.pdf ? (
              <span className="spinner-border spinner-border-sm me-2"></span>
            ) : (
              <i className="bi bi-file-pdf me-2"></i>
            )}
            Export PDF
          </button>
          <button 
            className="btn btn-success" 
            onClick={exportExcel}
            disabled={exporting.excel || data.length === 0}
          >
            {exporting.excel ? (
              <span className="spinner-border spinner-border-sm me-2"></span>
            ) : (
              <i className="bi bi-file-excel me-2"></i>
            )}
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
            <div className="col-md-3">
              <label className="form-label small">Status</label>
              <select
                className="form-select"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small">Credit Account</label>
              <select
                className="form-select"
                name="has_credit"
                value={filters.has_credit}
                onChange={handleFilterChange}
              >
                <option value="all">All Customers</option>
                <option value="yes">With Credit</option>
                <option value="no">Without Credit</option>
              </select>
            </div>
            <div className="col-md-3">
              <button className="btn btn-primary" onClick={applyFilters}>
                <i className="bi bi-search me-2"></i>Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="row mb-4">
          <div className="col-md-2">
            <div className="card bg-primary text-white">
              <div className="card-body py-3 text-center">
                <h4 className="mb-0">{totals.total || 0}</h4>
                <small>Total</small>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card bg-success text-white">
              <div className="card-body py-3 text-center">
                <h4 className="mb-0">{totals.active || 0}</h4>
                <small>Active</small>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card bg-secondary text-white">
              <div className="card-body py-3 text-center">
                <h4 className="mb-0">{totals.inactive || 0}</h4>
                <small>Inactive</small>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card bg-info text-white">
              <div className="card-body py-3 text-center">
                <h4 className="mb-0">{totals.withCredit || 0}</h4>
                <small>With Credit</small>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card bg-warning text-dark">
              <div className="card-body py-3 text-center">
                <h4 className="mb-0 small">{formatCurrency(totals.totalCreditLimit)}</h4>
                <small>Total Limit</small>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card bg-danger text-white">
              <div className="card-body py-3 text-center">
                <h4 className="mb-0 small">{formatCurrency(totals.totalBalance)}</h4>
                <small>Total Balance</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Preview */}
      <div className="card shadow-sm">
        <div className="card-header bg-light d-flex justify-content-between align-items-center">
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
                    <th>Account #</th>
                    <th>Name</th>
                    <th>State</th>
                    <th>Phone</th>
                    <th>Tax ID</th>
                    <th className="text-center">Credit</th>
                    <th className="text-end">Limit</th>
                    <th className="text-end">Balance</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(row => (
                    <tr key={row.id_customer} className={!row.is_active ? 'table-secondary' : ''}>
                      <td><code>{row.account_number}</code></td>
                      <td>{row.account_name}</td>
                      <td>{row.account_state || '-'}</td>
                      <td>{row.phone_number || '-'}</td>
                      <td>{row.tax_id || '-'}</td>
                      <td className="text-center">
                        {row.has_credit ? (
                          <span className={`badge ${row.is_suspended ? 'bg-danger' : 'bg-success'}`}>
                            {row.credit_type || 'Yes'}
                          </span>
                        ) : (
                          <span className="badge bg-secondary">No</span>
                        )}
                      </td>
                      <td className="text-end">{row.has_credit ? formatCurrency(row.credit_limit) : '-'}</td>
                      <td className="text-end">{row.has_credit ? formatCurrency(row.current_balance) : '-'}</td>
                      <td className="text-center">
                        <span className={`badge ${row.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {row.is_active ? 'Active' : 'Inactive'}
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
    </div>
  )
}

export default CustomersReport