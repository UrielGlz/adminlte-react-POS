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
    account_number: '', account_name: '', account_address: '', account_country: 'USA', account_state: '',
    has_credit: false, is_active: true,
    credit: { credit_type: 'POSTPAID', credit_limit: 0, payment_terms_days: 30 }
  })

  const creditTypes = ['POSTPAID', 'PREPAID']

  useEffect(() => { if (isEditing) fetchItem() }, [id])

  const fetchItem = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/customers/${id}`)
      const item = response.data.data
      setFormData({
        account_number: item.account_number, account_name: item.account_name,
        account_address: item.account_address || '', account_country: item.account_country || 'USA',
        account_state: item.account_state || '', has_credit: item.has_credit === 1, is_active: item.is_active === 1,
        credit: {
          credit_type: item.credit_type || 'POSTPAID',
          credit_limit: item.credit_limit || 0,
          payment_terms_days: item.payment_terms_days || 30
        }
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
    if (!formData.account_number.trim() || !formData.account_name.trim()) {
      Swal.fire('Validation', 'Account number and name required', 'warning')
      return
    }
    try {
      setSaving(true)
      const payload = { ...formData, credit: formData.has_credit ? { ...formData.credit, credit_limit: parseFloat(formData.credit.credit_limit) || 0 } : null }
      if (isEditing) await api.put(`/customers/${id}`, payload)
      else await api.post('/customers', payload)
      Swal.fire({ icon: 'success', title: 'Saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
      navigate('/customers')
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Could not save', 'error')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="container-fluid p-4 text-center"><div className="spinner-border text-primary"></div></div>

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3><i className="bi bi-people me-2"></i>{isEditing ? 'Edit' : 'New'} Customer</h3>
        <Link to="/customers" className="btn btn-outline-secondary"><i className="bi bi-arrow-left me-2"></i>Back</Link>
      </div>
      <div className="row">
        <div className="col-md-8">
          <form onSubmit={handleSubmit}>
            <div className="card shadow-sm mb-3">
              <div className="card-header"><h5 className="mb-0">Account Information</h5></div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Account Number <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" name="account_number" value={formData.account_number} onChange={handleChange} required />
                  </div>
                  <div className="col-md-8 mb-3">
                    <label className="form-label">Account Name <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" name="account_name" value={formData.account_name} onChange={handleChange} required />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Address</label>
                  <input type="text" className="form-control" name="account_address" value={formData.account_address} onChange={handleChange} />
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">State</label>
                    <input type="text" className="form-control" name="account_state" value={formData.account_state} onChange={handleChange} placeholder="e.g., TX, CA" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Country</label>
                    <input type="text" className="form-control" name="account_country" value={formData.account_country} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
                  <label className="form-check-label">Active</label>
                </div>
              </div>
            </div>

            {/* Credit Section */}
            <div className="card shadow-sm mb-3">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Credit Settings</h5>
                <div className="form-check form-switch mb-0">
                  <input className="form-check-input" type="checkbox" name="has_credit" checked={formData.has_credit} onChange={handleChange} />
                  <label className="form-check-label">Enable Credit</label>
                </div>
              </div>
              {formData.has_credit && (
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Credit Type</label>
                      <select className="form-select" name="credit_credit_type" value={formData.credit.credit_type} onChange={handleChange}>
                        {creditTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Credit Limit</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" className="form-control" name="credit_credit_limit" value={formData.credit.credit_limit} onChange={handleChange} min="0" step="0.01" />
                      </div>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Payment Terms (days)</label>
                      <input type="number" className="form-control" name="credit_payment_terms_days" value={formData.credit.payment_terms_days} onChange={handleChange} min="0" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : <><i className="bi bi-check-lg me-2"></i>{isEditing ? 'Update' : 'Create'}</>}
            </button>
            <Link to="/customers" className="btn btn-outline-secondary ms-2">Cancel</Link>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CustomerForm