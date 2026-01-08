import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function Permissions() {
  const [permissions, setPermissions] = useState([])
  const [grouped, setGrouped] = useState({})
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grouped') // 'grouped' or 'flat'
  const [filterModule, setFilterModule] = useState('')

  useEffect(() => {
    fetchPermissions()
  }, [])

  const fetchPermissions = async () => {
    try {
      setLoading(true)
      const response = await api.get('/permissions')
      setPermissions(response.data.data.all)
      setGrouped(response.data.data.grouped)
      setModules(response.data.data.modules)
    } catch (error) {
      console.error('Error fetching permissions:', error)
      Swal.fire('Error', 'Could not load permissions', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (permission) => {
    // Verificar si está en uso
    if (permission.roles_count > 0 || permission.nav_items_count > 0) {
      Swal.fire(
        'Cannot Delete',
        `This permission is assigned to ${permission.roles_count} role(s) and ${permission.nav_items_count} menu item(s). Remove assignments first.`,
        'warning'
      )
      return
    }

    const result = await Swal.fire({
      title: 'Delete Permission?',
      text: `Are you sure you want to delete "${permission.code}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    })

    if (result.isConfirmed) {
      try {
        await api.delete(`/permissions/${permission.permission_id}`)
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
        fetchPermissions()
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not delete permission', 'error')
      }
    }
  }

  // Filtrar permisos por módulo
  const filteredPermissions = filterModule
    ? permissions.filter(p => p.module === filterModule)
    : permissions

  // Renderizar vista agrupada
  const renderGroupedView = () => (
    <div className="row">
      {Object.entries(grouped)
        .filter(([module]) => !filterModule || module === filterModule)
        .map(([module, perms]) => (
          <div key={module} className="col-md-6 col-lg-4 mb-4">
            <div className="card h-100">
              <div className="card-header bg-primary text-white py-2">
                <h6 className="mb-0 text-uppercase">
                  <i className="bi bi-folder me-2"></i>
                  {module}
                  <span className="badge bg-light text-primary float-end">{perms.length}</span>
                </h6>
              </div>
              <div className="card-body p-0">
                <ul className="list-group list-group-flush">
                  {perms.map(perm => (
                    <li key={perm.permission_id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <code className="text-primary">{perm.code}</code>
                        <br />
                        <small className="text-muted">{perm.name}</small>
                      </div>
                      <div className="btn-group btn-group-sm">
                        <Link
                          to={`/settings/permissions/${perm.permission_id}`}
                          className="btn btn-outline-primary"
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </Link>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => handleDelete(perm)}
                          title="Delete"
                          disabled={perm.roles_count > 0 || perm.nav_items_count > 0}
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

  // Renderizar vista de tabla
  const renderTableView = () => (
    <div className="card shadow-sm">
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Module</th>
                <th>Description</th>
                <th className="text-center" style={{ width: '100px' }}>Roles</th>
                <th className="text-center" style={{ width: '100px' }}>Menu Items</th>
                <th className="text-center" style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    No permissions found
                  </td>
                </tr>
              ) : (
                filteredPermissions.map(perm => (
                  <tr key={perm.permission_id}>
                    <td className="text-muted">{perm.permission_id}</td>
                    <td>
                      <code className="bg-light px-2 py-1 rounded">{perm.code}</code>
                    </td>
                    <td>{perm.name}</td>
                    <td>
                      <span className="badge bg-primary">{perm.module}</span>
                    </td>
                    <td className="text-muted">{perm.description || '-'}</td>
                    <td className="text-center">
                      <span className={`badge ${perm.roles_count > 0 ? 'bg-success' : 'bg-secondary'}`}>
                        {perm.roles_count}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`badge ${perm.nav_items_count > 0 ? 'bg-info' : 'bg-secondary'}`}>
                        {perm.nav_items_count}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        <Link
                          to={`/settings/permissions/${perm.permission_id}`}
                          className="btn btn-outline-primary"
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </Link>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => handleDelete(perm)}
                          title="Delete"
                          disabled={perm.roles_count > 0 || perm.nav_items_count > 0}
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
            <i className="bi bi-key me-2"></i>
            Permissions Management
          </h3>
          <p className="text-muted mb-0">Manage system permissions for roles and menu items</p>
        </div>
        <Link to="/settings/permissions/new" className="btn btn-primary">
          <i className="bi bi-plus-lg me-2"></i>
          New Permission
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
                {filteredPermissions.length} permission(s) in {filterModule || 'all'} module(s)
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
                  className={`btn ${viewMode === 'flat' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('flat')}
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
            Permission Code Format
          </h6>
          <p className="card-text small text-muted mb-0">
            Permissions follow the format <code>module.action</code>. Examples:
            <code className="ms-2">users.read</code>,
            <code className="ms-2">users.write</code>,
            <code className="ms-2">reports.view</code>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Permissions