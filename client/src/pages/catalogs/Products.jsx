import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function Products() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/catalogs/products?all=true')
      setItems(response.data.data)
    } catch (error) {
      Swal.fire('Error', 'Could not load products', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Delete Product?',
      html: `Are you sure you want to delete <b>${item.name}</b>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Yes, delete it'
    })

    if (result.isConfirmed) {
      try {
        await api.delete(`/catalogs/products/${item.product_id}`)
        Swal.fire({ icon: 'success', title: 'Deleted!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
        fetchData()
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not delete', 'error')
      }
    }
  }

  const toggleActive = async (item) => {
    try {
      await api.put(`/catalogs/products/${item.product_id}`, {
        ...item,
        is_active: !item.is_active
      })
      fetchData()
    } catch (error) {
      Swal.fire('Error', 'Could not update', 'error')
    }
  }

  const formatPrice = (price, currency) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(price)
  }

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-box-seam me-2"></i>
            Products & Services
          </h3>
          <p className="text-muted mb-0">Configure weighing service prices</p>
        </div>
        <Link to="/catalogs/products/new" className="btn btn-primary">
          <i className="bi bi-plus-lg me-2"></i>
          New Product
        </Link>
      </div>

      {/* Table */}
      <div className="card shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary"></div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '60px' }}>ID</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Unit</th>
                    <th className="text-end">Price</th>
                    <th className="text-center">Taxable</th>
                    <th>Tax Rate</th>
                    <th className="text-center">Active</th>
                    <th className="text-center" style={{ width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-4 text-muted">No products found</td>
                    </tr>
                  ) : (
                    items.map(item => (
                      <tr key={item.product_id} className={!item.is_active ? 'table-secondary' : ''}>
                        <td className="text-muted">{item.product_id}</td>
                        <td><code className="bg-light px-2 py-1 rounded">{item.code}</code></td>
                        <td>
                          <i className="bi bi-box me-2 text-primary"></i>
                          {item.name}
                        </td>
                        <td><span className="badge bg-secondary">{item.unit}</span></td>
                        <td className="text-end fw-bold text-success">
                          {formatPrice(item.default_price, item.currency)}
                        </td>
                        <td className="text-center">
                          {item.taxable ? (
                            <i className="bi bi-check-circle-fill text-success"></i>
                          ) : (
                            <i className="bi bi-x-circle text-muted"></i>
                          )}
                        </td>
                        <td>
                          {item.tax_rate_name ? (
                            <span className="badge bg-info">{item.tax_rate_name} ({item.tax_rate_percent}%)</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="text-center">
                          <div className="form-check form-switch d-flex justify-content-center">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={item.is_active === 1}
                              onChange={() => toggleActive(item)}
                              style={{ cursor: 'pointer' }}
                            />
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="btn-group btn-group-sm">
                            <Link to={`/catalogs/products/${item.product_id}`} className="btn btn-outline-primary">
                              <i className="bi bi-pencil"></i>
                            </Link>
                            <button className="btn btn-outline-danger" onClick={() => handleDelete(item)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="card bg-light border-0 mt-4">
        <div className="card-body">
          <p className="small text-muted mb-0">
            <b>WEIGH:</b> Standard weighing service price. 
            <b className="ms-3">REWEIGH:</b> Price for re-weighing (when customer returns within time period).
          </p>
        </div>
      </div>
    </div>
  )
}

export default Products