import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function DriverProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    is_active: true
  })
  const [auditInfo, setAuditInfo] = useState(null)

  useEffect(() => {
    if (isEditing) fetchItem()
  }, [id])

  const fetchItem = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/catalogs/driver-products/${id}`)
      const item = response.data.data
      setFormData({
        code: item.code,
        name: item.name,
        is_active: item.is_active === 1
      })
      setAuditInfo({
        created_at: item.created_at,
        created_by_username: item.created_by_username,
        updated_at: item.updated_at,
        edited_by_username: item.edited_by_username
      })
    } catch (error) {
      Swal.fire('Error', 'Could not load product', 'error')
      navigate('/catalogs/driver-products')
    } finally { setLoading(false) }
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

    if (!formData.code.trim() || !formData.name.trim()) {
      Swal.fire('Validation', 'Code and name are required', 'warning')
      return
    }

    try {
      setSaving(true)

      if (isEditing) {
        await api.put(`/catalogs/driver-products/${id}`, formData)
      } else {
        await api.post('/catalogs/driver-products', formData)
      }

      Swal.fire({
        icon: 'success',
        title: 'Saved!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      })
      navigate('/catalogs/driver-products')
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Could not save', 'error')
    } finally { setSaving(false) }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="container-fluid p-4 text-center">
        <div className="spinner-border text-primary"></div>
      </div>
    )
  }

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-box-seam me-2"></i>
            {isEditing ? 'Edit Product' : 'New Product'}
          </h3>
          <p className="text-muted mb-0">
            {isEditing ? 'Update product information' : 'Add a new driver product'}
          </p>
        </div>
        <Link to="/catalogs/driver-products" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-2"></i>Back to List
        </Link>
      </div>

      <div className="row">
        <div className="col-lg-6">
          <form onSubmit={handleSubmit}>
            <div className="card shadow-sm">
              <div className="card-header bg-light">
                <h5 className="mb-0"><i className="bi bi-info-circle me-2"></i>Product Information</h5>
              </div>
              <div className="card-body">
                {/* Code */}
                <div className="mb-3">
                  <label className="form-label">Code <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="e.g., CORN_Y, WHEAT, SCRAP"
                    maxLength={32}
                    style={{ textTransform: 'uppercase' }}
                    required
                  />
                  <div className="form-text">Unique identifier code (uppercase)</div>
                </div>

                {/* Name */}
                <div className="mb-3">
                  <label className="form-label">Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Yellow Corn, Wheat, Steel Scrap"
                    required
                  />
                </div>

                {/* Active Toggle */}
                <div className="border-top pt-3">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="is_active"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      style={{ width: '3em', height: '1.5em' }}
                    />
                    <label className="form-check-label ms-2" htmlFor="is_active">
                      {formData.is_active ? (
                        <span className="text-success fw-semibold">
                          <i className="bi bi-check-circle me-1"></i>Active
                        </span>
                      ) : (
                        <span className="text-secondary">
                          <i className="bi bi-x-circle me-1"></i>Inactive
                        </span>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="card-footer bg-light">
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg me-2"></i>
                        {isEditing ? 'Update' : 'Create'}
                      </>
                    )}
                  </button>
                  <Link to="/catalogs/driver-products" className="btn btn-outline-secondary">
                    Cancel
                  </Link>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Preview & Audit Info */}
        <div className="col-lg-6">
          {/* Preview */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-light">
              <h5 className="mb-0"><i className="bi bi-eye me-2"></i>Preview</h5>
            </div>
            <div className="card-body text-center py-4">
              <div className="display-4 mb-3">
                <i className="bi bi-box-seam text-primary"></i>
              </div>
              <h2 className="mb-2">
                <span className="badge bg-primary fs-4">
                  {formData.code || '???'}
                </span>
              </h2>
              <h4 className="text-muted">
                {formData.name || 'Product Name'}
              </h4>
              {!formData.is_active && (
                <span className="badge bg-secondary mt-2">Inactive</span>
              )}
            </div>
          </div>

          {/* Audit Info (solo en edición) */}
          {isEditing && auditInfo && (
            <div className="card shadow-sm">
              <div className="card-header bg-light">
                <h5 className="mb-0"><i className="bi bi-clock-history me-2"></i>Audit Information</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-6">
                    <small className="text-muted d-block">Created</small>
                    <strong>{formatDate(auditInfo.created_at)}</strong>
                    {auditInfo.created_by_username && (
                      <small className="text-muted d-block">by {auditInfo.created_by_username}</small>
                    )}
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Last Modified</small>
                    <strong>{formatDate(auditInfo.updated_at)}</strong>
                    {auditInfo.edited_by_username && (
                      <small className="text-muted d-block">by {auditInfo.edited_by_username}</small>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DriverProductForm