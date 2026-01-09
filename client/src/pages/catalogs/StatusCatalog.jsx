import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function StatusCatalog() {
  const [items, setItems] = useState([])
  const [grouped, setGrouped] = useState({})
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterModule, setFilterModule] = useState('')
  const [viewMode, setViewMode] = useState('grouped')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/catalogs/status')
      setItems(response.data.data.all)
      setGrouped(response.data.data.grouped)
      setModules(response.data.data.modules)
    } catch (error) {
      console.error('Error fetching status catalog:', error)
      Swal.fire('Error', 'Could not load status catalog', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Delete Status?',
      html: `Are you sure you want to delete <b>${item.code}</b> from <b>${item.module}</b>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    })

    if (result.isConfirmed) {
      try {
        await api.delete(`/catalogs/status/${item.status_id}`)
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
        fetchData()
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not delete status', 'error')
      }
    }
  }

  const toggleActive = async (item) => {
    try {
      await api.put(`/catalogs/status/${item.status_id}`, {
        ...item,
        is_active: !item.is_active
      })
      fetchData()
      Swal.fire({
        icon: 'success',
        title: 'Status Updated',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      })
    } catch (error) {
      Swal.fire('Error', 'Could not update status', 'error')
    }
  }

  const getModuleBadgeColor = (module) => {
    const colors = {
      'SALES': 'bg-primary',
      'PAYMENTS': 'bg-success',
      'TICKETS': 'bg-info',
      'CANCELLATION': 'bg-danger'
    }
    return colors[module] || 'bg-secondary'
  }

  const filteredItems = filterModule
    ? items.filter(i => i.module === filterModule)
    : items

  // Vista agrupada por módulo
  const renderGroupedView = () => (
    <div className="row">
      {Object.entries(grouped)
        .filter(([module]) => !filterModule || module === filterModule)
        .map(([module, statuses]) => (
          <div key={module} className="col-md-6 col-lg-4 mb-4">
            <div className="card h-100 shadow-sm">
              <div className={`card-header ${getModuleBadgeColor(module)} text-white py-2`}>
                <h6 className="mb-0">
                  <i className="bi bi-collection me-2"></i>
                  {module}
                  <span className="badge bg-light text-dark float-end">{statuses.length}</span>
                </h6>
              </div>
              <div className="card-body p-0">
                <ul className="list-group list-group-flush">
                  {statuses.map(status => (
                    <li 
                      key={status.status_id} 
                      className={`list-group-item d-flex justify-content-between align-items-center ${!status.is_active ? 'bg-light text-muted' : ''}`}
                    >
                      <div>
                        <code className="text-primary me-2">{status.code}</code>
                        {status.is_final && (
                          <span className="badge bg-warning text-dark me-1" style={{ fontSize: '10px' }}>
                            Final
                          </span>
                        )}
                        <br />
                        <small className="text-muted">{status.label}</small>
                      </div>
                      <div className="btn-group btn-group-sm">
                        <Link
                          to={`/catalogs/status/${status.status_id}`}
                          className="btn btn-outline-primary"
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </Link>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => handleDelete(status)}
                          title="Delete"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
    </div>
  )

  // Vista de tabla
  const renderTableView = () => (
    <div className="card shadow-sm">
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th style={{ width: '120px' }}>Module</th>
                <th style={{ width: '120px' }}>Code</th>
                <th>Label</th>
                <th className="text-center" style={{ width: '80px' }}>Order</th>
                <th className="text-center" style={{ width: '80px' }}>Final</th>
                <th className="text-center" style={{ width: '80px' }}>Active</th>
                <th className="text-center" style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    No status found
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.status_id} className={!item.is_active ? 'table-secondary' : ''}>
                    <td className="text-muted">{item.status_id}</td>
                    <td>
                      <span className={`badge ${getModuleBadgeColor(item.module)}`}>
                        {item.module}
                      </span>
                    </td>
                    <td>
                      <code className="bg-light px-2 py-1 rounded">{item.code}</code>
                    </td>
                    <td>{item.label}</td>
                    <td className="text-center">
                      <span className="badge bg-light text-dark">{item.sort_order}</span>
                    </td>
                    <td className="text-center">
                      {item.is_final ? (
                        <i className="bi bi-check-circle-fill text-success"></i>
                      ) : (
                        <i className="bi bi-circle text-muted"></i>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="form-check form-switch d-flex justify-content-center">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={item.is_active === 1}
                          onChange={() => toggleActive(item)}
                          style={{ cursor: 'pointer' }}
                        />
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        <Link
                          to={`/catalogs/status/${item.status_id}`}
                          className="btn btn-outline-primary"
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </Link>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => handleDelete(item)}
                          title="Delete"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-collection me-2"></i>
            Status Catalog
          </h3>
          <p className="text-muted mb-0">Manage status values for Sales, Payments, and Tickets</p>
        </div>
        <Link to="/catalogs/status/new" className="btn btn-primary">
          <i className="bi bi-plus-lg me-2"></i>
          New Status
        </Link>
      </div>

      {/* Filters & View Toggle */}
      <div className="card shadow-sm mb-4">
        <div className="card-body py-2">
          <div className="row align-items-center">
            <div className="col-md-4">
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <i className="bi bi-funnel"></i>
                </span>
                <select
                  className="form-select"
                  value={filterModule}
                  onChange={(e) => setFilterModule(e.target.value)}
                >
                  <option value="">All Modules</option>
                  {modules.map(mod => (
                    <option key={mod} value={mod}>{mod}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="col-md-4 text-center">
              <small className="text-muted">
                {filteredItems.length} status(es) in {filterModule || 'all'} module(s)
              </small>
            </div>
            <div className="col-md-4 text-end">
              <div className="btn-group btn-group-sm">
                <button
                  className={`btn ${viewMode === 'grouped' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('grouped')}
                  title="Card View"
                >
                  <i className="bi bi-grid"></i>
                </button>
                <button
                  className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('table')}
                  title="Table View"
                >
                  <i className="bi bi-table"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : viewMode === 'grouped' ? (
        renderGroupedView()
      ) : (
        renderTableView()
      )}

      {/* Info Card */}
      <div className="card bg-light border-0 mt-4">
        <div className="card-body">
          <h6 className="card-title">
            <i className="bi bi-info-circle me-2"></i>
            About Status Catalog
          </h6>
          <p className="card-text small text-muted mb-0">
            <b>Final Status:</b> Indicates a terminal state (no further transitions). 
            <b className="ms-3">Module:</b> Groups statuses by their usage context (Sales, Payments, Tickets).
          </p>
        </div>
      </div>
    </div>
  )
}

export default StatusCatalog