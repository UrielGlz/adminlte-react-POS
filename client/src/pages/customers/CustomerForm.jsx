import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    account_number: '',
    account_name: '', 
    account_address: '', 
    city: '',
    account_state: '',
    account_country: 'Mexico', 
    phone_number: '',
    tax_id: '',
    has_credit: false, 
    is_active: true,
    credit: { credit_type: 'POSTPAID', credit_limit: 0, payment_terms_days: 30 }
  })
  const [auditInfo, setAuditInfo] = useState(null)

  const creditTypes = ['POSTPAID', 'PREPAID']

  useEffect(() => { if (isEditing) fetchItem() }, [id])

  const fetchItem = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/customers/${id}`)
      const item = response.data.data
      setFormData({
        account_number: item.account_number,
        account_name: item.account_name,
        account_address: item.account_address || '', 
        city: item.city || '',
        account_state: item.account_state || '',
        account_country: item.account_country || 'Mexico',
        phone_number: item.phone_number || '',
        tax_id: item.tax_id || '',
        has_credit: item.has_credit === 1, 
        is_active: item.is_active === 1,
        credit: {
          credit_type: item.credit_type || 'POSTPAID',
          credit_limit: item.credit_limit || 0,
          payment_terms_days: item.payment_terms_days || 30
        }
      })
      setAuditInfo({
        created_at: item.created_at,
        created_by_username: item.created_by_username,
        updated_at: item.updated_at,
        edited_by_username: item.edited_by_username
      })
    } catch (error) {
      Swal.fire('Error', 'Could not load', 'error')
      navigate('/customers')
    } finally { setLoading(false) }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    if (name.startsWith('credit_')) {
      const field = name.replace('credit_', '')
      setFormData(prev => ({ ...prev, credit: { ...prev.credit, [field]: value } }))
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.account_name.trim()) {
      Swal.fire('Validation', 'Account name is required', 'warning')
      return
    }
    try {
      setSaving(true)
      const payload = { 
        ...formData, 
        credit: formData.has_credit ? { ...formData.credit, credit_limit: parseFloat(formData.credit.credit_limit) || 0 } : null 
      }
      // No enviar account_number en create (se genera automáticamente)
      if (!isEditing) delete payload.account_number
      
      if (isEditing) await api.put(`/customers/${id}`, payload)
      else await api.post('/customers', payload)
      
      Swal.fire({ icon: 'success', title: 'Saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
      navigate('/customers')
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

  if (loading) return <div className="container-fluid p-4 text-center"><div className="spinner-border text-primary"></div></div>

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-people me-2"></i>
            {isEditing ? 'Edit Customer' : 'New Customer'}
          </h3>
          {isEditing && formData.account_number && (
            <span className="badge bg-primary fs-6">{formData.account_number}</span>
          )}
        </div>
        <Link to="/customers" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-2"></i>Back to List
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Account Information - Full Width */}
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-light">
            <h5 className="mb-0"><i className="bi bi-building me-2"></i>Account Information</h5>
          </div>
          <div className="card-body">
            <div className="row">
              {/* Name */}
              <div className="col-md-6 mb-3">
                <label className="form-label">Account Name <span className="text-danger">*</span></label>
                <input 
                  type="text" 
                  className="form-control form-control-lg" 
                  name="account_name" 
                  value={formData.account_name} 
                  onChange={handleChange} 
                  placeholder="e.g., Transportes Acme S.A. de C.V."
                  required 
                />
              </div>
              {/* Tax ID */}
              <div className="col-md-3 mb-3">
                <label className="form-label">Tax ID (RFC)</label>
                <input 
                  type="text" 
                  className="form-control form-control-lg" 
                  name="tax_id" 
                  value={formData.tax_id} 
                  onChange={handleChange} 
                  placeholder="e.g., XAXX010101000"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              {/* Phone */}
              <div className="col-md-3 mb-3">
                <label className="form-label">Phone Number</label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text"><i className="bi bi-telephone"></i></span>
                  <input 
                    type="tel" 
                    className="form-control" 
                    name="phone_number" 
                    value={formData.phone_number} 
                    onChange={handleChange} 
                    placeholder="e.g., 844-123-4567"
                  />
                </div>
              </div>
            </div>

            <div className="row">
              {/* Address */}
              <div className="col-md-6 mb-3">
                <label className="form-label">Address</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="account_address" 
                  value={formData.account_address} 
                  onChange={handleChange}
                  placeholder="Street address"
                />
              </div>
              {/* City */}
              <div className="col-md-2 mb-3">
                <label className="form-label">City</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="city" 
                  value={formData.city} 
                  onChange={handleChange}
                  placeholder="e.g., Saltillo"
                />
              </div>
              {/* State */}
              <div className="col-md-2 mb-3">
                <label className="form-label">State</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="account_state" 
                  value={formData.account_state} 
                  onChange={handleChange} 
                  placeholder="e.g., Coahuila"
                />
              </div>
              {/* Country */}
              <div className="col-md-2 mb-3">
                <label className="form-label">Country</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="account_country" 
                  value={formData.account_country} 
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Status Toggle */}
            <div className="d-flex align-items-center pt-2 border-top">
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
                    <span className="text-success fw-semibold"><i className="bi bi-check-circle me-1"></i>Active</span>
                  ) : (
                    <span className="text-secondary"><i className="bi bi-x-circle me-1"></i>Inactive</span>
                  )}
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Credit Settings - Full Width */}
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-light d-flex justify-content-between align-items-center">
            <h5 className="mb-0"><i className="bi bi-credit-card me-2"></i>Credit Settings</h5>
            <div className="form-check form-switch mb-0">
              <input 
                className="form-check-input" 
                type="checkbox" 
                name="has_credit" 
                id="has_credit"
                checked={formData.has_credit} 
                onChange={handleChange}
                style={{ width: '3em', height: '1.5em' }}
              />
              <label className="form-check-label ms-2 fw-semibold" htmlFor="has_credit">
                Enable Credit Account
              </label>
            </div>
          </div>
          {formData.has_credit && (
            <div className="card-body">
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Credit Type</label>
                  <select 
                    className="form-select form-select-lg" 
                    name="credit_credit_type" 
                    value={formData.credit.credit_type} 
                    onChange={handleChange}
                  >
                    {creditTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="form-text">
                    {formData.credit.credit_type === 'POSTPAID' 
                      ? 'Customer pays after service (invoice)' 
                      : 'Customer has prepaid balance'}
                  </div>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Credit Limit</label>
                  <div className="input-group input-group-lg">
                    <span className="input-group-text">$</span>
                    <input 
                      type="number" 
                      className="form-control" 
                      name="credit_credit_limit" 
                      value={formData.credit.credit_limit} 
                      onChange={handleChange} 
                      min="0" 
                      step="0.01" 
                    />
                    <span className="input-group-text">USD</span>
                  </div>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Payment Terms</label>
                  <div className="input-group input-group-lg">
                    <input 
                      type="number" 
                      className="form-control" 
                      name="credit_payment_terms_days" 
                      value={formData.credit.payment_terms_days} 
                      onChange={handleChange} 
                      min="0" 
                    />
                    <span className="input-group-text">days</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Audit Information (solo en edición) */}
        {isEditing && auditInfo && (
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-light">
              <h5 className="mb-0"><i className="bi bi-clock-history me-2"></i>Audit Information</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <small className="text-muted d-block">Created</small>
                  <strong>{formatDate(auditInfo.created_at)}</strong>
                  {auditInfo.created_by_username && (
                    <small className="text-muted d-block">by {auditInfo.created_by_username}</small>
                  )}
                </div>
                <div className="col-md-6">
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

        {/* Action Buttons */}
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary btn-lg px-4" disabled={saving}>
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg me-2"></i>
                {isEditing ? 'Update Customer' : 'Create Customer'}
              </>
            )}
          </button>
          <Link to="/customers" className="btn btn-outline-secondary btn-lg px-4">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

export default CustomerForm