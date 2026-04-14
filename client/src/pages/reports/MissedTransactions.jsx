import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'
import { formatDateTime, todayDateString, pastDateString } from '../../utils/dateHelpers'

function MissedTransactions() {
  const [data, setData] = useState([])
  const [totals, setTotals] = useState({})
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState({ pdf: false, excel: false })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Filtros - default: hoy
  const today = todayDateString()
  const lastWeek = pastDateString(7)

  const [filters, setFilters] = useState({
    date_from: lastWeek,
    date_to: today
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)

      const response = await api.get(`/reports/missed-transactions?${params}`)
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
  }

  const applyFilters = () => fetchData()

  const exportFile = async (type) => {
    try {
      setExporting(prev => ({ ...prev, [type]: true }))
      const params = new URLSearchParams()
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)

      const response = await api.get(`/reports/missed-transactions/${type}?${params}`, {
        responseType: 'blob'
      })

      const ext = type === 'pdf' ? 'pdf' : 'xlsx'
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `missed-transactions-${Date.now()}.${ext}`)
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

  const formatNumber = (val) => {
    if (!val) return '0.00'
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(val)
  }

  const formatInt = (val) => {
    if (val === null || val === undefined) return '0'
    return new Intl.NumberFormat('en-US').format(Math.round(Number(val) || 0))
  }

  const formatDate = formatDateTime

  // Paginación local
  const totalRows = data.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize
  const end = start + pageSize
  const pagedData = data.slice(start, end)

  // Porcentajes para las tarjetas
  const missedPct = totals.total_captures > 0
    ? ((totals.unmatched_count / totals.total_captures) * 100).toFixed(1)
    : '0.0'
  const completedPct = totals.total_captures > 0
    ? ((totals.matched_count / totals.total_captures) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Link to="/reports" className="text-decoration-none text-muted small">
            <i className="bi bi-arrow-left me-1"></i>Back to Reports
          </Link>
          <h3 className="mb-1 mt-2">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Missed Transactions Report
          </h3>
          <p className="text-muted mb-0">Scale captures analysis — used vs missed</p>
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
            <div className="col-md-3">
              <label className="form-label small">From</label>
              <input type="date" className="form-control form-control-sm" name="date_from" value={filters.date_from} onChange={handleFilterChange} />
            </div>
            <div className="col-md-3">
              <label className="form-label small">To</label>
              <input type="date" className="form-control form-control-sm" name="date_to" value={filters.date_to} onChange={handleFilterChange} />
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <button className="btn btn-primary btn-sm w-100" onClick={applyFilters} disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-search me-2"></i>}
                Generate Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {totals.total_captures > 0 && (
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="card text-center border-0 shadow-sm">
              <div className="card-body py-3">
                <h3 className="mb-0" style={{ color: '#6f42c1' }}>{totals.total_captures}</h3>
                <small className="text-muted">Total Captures</small>
              </div>
            </div>
          </div>
           {/* <div className="col-md-3">
            <div className="card text-center border-0 shadow-sm">
              <div className="card-body py-3">
                <h3 className="mb-0 text-success">{totals.matched_count}</h3>
                <small className="text-muted">Completed ({completedPct}%)</small>
              </div>
            </div>
          </div> */}
          {/* <div className="col-md-3">
            <div className="card text-center border-0 shadow-sm">
              <div className="card-body py-3">
                <h3 className="mb-0 text-danger">{totals.unmatched_count}</h3>
                <small className="text-muted">Missed ({missedPct}%)</small>
              </div>
            </div>
          </div> */}
          <div className="col-md-3">
            <div className="card text-center border-0 shadow-sm">
              <div className="card-body py-3">
                <h3 className="mb-0 text-dark">{formatNumber(totals.total_missed_weight)} lb</h3>
                <small className="text-muted">Total Weight</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <span><i className="bi bi-table me-2"></i>Captures</span>
          <span className="badge bg-secondary">{totalRows} records</span>
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
              No captures found for this period
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.82rem' }}>
                <thead className="table-dark sticky-top">
                  <tr>
                    <th>#</th>
                    <th>ID</th>
                    <th>UUID</th>
                    <th>Date/Time</th>
                    <th className="text-end">Weight</th>
                    <th className="text-end">Axle 1</th>
                    <th className="text-end">Axle 2</th>
                    <th className="text-end">Axle 3</th>
                    <th className="text-end">Total</th>
                    <th>Operator</th>
                    <th className="text-center">Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedData.map((row, index) => (
                    <tr key={row.uuid_weight}>
                      <td className="text-muted">{start + index + 1}</td>
                      <td><small className="text-muted">{row.id}</small></td>
                      <td>
                        <code className="small" title={row.uuid_weight}>
                          {row.uuid_weight ? row.uuid_weight.substring(0, 12) + '...' : '-'}
                        </code>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(row.captured_local)}</td>
                      <td className="text-end">{formatNumber(row.weight_lb)}</td>
                      <td className="text-end">{formatInt(row.eje1)}</td>
                      <td className="text-end">{formatInt(row.eje2)}</td>
                      <td className="text-end">{formatInt(row.eje3)}</td>
                      <td className="text-end fw-bold">{formatInt(row.peso_total)}</td>
                      <td>{row.operator_name || '-'}</td>
                      <td className="text-center">
                        {row.is_matched ? (
                          <span className="badge bg-success">Used</span>
                        ) : (
                          <span className="badge bg-danger">Missed</span>
                        )}
                      </td>
                      <td>{row.missed_reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {totalRows > 0 && (
            <div className="d-flex flex-wrap justify-content-between align-items-center p-3 gap-2">
              <small className="text-muted">
                Showing <b>{start + 1}</b>–<b>{Math.min(end, totalRows)}</b> of <b>{totalRows}</b>
              </small>

              <div className="d-flex align-items-center gap-2">
                <select
                  className="form-select form-select-sm"
                  style={{ width: 110 }}
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
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
          )}
        </div>
      </div>
    </div>
  )
}

export default MissedTransactions