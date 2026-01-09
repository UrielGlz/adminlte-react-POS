import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function VehicleTypes() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/catalogs/vehicle-types?all=true')
      setItems(response.data.data)
    } catch (error) {
      Swal.fire('Error', 'Could not load vehicle types', 'error')
    } finally { setLoading(false) }
  }

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Delete?', html: `Delete <b>${item.name}</b>?`, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Yes, delete'
    })
    if (result.isConfirmed) {
      try {
        await api.delete(`/catalogs/vehicle-types/${item.vehicle_type_id}`)
        Swal.fire({ icon: 'success', title: 'Deleted!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
        fetchData()
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not delete', 'error')
      }
    }
  }

  const toggleActive = async (item) => {
    try {
      await api.put(`/catalogs/vehicle-types/${item.vehicle_type_id}`, { ...item, is_active: !item.is_active })
      fetchData()
    } catch (error) { Swal.fire('Error', 'Could not update', 'error') }
  }

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1"><i className="bi bi-truck me-2"></i>Vehicle Types</h3>
          <p className="text-muted mb-0">Configure vehicle categories</p>
        </div>
        <Link to="/catalogs/vehicle-types/new" className="btn btn-primary">
          <i className="bi bi-plus-lg me-2"></i>New Type
        </Link>
      </div>

      <div className="card shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '60px' }}>ID</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th className="text-center">Active</th>
                    <th className="text-center" style={{ width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-4 text-muted">No vehicle types found</td></tr>
                  ) : items.map(item => (
                    <tr key={item.vehicle_type_id} className={!item.is_active ? 'table-secondary' : ''}>
                      <td className="text-muted">{item.vehicle_type_id}</td>
                      <td><code className="bg-light px-2 py-1 rounded">{item.code}</code></td>
                      <td><i className="bi bi-truck me-2 text-primary"></i>{item.name}</td>
                      <td className="text-center">
                        <div className="form-check form-switch d-flex justify-content-center">
                          <input className="form-check-input" type="checkbox" checked={item.is_active === 1} onChange={() => toggleActive(item)} style={{ cursor: 'pointer' }} />
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <Link to={`/catalogs/vehicle-types/${item.vehicle_type_id}`} className="btn btn-outline-primary"><i className="bi bi-pencil"></i></Link>
                          <button className="btn btn-outline-danger" onClick={() => handleDelete(item)}><i className="bi bi-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VehicleTypes