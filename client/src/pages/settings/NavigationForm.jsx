import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function NavigationForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [parentOptions, setParentOptions] = useState([])
  const [permissionOptions, setPermissionOptions] = useState([])

  const [formData, setFormData] = useState({
    parent_id: '',
    type: 'link',
    label: '',
    icon: '',
    route: '',
    permission_code: '',
    sort_order: 0,
    is_active: true
  })

  useEffect(() => {
    fetchOptions()
    if (isEditing) {
      fetchItem()
    }
  }, [id])

  const fetchOptions = async () => {
    try {
      const [parentsRes, permsRes] = await Promise.all([
        api.get(`/navigation/admin/options/parents${isEditing ? `?exclude=${id}` : ''}`),
        api.get('/navigation/admin/options/permissions')
      ])
      setParentOptions(parentsRes.data.data)
      setPermissionOptions(permsRes.data.data)
    } catch (error) {
      console.error('Error fetching options:', error)
    }
  }

  const fetchItem = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/navigation/admin/${id}`)
      const item = response.data.data
      setFormData({
        parent_id: item.parent_id || '',
        type: item.type,
        label: item.label,
        icon: item.icon || '',
        route: item.route || '',
        permission_code: item.permission_code || '',
        sort_order: item.sort_order,
        is_active: item.is_active === 1
      })
    } catch (error) {
      Swal.fire('Error', 'Could not load item', 'error')
      navigate('/settings/navigation')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validaciones
    if (!formData.label.trim()) {
      Swal.fire('Validation Error', 'Label is required', 'warning')
      return
    }

    // Si es link, route es requerido
    if (formData.type === 'link' && !formData.route.trim()) {
      Swal.fire('Validation Error', 'Route is required for links', 'warning')
      return
    }

    try {
      setSaving(true)

      const payload = {
        parent_id: formData.parent_id || null,
        type: formData.type,
        label: formData.label,
        icon: formData.icon || null,
        route: formData.route || null,
        permission_code: formData.permission_code || null,
        sort_order: parseInt(formData.sort_order) || 0,
        is_active: formData.is_active
      }

      if (isEditing) {
        await api.put(`/navigation/admin/${id}`, payload)
        Swal.fire({
          icon: 'success',
          title: 'Item Updated',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
      } else {
        await api.post('/navigation/admin', payload)
        Swal.fire({
          icon: 'success',
          title: 'Item Created',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
      }

      navigate('/settings/navigation')
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Could not save item', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Iconos comunes de Bootstrap Icons
  const commonIcons = [
    'bi-house', 'bi-speedometer2', 'bi-people', 'bi-person', 'bi-gear',
    'bi-file-earmark', 'bi-file-earmark-bar-graph', 'bi-folder', 'bi-cart',
    'bi-box', 'bi-calendar', 'bi-clock', 'bi-bell', 'bi-envelope',
    'bi-chat', 'bi-star', 'bi-heart', 'bi-bookmark', 'bi-flag',
    'bi-shield', 'bi-lock', 'bi-key', 'bi-tools', 'bi-wrench',
    'bi-database', 'bi-server', 'bi-cloud', 'bi-globe', 'bi-map',
    'bi-graph-up', 'bi-bar-chart', 'bi-pie-chart', 'bi-table', 'bi-grid',
    'bi-list', 'bi-menu-button-wide', 'bi-layout-sidebar', 'bi-window',
    'bi-cash', 'bi-credit-card', 'bi-wallet', 'bi-receipt', 'bi-calculator'
  ]

  if (loading) {
    return (
      <div className="container-fluid p-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-menu-button-wide me-2"></i>
            {isEditing ? 'Edit Navigation Item' : 'New Navigation Item'}
          </h3>
          <p className="text-muted mb-0">
            {isEditing ? 'Modify menu item settings' : 'Add a new item to the navigation menu'}
          </p>
        </div>
        <Link to="/settings/navigation" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-2"></i>
          Back to Navigation
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="row">
          {/* Left Column - Basic Info */}
          <div className="col-md-6">
            <div className="card shadow-sm">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  <i className="bi bi-info-circle me-2"></i>
                  Basic Information
                </h5>
              </div>
              <div className="card-body">
                {/* Type */}
                <div className="mb-3">
                  <label className="form-label">
                    Type <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                  >
                    <option value="link">Link - Navigation link</option>
                    <option value="header">Header - Section title</option>
                    <option value="tree">Tree - Expandable menu</option>
                  </select>
                  <small className="text-muted">
                    {formData.type === 'header' && 'Headers are section titles (no link)'}
                    {formData.type === 'link' && 'Links navigate to a route'}
                    {formData.type === 'tree' && 'Trees can contain child items'}
                  </small>
                </div>

                {/* Label */}
                <div className="mb-3">
                  <label className="form-label">
                    Label <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="label"
                    value={formData.label}
                    onChange={handleChange}
                    placeholder="e.g., Dashboard, Settings"
                    maxLength={100}
                    required
                  />
                </div>

                {/* Parent (only for non-header) */}
                {formData.type !== 'header' && (
                  <div className="mb-3">
                    <label className="form-label">Parent</label>
                    <select
                      className="form-select"
                      name="parent_id"
                      value={formData.parent_id}
                      onChange={handleChange}
                    >
                      <option value="">-- Root level --</option>
                      {parentOptions.map(parent => (
                        <option key={parent.nav_id} value={parent.nav_id}>
                          {parent.label}
                        </option>
                      ))}
                    </select>
                    <small className="text-muted">Leave empty for root level items</small>
                  </div>
                )}

                {/* Route (only for link) */}
                {formData.type === 'link' && (
                  <div className="mb-3">
                    <label className="form-label">
                      Route <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="route"
                      value={formData.route}
                      onChange={handleChange}
                      placeholder="e.g., /users, /reports/sales"
                      maxLength={100}
                    />
                    <small className="text-muted">Frontend route path</small>
                  </div>
                )}

                {/* Sort Order */}
                <div className="mb-3">
                  <label className="form-label">Sort Order</label>
                  <input
                    type="number"
                    className="form-control"
                    name="sort_order"
                    value={formData.sort_order}
                    onChange={handleChange}
                    min={0}
                    max={999}
                  />
                  <small className="text-muted">Lower numbers appear first</small>
                </div>

                {/* Active */}
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    name="is_active"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                  />
                  <label className="form-check-label" htmlFor="is_active">
                    Active
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Icon & Permission */}
          <div className="col-md-6">
            {/* Icon Selection */}
            {formData.type !== 'header' && (
              <div className="card shadow-sm mb-3">
                <div className="card-header">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-palette me-2"></i>
                    Icon
                  </h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">Icon Class</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        {formData.icon ? (
                          <i className={`bi ${formData.icon}`}></i>
                        ) : (
                          <i className="bi bi-question text-muted"></i>
                        )}
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        name="icon"
                        value={formData.icon}
                        onChange={handleChange}
                        placeholder="e.g., bi-house"
                      />
                    </div>
                    <small className="text-muted">
                      Bootstrap Icons class. <a href="https://icons.getbootstrap.com/" target="_blank" rel="noreferrer">Browse icons</a>
                    </small>
                  </div>

                  {/* Quick icon selection */}
                  <div>
                    <label className="form-label small">Quick Select</label>
                    <div className="d-flex flex-wrap gap-1">
                      {commonIcons.map(icon => (
                        <button
                          key={icon}
                          type="button"
                          className={`btn btn-sm ${formData.icon === icon ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setFormData(prev => ({ ...prev, icon }))}
                          title={icon}
                        >
                          <i className={`bi ${icon}`}></i>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Permission */}
            <div className="card shadow-sm">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  <i className="bi bi-shield-lock me-2"></i>
                  Access Control
                </h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Required Permission</label>
                  <select
                    className="form-select"
                    name="permission_code"
                    value={formData.permission_code}
                    onChange={handleChange}
                  >
                    <option value="">-- No restriction (visible to all) --</option>
                    {permissionOptions.map(perm => (
                      <option key={perm.code} value={perm.code}>
                        [{perm.module}] {perm.name} ({perm.code})
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">
                    Users without this permission won't see this menu item
                  </small>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="card shadow-sm mt-3">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  <i className="bi bi-eye me-2"></i>
                  Preview
                </h5>
              </div>
              <div className="card-body bg-dark text-light">
                {formData.type === 'header' ? (
                  <div className="nav-header text-uppercase small text-muted">
                    {formData.label || 'HEADER LABEL'}
                  </div>
                ) : (
                  <div className="d-flex align-items-center py-2">
                    {formData.icon && (
                      <i className={`bi ${formData.icon} me-2`}></i>
                    )}
                    <span>{formData.label || 'Menu Item'}</span>
                    {formData.type === 'tree' && (
                      <i className="bi bi-chevron-right ms-auto"></i>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="row mt-3">
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-body d-flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg me-2"></i>
                      {isEditing ? 'Update Item' : 'Create Item'}
                    </>
                  )}
                </button>
                <Link to="/settings/navigation" className="btn btn-outline-secondary">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default NavigationForm