import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function StatusCatalogForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modules, setModules] = useState([])

  const [formData, setFormData] = useState({
    module: '',
    code: '',
    label: '',
    sort_order: 10,
    is_final: false,
    is_active: true
  })

  // Módulos predefinidos comunes
  const predefinedModules = ['SALES', 'PAYMENTS', 'TICKETS', 'CANCELLATION']

  useEffect(() => {
    fetchModules()
    if (isEditing) {
      fetchStatus()
    }
  }, [id])

  const fetchModules = async () => {
    try {
      const response = await api.get('/catalogs/status/modules')
      // Combinar módulos existentes con predefinidos
      const existing = response.data.data
      const combined = [...new Set([...predefinedModules, ...existing])].sort()
      setModules(combined)
    } catch (error) {
      console.error('Error fetching modules:', error)
    }
  }

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/catalogs/status/${id}`)
      const item = response.data.data
      setFormData({
        module: item.module,
        code: item.code,
        label: item.label,
        sort_order: item.sort_order,
        is_final: item.is_final === 1,
        is_active: item.is_active === 1
      })
    } catch (error) {
      Swal.fire('Error', 'Could not load status', 'error')
      navigate('/catalogs/status')
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
    if (!formData.module.trim()) {
      Swal.fire('Validation Error', 'Module is required', 'warning')
      return
    }
    if (!formData.code.trim()) {
      Swal.fire('Validation Error', 'Code is required', 'warning')
      return
    }
    if (!formData.label.trim()) {
      Swal.fire('Validation Error', 'Label is required', 'warning')
      return
    }

    try {
      setSaving(true)

      const payload = {
        module: formData.module.toUpperCase(),
        code: formData.code.toUpperCase(),
        label: formData.label,
        sort_order: parseInt(formData.sort_order) || 0,
        is_final: formData.is_final,
        is_active: formData.is_active
      }

      if (isEditing) {
        await api.put(`/catalogs/status/${id}`, payload)
        Swal.fire({
          icon: 'success',
          title: 'Status Updated',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
      } else {
        await api.post('/catalogs/status', payload)
        Swal.fire({
          icon: 'success',
          title: 'Status Created',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
      }

      navigate('/catalogs/status')
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Could not save status', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Códigos comunes sugeridos
  const suggestedCodes = {
    'SALES': ['OPEN', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ON_HOLD', 'PENDING'],
    'PAYMENTS': ['PENDING', 'RECEIVED', 'VOIDED', 'REFUNDED', 'FAILED'],
    'TICKETS': ['PRINTED', 'REPRINTED', 'VOIDED', 'PENDING'],
    'CANCELLATION': ['DUPLICATE', 'CUSTOMER_REQUEST', 'ERROR', 'TEST', 'OTHER']
  }

  const getCurrentSuggestions = () => {
    return suggestedCodes[formData.module] || []
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

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-collection me-2"></i>
            {isEditing ? 'Edit Status' : 'New Status'}
          </h3>
          <p className="text-muted mb-0">
            {isEditing ? 'Modify status settings' : 'Add a new status to the catalog'}
          </p>
        </div>
        <Link to="/catalogs/status" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-2"></i>
          Back to Catalog
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
                  Status Information
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
                    onChange={handleChange}
                    placeholder="e.g., SALES, PAYMENTS"
                    list="module-suggestions"
                    required
                  />
                  <datalist id="module-suggestions">
                    {modules.map(mod => (
                      <option key={mod} value={mod} />
                    ))}
                  </datalist>
                  <small className="text-muted">Select existing or type new module name</small>
                </div>

                {/* Code */}
                <div className="mb-3">
                  <label className="form-label">
                    Code <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="e.g., OPEN, COMPLETED"
                    style={{ textTransform: 'uppercase' }}
                    maxLength={50}
                    required
                  />
                  {getCurrentSuggestions().length > 0 && (
                    <div className="mt-2">
                      <small className="text-muted me-2">Suggestions:</small>
                      {getCurrentSuggestions().map(code => (
                        <button
                          key={code}
                          type="button"
                          className={`btn btn-sm me-1 mb-1 ${formData.code === code ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setFormData(prev => ({ ...prev, code }))}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  )}
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
                    placeholder="e.g., Open, Completed"
                    maxLength={100}
                    required
                  />
                  <small className="text-muted">Display text for this status</small>
                </div>

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

                {/* Checkboxes */}
                <div className="row">
                  <div className="col-6">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="is_final"
                        id="is_final"
                        checked={formData.is_final}
                        onChange={handleChange}
                      />
                      <label className="form-check-label" htmlFor="is_final">
                        Final Status
                      </label>
                    </div>
                    <small className="text-muted">No further transitions allowed</small>
                  </div>
                  <div className="col-6">
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
                    <small className="text-muted">Available for use</small>
                  </div>
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
                      {isEditing ? 'Update Status' : 'Create Status'}
                    </>
                  )}
                </button>
                <Link to="/catalogs/status" className="btn btn-outline-secondary ms-2">
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column - Preview & Help */}
        <div className="col-md-6">
          {/* Preview */}
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
                    <th style={{ width: '120px' }}>Module:</th>
                    <td>
                      <span className="badge bg-primary">
                        {formData.module || '-'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th>Code:</th>
                    <td>
                      <code className="bg-light px-2 py-1 rounded">
                        {formData.code || '-'}
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <th>Label:</th>
                    <td>{formData.label || '-'}</td>
                  </tr>
                  <tr>
                    <th>Order:</th>
                    <td>{formData.sort_order}</td>
                  </tr>
                  <tr>
                    <th>Final:</th>
                    <td>
                      {formData.is_final ? (
                        <span className="badge bg-warning text-dark">Yes - Terminal State</span>
                      ) : (
                        <span className="badge bg-secondary">No</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Active:</th>
                    <td>
                      {formData.is_active ? (
                        <span className="badge bg-success">Active</span>
                      ) : (
                        <span className="badge bg-danger">Inactive</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Help */}
          <div className="card bg-light border-0">
            <div className="card-body">
              <h6 className="card-title">
                <i className="bi bi-lightbulb me-2"></i>
                Tips
              </h6>
              <ul className="small text-muted mb-0">
                <li><b>Module:</b> Groups related statuses together</li>
                <li><b>Code:</b> Unique identifier within the module (uppercase)</li>
                <li><b>Label:</b> Human-readable display text</li>
                <li><b>Final Status:</b> Mark if this is a terminal state (e.g., COMPLETED, CANCELLED)</li>
                <li><b>Sort Order:</b> Use increments of 10 for easier reordering</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatusCatalogForm