import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function PermissionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modules, setModules] = useState([])
  const [permissionDetails, setPermissionDetails] = useState(null)

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    module: '',
    description: ''
  })

  useEffect(() => {
    fetchModules()
    if (isEditing) {
      fetchPermission()
    }
  }, [id])

  const fetchModules = async () => {
    try {
      const response = await api.get('/permissions/modules')
      setModules(response.data.data)
    } catch (error) {
      console.error('Error fetching modules:', error)
    }
  }

  const fetchPermission = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/permissions/${id}`)
      const perm = response.data.data
      setFormData({
        code: perm.code,
        name: perm.name,
        module: perm.module,
        description: perm.description || ''
      })
      setPermissionDetails(perm)
    } catch (error) {
      Swal.fire('Error', 'Could not load permission', 'error')
      navigate('/settings/permissions')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Auto-generar código cuando cambia módulo o action
  const handleModuleChange = (e) => {
    const module = e.target.value.toLowerCase()
    setFormData(prev => {
      const action = prev.code.includes('.') ? prev.code.split('.')[1] : ''
      return {
        ...prev,
        module: module,
        code: action ? `${module}.${action}` : module
      }
    })
  }

  const handleActionChange = (e) => {
    const action = e.target.value.toLowerCase().replace(/[^a-z]/g, '')
    setFormData(prev => ({
      ...prev,
      code: prev.module ? `${prev.module}.${action}` : action
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validaciones
    if (!formData.module.trim()) {
      Swal.fire('Validation Error', 'Module is required', 'warning')
      return
    }
    if (!formData.code.trim() || !formData.code.includes('.')) {
      Swal.fire('Validation Error', 'Code must be in format: module.action', 'warning')
      return
    }
    if (!formData.name.trim()) {
      Swal.fire('Validation Error', 'Name is required', 'warning')
      return
    }

    try {
      setSaving(true)

      const payload = {
        code: formData.code.toLowerCase(),
        name: formData.name,
        module: formData.module.toLowerCase(),
        description: formData.description || null
      }

      if (isEditing) {
        await api.put(`/permissions/${id}`, payload)
        Swal.fire({
          icon: 'success',
          title: 'Permission Updated',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
      } else {
        await api.post('/permissions', payload)
        Swal.fire({
          icon: 'success',
          title: 'Permission Created',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
      }

      navigate('/settings/permissions')
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Could not save permission', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Acciones comunes sugeridas
  const commonActions = ['view', 'read', 'write', 'create', 'edit', 'delete', 'manage', 'export', 'import']

  if (loading) {
    return (
      <div className="container-fluid p-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  const currentAction = formData.code.includes('.') ? formData.code.split('.')[1] : ''

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-key me-2"></i>
            {isEditing ? 'Edit Permission' : 'New Permission'}
          </h3>
          <p className="text-muted mb-0">
            {isEditing ? 'Modify permission settings' : 'Create a new system permission'}
          </p>
        </div>
        <Link to="/settings/permissions" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-2"></i>
          Back to Permissions
        </Link>
      </div>

      <div className="row">
        {/* Left Column - Form */}
        <div className="col-md-6">
          <form onSubmit={handleSubmit}>
            <div className="card shadow-sm">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  <i className="bi bi-info-circle me-2"></i>
                  Permission Information
                </h5>
              </div>
              <div className="card-body">
                {/* Module */}
                <div className="mb-3">
                  <label className="form-label">
                    Module <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="module"
                    value={formData.module}
                    onChange={handleModuleChange}
                    placeholder="e.g., users, reports, credits"
                    list="module-suggestions"
                    required
                  />
                  <datalist id="module-suggestions">
                    {modules.map(mod => (
                      <option key={mod} value={mod} />
                    ))}
                  </datalist>
                  <small className="text-muted">Enter existing module or create new one</small>
                </div>

                {/* Action */}
                <div className="mb-3">
                  <label className="form-label">
                    Action <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={currentAction}
                    onChange={handleActionChange}
                    placeholder="e.g., read, write, delete"
                    required
                  />
                  <div className="mt-2">
                    <small className="text-muted me-2">Quick select:</small>
                    {commonActions.map(action => (
                      <button
                        key={action}
                        type="button"
                        className={`btn btn-sm me-1 mb-1 ${currentAction === action ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => handleActionChange({ target: { value: action } })}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generated Code (readonly) */}
                <div className="mb-3">
                  <label className="form-label">Generated Code</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="bi bi-code"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light"
                      value={formData.code}
                      readOnly
                    />
                  </div>
                  <small className="text-muted">Auto-generated from module and action</small>
                </div>

                {/* Name */}
                <div className="mb-3">
                  <label className="form-label">
                    Display Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., View Users, Create Reports"
                    maxLength={100}
                    required
                  />
                  <small className="text-muted">Human-readable name for this permission</small>
                </div>

                {/* Description */}
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Optional description of what this permission allows..."
                    rows={3}
                    maxLength={255}
                  />
                </div>
              </div>

              <div className="card-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg me-2"></i>
                      {isEditing ? 'Update Permission' : 'Create Permission'}
                    </>
                  )}
                </button>
                <Link to="/settings/permissions" className="btn btn-outline-secondary ms-2">
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column - Preview & Info */}
        <div className="col-md-6">
          {/* Preview Card */}
          <div className="card shadow-sm mb-3">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="bi bi-eye me-2"></i>
                Preview
              </h5>
            </div>
            <div className="card-body">
              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <th style={{ width: '120px' }}>Code:</th>
                    <td><code className="bg-light px-2 py-1 rounded">{formData.code || '-'}</code></td>
                  </tr>
                  <tr>
                    <th>Name:</th>
                    <td>{formData.name || '-'}</td>
                  </tr>
                  <tr>
                    <th>Module:</th>
                    <td><span className="badge bg-primary">{formData.module || '-'}</span></td>
                  </tr>
                  <tr>
                    <th>Description:</th>
                    <td className="text-muted">{formData.description || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Usage Info (only when editing) */}
          {isEditing && permissionDetails && (
            <div className="card shadow-sm mb-3">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  <i className="bi bi-diagram-3 me-2"></i>
                  Usage
                </h5>
              </div>
              <div className="card-body">
                {/* Roles using this permission */}
                <h6 className="small text-muted mb-2">
                  <i className="bi bi-shield me-1"></i>
                  Assigned to Roles ({permissionDetails.roles?.length || 0})
                </h6>
                {permissionDetails.roles?.length > 0 ? (
                  <div className="mb-3">
                    {permissionDetails.roles.map(role => (
                      <Link
                        key={role.role_id}
                        to={`/settings/roles/${role.role_id}`}
                        className="badge bg-success me-1 mb-1 text-decoration-none"
                      >
                        {role.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted small mb-3">Not assigned to any roles</p>
                )}

                {/* Nav items using this permission */}
                <h6 className="small text-muted mb-2">
                  <i className="bi bi-menu-button-wide me-1"></i>
                  Used in Menu Items ({permissionDetails.nav_items?.length || 0})
                </h6>
                {permissionDetails.nav_items?.length > 0 ? (
                  <div>
                    {permissionDetails.nav_items.map(item => (
                      <Link
                        key={item.nav_id}
                        to={`/settings/navigation/${item.nav_id}`}
                        className="badge bg-info me-1 mb-1 text-decoration-none"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted small mb-0">Not used in any menu items</p>
                )}
              </div>
            </div>
          )}

          {/* Help Card */}
          <div className="card bg-light border-0">
            <div className="card-body">
              <h6 className="card-title">
                <i className="bi bi-lightbulb me-2"></i>
                Tips
              </h6>
              <ul className="small text-muted mb-0">
                <li>Use lowercase for module and action</li>
                <li>Common actions: <code>view</code>, <code>read</code>, <code>write</code>, <code>delete</code></li>
                <li>After creating, assign to roles in Roles Management</li>
                <li>Use in Navigation to control menu visibility</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PermissionForm