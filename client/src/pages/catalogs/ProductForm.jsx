import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [taxRates, setTaxRates] = useState([])
  const [usageCount, setUsageCount] = useState(0)

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    unit: 'service',
    default_price: '',
    currency: 'USD',
    taxable: false,
    default_tax_rate_id: '',
    is_active: true,
    meta: { type: '' }
  })

  const units = ['service', 'unit', 'lb', 'kg', 'ton', 'hour']
  const currencies = ['USD', 'MXN']
  const productTypes = [
    { value: 'weigh', label: 'Weigh - Standard weighing' },
    { value: 'reweigh', label: 'Reweigh - Re-weighing service' },
    { value: 'other', label: 'Other' }
  ]

  useEffect(() => {
    fetchTaxRates()
    if (isEditing) fetchItem()
  }, [id])

  const fetchTaxRates = async () => {
    try {
      const response = await api.get('/catalogs/products/tax-rates')
      setTaxRates(response.data.data)
    } catch (error) {
      console.error('Error fetching tax rates:', error)
    }
  }

  const fetchItem = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/catalogs/products/${id}`)
      const item = response.data.data
      setFormData({
        code: item.code,
        name: item.name,
        unit: item.unit,
        default_price: item.default_price,
        currency: item.currency || 'USD',
        taxable: item.taxable === 1,
        default_tax_rate_id: item.default_tax_rate_id || '',
        is_active: item.is_active === 1,
        meta: item.meta || { type: '' }
      })
      setUsageCount(item.usage_count || 0)
    } catch (error) {
      Swal.fire('Error', 'Could not load product', 'error')
      navigate('/catalogs/products')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    
    if (name === 'meta_type') {
      setFormData(prev => ({
        ...prev,
        meta: { ...prev.meta, type: value }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.code.trim() || !formData.name.trim()) {
      Swal.fire('Validation Error', 'Code and Name are required', 'warning')
      return
    }

    if (!formData.default_price || parseFloat(formData.default_price) < 0) {
      Swal.fire('Validation Error', 'Price must be a valid positive number', 'warning')
      return
    }

    try {
      setSaving(true)
      const payload = {
        ...formData,
        code: formData.code.toUpperCase(),
        default_price: parseFloat(formData.default_price),
        default_tax_rate_id: formData.default_tax_rate_id || null
      }

      if (isEditing) {
        await api.put(`/catalogs/products/${id}`, payload)
        Swal.fire({ icon: 'success', title: 'Updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
      } else {
        await api.post('/catalogs/products', payload)
        Swal.fire({ icon: 'success', title: 'Created!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
      }
      navigate('/catalogs/products')
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Could not save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const formatPrice = (price, currency) => {
    if (!price) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(price)
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
            <i className="bi bi-box-seam me-2"></i>
            {isEditing ? 'Edit Product' : 'New Product'}
          </h3>
          <p className="text-muted mb-0">{isEditing ? 'Modify product settings' : 'Add a new product or service'}</p>
        </div>
        <Link to="/catalogs/products" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-2"></i>Back
        </Link>
      </div>

      <div className="row">
        {/* Left Column - Form */}
        <div className="col-md-7">
          <form onSubmit={handleSubmit}>
            <div className="card shadow-sm">
              <div className="card-header">
                <h5 className="card-title mb-0">Product Information</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  {/* Code */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Code <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="e.g., WEIGH, REWEIGH"
                      style={{ textTransform: 'uppercase' }}
                      maxLength={80}
                      required
                    />
                  </div>

                  {/* Name */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g., Weigh, Reweigh"
                      maxLength={180}
                      required
                    />
                  </div>
                </div>

                <div className="row">
                  {/* Price */}
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Price <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        name="default_price"
                        value={formData.default_price}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                  </div>

                  {/* Currency */}
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Currency</label>
                    <select
                      className="form-select"
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                    >
                      {currencies.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Unit */}
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Unit</label>
                    <select
                      className="form-select"
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                    >
                      {units.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="row">
                  {/* Product Type */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Product Type</label>
                    <select
                      className="form-select"
                      name="meta_type"
                      value={formData.meta?.type || ''}
                      onChange={handleChange}
                    >
                      <option value="">-- Select type --</option>
                      {productTypes.map(pt => (
                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                      ))}
                    </select>
                    <small className="text-muted">Used by POS to identify service type</small>
                  </div>

                  {/* Tax Rate */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Default Tax Rate</label>
                    <select
                      className="form-select"
                      name="default_tax_rate_id"
                      value={formData.default_tax_rate_id}
                      onChange={handleChange}
                    >
                      <option value="">-- No tax --</option>
                      {taxRates.map(tr => (
                        <option key={tr.tax_rate_id} value={tr.tax_rate_id}>
                          {tr.name} ({tr.percent}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="row">
                  <div className="col-md-4">
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" name="taxable" id="taxable" checked={formData.taxable} onChange={handleChange} />
                      <label className="form-check-label" htmlFor="taxable">Taxable</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" name="is_active" id="is_active" checked={formData.is_active} onChange={handleChange} />
                      <label className="form-check-label" htmlFor="is_active">Active</label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="bi bi-check-lg me-2"></i>{isEditing ? 'Update' : 'Create'}</>}
                </button>
                <Link to="/catalogs/products" className="btn btn-outline-secondary ms-2">Cancel</Link>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column - Preview & Help */}
        <div className="col-md-5">
          {/* Preview */}
          <div className="card shadow-sm mb-3">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0"><i className="bi bi-eye me-2"></i>Preview</h5>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="mb-0">{formData.name || 'Product Name'}</h4>
                  <code className="text-muted">{formData.code || 'CODE'}</code>
                </div>
                <div className="text-end">
                  <h3 className="mb-0 text-success">{formatPrice(formData.default_price, formData.currency)}</h3>
                  <small className="text-muted">per {formData.unit}</small>
                </div>
              </div>
              <hr />
              <div className="row small">
                <div className="col-6">
                  <span className="text-muted">Type:</span><br />
                  <span className="badge bg-info">{formData.meta?.type || 'N/A'}</span>
                </div>
                <div className="col-6">
                  <span className="text-muted">Taxable:</span><br />
                  {formData.taxable ? <span className="badge bg-success">Yes</span> : <span className="badge bg-secondary">No</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Usage Warning */}
          {isEditing && usageCount > 0 && (
            <div className="alert alert-warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              This product is used in <b>{usageCount}</b> sale(s). Changes will not affect past transactions.
            </div>
          )}

          {/* Help */}
          <div className="card bg-light border-0">
            <div className="card-body">
              <h6><i className="bi bi-lightbulb me-2"></i>Tips</h6>
              <ul className="small text-muted mb-0">
                <li><b>WEIGH:</b> Standard first-time weighing service</li>
                <li><b>REWEIGH:</b> Return weighing within time period (lower price)</li>
                <li>Product type is used by POS to apply correct pricing</li>
                <li>Price changes apply to new transactions only</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductForm