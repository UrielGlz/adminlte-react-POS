import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function RoleForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [permissionsGrouped, setPermissionsGrouped] = useState({})

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    is_active: true,
    permission_ids: []
  })

  useEffect(() => {
    fetchPermissions()
    if (isEditing) {
      fetchRole()
    }
  }, [id])

  const fetchPermissions = async () => {
    try {
      const response = await api.get('/permissions')
      setPermissionsGrouped(response.data.data.grouped)
    } catch (error) {
      console.error('Error fetching permissions:', error)
    }
  }

  const fetchRole = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/roles/${id}`)
      const role = response.data.data
      setFormData({
        code: role.code,
        name: role.name,
        description: role.description || '',
        is_active: role.is_active === 1,
        permission_ids: role.permission_ids || []
      })
    } catch (error) {
      Swal.fire('Error', 'Could not load role', 'error')
      navigate('/settings/roles')
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

  const handlePermissionToggle = (permissionId) => {
    setFormData(prev => {
      const newIds = prev.permission_ids.includes(permissionId)
        ? prev.permission_ids.filter(id => id !== permissionId)
        : [...prev.permission_ids, permissionId]
      return { ...prev, permission_ids: newIds }
    })
  }

  const handleModuleToggle = (modulePermissions) => {
    const moduleIds = modulePermissions.map(p => p.permission_id)
    const allSelected = moduleIds.every(id => formData.permission_ids.includes(id))

    setFormData(prev => {
      let newIds
      if (allSelected) {
        // Deseleccionar todos del módulo
        newIds = prev.permission_ids.filter(id => !moduleIds.includes(id))
      } else {
        // Seleccionar todos del módulo
        newIds = [...new Set([...prev.permission_ids, ...moduleIds])]
      }
      return { ...prev, permission_ids: newIds }
    })
  }

  const handleSelectAll = () => {
    const allIds = Object.values(permissionsGrouped)
      .flat()
      .map(p => p.permission_id)
    
    const allSelected = allIds.every(id => formData.permission_ids.includes(id))
    
    setFormData(prev => ({
      ...prev,
      permission_ids: allSelected ? [] : allIds
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validaciones
    if (!formData.code.trim()) {
      Swal.fire('Validation Error', 'Code is required', 'warning')
      return
    }
    if (!formData.name.trim()) {
      Swal.fire('Validation Error', 'Name is required', 'warning')
      return
    }

    try {
      setSaving(true)

      const payload = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description || null,
        is_active: formData.is_active,
        permission_ids: formData.permission_ids
      }

      if (isEditing) {
        await api.put(`/roles/${id}`, payload)
        Swal.fire({
          icon: 'success',
          title: 'Role Updated',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
      } else {
        await api.post('/roles', payload)
        Swal.fire({
          icon: 'success',
          title: 'Role Created',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
      }

      navigate('/settings/roles')
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Could not save role', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container-fluid p-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  const allPermissionIds = Object.values(permissionsGrouped).flat().map(p => p.permission_id)
  const allSelected = allPermissionIds.length > 0 && 
    allPermissionIds.every(id => formData.permission_ids.includes(id))

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-shield-lock me-2"></i>
            {isEditing ? 'Edit Role' : 'New Role'}
          </h3>
          <p className="text-muted mb-0">
            {isEditing ? 'Modify role settings and permissions' : 'Create a new role with specific permissions'}
          </p>
        </div>
        <Link to="/settings/roles" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-2"></i>
          Back to Roles
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="row">
          {/* Left Column - Basic Info */}
          <div className="col-md-4">
            <div className="card shadow-sm">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  <i className="bi bi-info-circle me-2"></i>
                  Basic Information
                </h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">
                    Code <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control text-uppercase"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="e.g., MANAGER"
                    maxLength={20}
                    required
                  />
                  <small className="text-muted">Unique identifier (uppercase, no spaces)</small>
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Store Manager"
                    maxLength={100}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Brief description of this role..."
                    rows={3}
                    maxLength={255}
                  />
                </div>

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

            {/* Save Button */}
            <div className="d-grid gap-2 mt-3">
              <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-2"></i>
                    {isEditing ? 'Update Role' : 'Create Role'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column - Permissions */}
          <div className="col-md-8">
            <div className="card shadow-sm">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="bi bi-key me-2"></i>
                  Permissions
                  <span className="badge bg-primary ms-2">{formData.permission_ids.length}</span>
                </h5>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleSelectAll}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="card-body">
                <div className="row">
                  {Object.entries(permissionsGrouped).map(([module, permissions]) => {
                    const moduleIds = permissions.map(p => p.permission_id)
                    const allModuleSelected = moduleIds.every(id => formData.permission_ids.includes(id))
                    const someModuleSelected = moduleIds.some(id => formData.permission_ids.includes(id))

                    return (
                      <div key={module} className="col-md-6 mb-4">
                        <div className="card bg-light border-0">
                          <div className="card-header bg-transparent border-bottom py-2">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`module-${module}`}
                                checked={allModuleSelected}
                                ref={el => {
                                  if (el) el.indeterminate = someModuleSelected && !allModuleSelected
                                }}
                                onChange={() => handleModuleToggle(permissions)}
                              />
                              <label 
                                className="form-check-label fw-bold text-uppercase small"
                                htmlFor={`module-${module}`}
                              >
                                {module}
                              </label>
                            </div>
                          </div>
                          <div className="card-body py-2">
                            {permissions.map(perm => (
                              <div key={perm.permission_id} className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`perm-${perm.permission_id}`}
                                  checked={formData.permission_ids.includes(perm.permission_id)}
                                  onChange={() => handlePermissionToggle(perm.permission_id)}
                                />
                                <label 
                                  className="form-check-label"
                                  htmlFor={`perm-${perm.permission_id}`}
                                >
                                  {perm.name}
                                  <br />
                                  <code className="small text-muted">{perm.code}</code>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default RoleForm