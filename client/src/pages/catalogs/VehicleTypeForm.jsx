import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function VehicleTypeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ code: '', name: '', is_active: true })

  useEffect(() => { if (isEditing) fetchItem() }, [id])

  const fetchItem = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/catalogs/vehicle-types/${id}`)
      const item = response.data.data
      setFormData({ code: item.code, name: item.name, is_active: item.is_active === 1 })
    } catch (error) {
      Swal.fire('Error', 'Could not load', 'error')
      navigate('/catalogs/vehicle-types')
    } finally { setLoading(false) }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.code.trim() || !formData.name.trim()) {
      Swal.fire('Validation', 'Code and Name required', 'warning')
      return
    }
    try {
      setSaving(true)
      if (isEditing) {
        await api.put(`/catalogs/vehicle-types/${id}`, formData)
      } else {
        await api.post('/catalogs/vehicle-types', formData)
      }
      Swal.fire({ icon: 'success', title: 'Saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
      navigate('/catalogs/vehicle-types')
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Could not save', 'error')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="container-fluid p-4 text-center"><div className="spinner-border text-primary"></div></div>

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3><i className="bi bi-truck me-2"></i>{isEditing ? 'Edit' : 'New'} Vehicle Type</h3>
        <Link to="/catalogs/vehicle-types" className="btn btn-outline-secondary"><i className="bi bi-arrow-left me-2"></i>Back</Link>
      </div>
      <div className="row">
        <div className="col-md-6">
          <form onSubmit={handleSubmit}>
            <div className="card shadow-sm">
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Code <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" name="code" value={formData.code} onChange={handleChange} style={{ textTransform: 'uppercase' }} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Name <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" name="name" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
                  <label className="form-check-label">Active</label>
                </div>
              </div>
              <div className="card-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : <><i className="bi bi-check-lg me-2"></i>{isEditing ? 'Update' : 'Create'}</>}
                </button>
                <Link to="/catalogs/vehicle-types" className="btn btn-outline-secondary ms-2">Cancel</Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default VehicleTypeForm