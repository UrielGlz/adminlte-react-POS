import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function Navigation() {
  const [items, setItems] = useState([])
  const [treeItems, setTreeItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('tree') // 'tree' or 'flat'

  useEffect(() => {
    fetchNavigation()
  }, [])

  const fetchNavigation = async () => {
    try {
      setLoading(true)
      const response = await api.get('/navigation/admin')
      setItems(response.data.data.flat)
      setTreeItems(response.data.data.tree)
    } catch (error) {
      console.error('Error fetching navigation:', error)
      Swal.fire('Error', 'Could not load navigation items', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item) => {
    // Verificar si tiene hijos
    const hasChildren = items.some(i => i.parent_id === item.nav_id)
    
    if (hasChildren) {
      Swal.fire(
        'Cannot Delete',
        'This item has child items. Delete or reassign them first.',
        'warning'
      )
      return
    }

    const result = await Swal.fire({
      title: 'Delete Item?',
      text: `Are you sure you want to delete "${item.label}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    })

    if (result.isConfirmed) {
      try {
        await api.delete(`/navigation/admin/${item.nav_id}`)
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
        fetchNavigation()
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not delete item', 'error')
      }
    }
  }

  const toggleStatus = async (item) => {
    try {
      await api.put(`/navigation/admin/${item.nav_id}`, {
        ...item,
        is_active: !item.is_active
      })
      fetchNavigation()
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

  const getTypeIcon = (type) => {
    switch (type) {
      case 'header': return 'bi-type-h1'
      case 'link': return 'bi-link-45deg'
      case 'tree': return 'bi-folder'
      default: return 'bi-question'
    }
  }

  const getTypeBadge = (type) => {
    switch (type) {
      case 'header': return 'bg-secondary'
      case 'link': return 'bg-primary'
      case 'tree': return 'bg-info'
      default: return 'bg-dark'
    }
  }

  // Renderizar item en vista de árbol
  const renderTreeItem = (item, level = 0) => {
    return (
      <div key={item.nav_id}>
        <div 
          className={`d-flex align-items-center py-2 px-3 border-bottom ${!item.is_active ? 'bg-light text-muted' : ''}`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          {/* Indent indicator */}
          {level > 0 && (
            <span className="text-muted me-2">└─</span>
          )}

          {/* Type icon */}
          <i className={`bi ${getTypeIcon(item.type)} me-2 text-muted`}></i>

          {/* Icon (if exists) */}
          {item.icon && (
            <i className={`bi ${item.icon} me-2 text-primary`}></i>
          )}

          {/* Label */}
          <span className={`flex-grow-1 ${item.type === 'header' ? 'fw-bold text-uppercase small' : ''}`}>
            {item.label}
          </span>

          {/* Type badge */}
          <span className={`badge ${getTypeBadge(item.type)} me-2`} style={{ fontSize: '10px' }}>
            {item.type}
          </span>

          {/* Route */}
          {item.route && (
            <code className="small text-muted me-3">{item.route}</code>
          )}

          {/* Permission */}
          {item.permission_code && (
            <span className="badge bg-warning text-dark me-2" style={{ fontSize: '10px' }}>
              {item.permission_code}
            </span>
          )}

          {/* Status toggle */}
          <div className="form-check form-switch me-2">
            <input
              className="form-check-input"
              type="checkbox"
              checked={item.is_active === 1}
              onChange={() => toggleStatus(item)}
              style={{ cursor: 'pointer' }}
            />
          </div>

          {/* Actions */}
          <div className="btn-group btn-group-sm">
            <Link
              to={`/settings/navigation/${item.nav_id}`}
              className="btn btn-outline-primary btn-sm"
              title="Edit"
            >
              <i className="bi bi-pencil"></i>
            </Link>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => handleDelete(item)}
              title="Delete"
            >
              <i className="bi bi-trash"></i>
            </button>
          </div>
        </div>

        {/* Render children */}
        {item.children && item.children.length > 0 && (
          <div>
            {item.children.map(child => renderTreeItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // Renderizar tabla plana
  const renderFlatTable = () => (
    <div className="table-responsive">
      <table className="table table-hover mb-0">
        <thead className="table-light">
          <tr>
            <th style={{ width: '60px' }}>ID</th>
            <th style={{ width: '80px' }}>Order</th>
            <th style={{ width: '80px' }}>Type</th>
            <th>Label</th>
            <th>Icon</th>
            <th>Route</th>
            <th>Permission</th>
            <th>Parent</th>
            <th className="text-center" style={{ width: '80px' }}>Active</th>
            <th className="text-center" style={{ width: '120px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.nav_id} className={!item.is_active ? 'table-secondary' : ''}>
              <td className="text-muted">{item.nav_id}</td>
              <td>
                <span className="badge bg-light text-dark">{item.sort_order}</span>
              </td>
              <td>
                <span className={`badge ${getTypeBadge(item.type)}`}>{item.type}</span>
              </td>
              <td>
                {item.icon && <i className={`bi ${item.icon} me-2 text-primary`}></i>}
                <span className={item.type === 'header' ? 'fw-bold' : ''}>{item.label}</span>
              </td>
              <td>
                {item.icon ? (
                  <code className="small">{item.icon}</code>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
              <td>
                {item.route ? (
                  <code className="small">{item.route}</code>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
              <td>
                {item.permission_code ? (
                  <span className="badge bg-warning text-dark">{item.permission_code}</span>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
              <td>
                {item.parent_label ? (
                  <span className="badge bg-info">{item.parent_label}</span>
                ) : (
                  <span className="text-muted">Root</span>
                )}
              </td>
              <td className="text-center">
                <div className="form-check form-switch d-flex justify-content-center">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={item.is_active === 1}
                    onChange={() => toggleStatus(item)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </td>
              <td className="text-center">
                <div className="btn-group btn-group-sm">
                  <Link
                    to={`/settings/navigation/${item.nav_id}`}
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
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-menu-button-wide me-2"></i>
            Navigation Management
          </h3>
          <p className="text-muted mb-0">Configure sidebar menu items and structure</p>
        </div>
        <div className="d-flex gap-2">
          {/* View toggle */}
          <div className="btn-group">
            <button
              className={`btn btn-outline-secondary ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')}
              title="Tree View"
            >
              <i className="bi bi-diagram-3"></i>
            </button>
            <button
              className={`btn btn-outline-secondary ${viewMode === 'flat' ? 'active' : ''}`}
              onClick={() => setViewMode('flat')}
              title="Table View"
            >
              <i className="bi bi-table"></i>
            </button>
          </div>
          <Link to="/settings/navigation/new" className="btn btn-primary">
            <i className="bi bi-plus-lg me-2"></i>
            New Item
          </Link>
        </div>
      </div>

      {/* Legend */}
      <div className="card shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="d-flex gap-4 small">
            <span><span className="badge bg-secondary me-1">header</span> Section header</span>
            <span><span className="badge bg-primary me-1">link</span> Navigation link</span>
            <span><span className="badge bg-info me-1">tree</span> Expandable menu with children</span>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="card shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-menu-button-wide fs-1 mb-3 d-block"></i>
              No navigation items found
            </div>
          ) : viewMode === 'tree' ? (
            <div className="py-2">
              {treeItems.map(item => renderTreeItem(item))}
            </div>
          ) : (
            renderFlatTable()
          )}
        </div>
      </div>
    </div>
  )
}

export default Navigation