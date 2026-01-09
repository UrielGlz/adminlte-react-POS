import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function PaymentMethodForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [usageCount, setUsageCount] = useState(0)

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    is_cash: false,
    allow_reference: true,
    is_active: true
  })

  useEffect(() => {
    if (isEditing) fetchItem()
  }, [id])

  const fetchItem = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/catalogs/payment-methods/${id}`)
      const item = response.data.data
      setFormData({
        code: item.code,
        name: item.name,
        is_cash: item.is_cash === 1,
        allow_reference: item.allow_reference === 1,
        is_active: item.is_active === 1
      })
      setUsageCount(item.usage_count || 0)
    } catch (error) {
      Swal.fire('Error', 'Could not load payment method', 'error')
      navigate('/catalogs/payment-methods')
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

    if (!formData.code.trim() || !formData.name.trim()) {
      Swal.fire('Validation Error', 'Code and Name are required', 'warning')
      return
    }

    try {
      setSaving(true)
      const payload = { ...formData, code: formData.code.toLowerCase() }

      if (isEditing) {
        await api.put(`/catalogs/payment-methods/${id}`, payload)
        Swal.fire({ icon: 'success', title: 'Updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
      } else {
        await api.post('/catalogs/payment-methods', payload)
        Swal.fire({ icon: 'success', title: 'Created!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
      }
      navigate('/catalogs/payment-methods')
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Could not save', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="container-fluid p-4 text-center"><div className="spinner-border text-primary"></div></div>
  }

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-credit-card me-2"></i>
            {isEditing ? 'Edit Payment Method' : 'New Payment Method'}
          </h3>
        </div>
        <Link to="/catalogs/payment-methods" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-2"></i>Back
        </Link>
      </div>

      <div className="row">
        <div className="col-md-6">
          <form onSubmit={handleSubmit}>
            <div className="card shadow-sm">
              <div className="card-header">
                <h5 className="card-title mb-0">Payment Method Information</h5>
              </div>
              <div className="card-body">
                {/* Code */}
                <div className="mb-3">
                  <label className="form-label">Code <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="e.g., cash, card, check"
                    maxLength={50}
                    required
                  />
                </div>

                {/* Name */}
                <div className="mb-3">
                  <label className="form-label">Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Cash, Credit Card"
                    maxLength={100}
                    required
                  />
                </div>

                {/* Checkboxes */}
                <div className="row mb-3">
                  <div className="col-6">
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" name="is_cash" id="is_cash" checked={formData.is_cash} onChange={handleChange} />
                      <label className="form-check-label" htmlFor="is_cash">Is Cash</label>
                    </div>
                    <small className="text-muted">Physical cash payment</small>
                  </div>
                  <div className="col-6">
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" name="allow_reference" id="allow_reference" checked={formData.allow_reference} onChange={handleChange} />
                      <label className="form-check-label" htmlFor="allow_reference">Allow Reference</label>
                    </div>
                    <small className="text-muted">Enable reference number</small>
                  </div>
                </div>

                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" name="is_active" id="is_active" checked={formData.is_active} onChange={handleChange} />
                  <label className="form-check-label" htmlFor="is_active">Active</label>
                </div>
              </div>

              <div className="card-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="bi bi-check-lg me-2"></i>{isEditing ? 'Update' : 'Create'}</>}
                </button>
                <Link to="/catalogs/payment-methods" className="btn btn-outline-secondary ms-2">Cancel</Link>
              </div>
            </div>
          </form>
        </div>

        {/* Info Panel */}
        <div className="col-md-6">
          {isEditing && usageCount > 0 && (
            <div className="alert alert-info">
              <i className="bi bi-info-circle me-2"></i>
              This payment method is used in <b>{usageCount}</b> payment(s).
            </div>
          )}
          <div className="card bg-light border-0">
            <div className="card-body">
              <h6><i className="bi bi-lightbulb me-2"></i>Tips</h6>
              <ul className="small text-muted mb-0">
                <li><b>Is Cash:</b> Mark for physical money payments</li>
                <li><b>Allow Reference:</b> Enable for cards, checks, transfers</li>
                <li>Code is used internally (lowercase)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentMethodForm