import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function Customers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/customers?all=true')
      setItems(response.data.data)
    } catch (error) {
      Swal.fire('Error', 'Could not load customers', 'error')
    } finally { setLoading(false) }
  }

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Delete?', html: `Delete <b>${item.account_name}</b>?`, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Yes, delete'
    })
    if (result.isConfirmed) {
      try {
        await api.delete(`/customers/${item.id_customer}`)
        Swal.fire({ icon: 'success', title: 'Deleted!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
        fetchData()
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not delete', 'error')
      }
    }
  }

  const toggleActive = async (item) => {
    try {
      await api.put(`/customers/${item.id_customer}`, { ...item, is_active: !item.is_active })
      fetchData()
    } catch (error) { Swal.fire('Error', 'Could not update', 'error') }
  }

  const filtered = items.filter(i => 
    i.account_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.account_number?.toLowerCase().includes(search.toLowerCase())
  )

  const formatCurrency = (val) => val ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val) : '-'

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1"><i className="bi bi-people me-2"></i>Customers</h3>
          <p className="text-muted mb-0">Manage customer accounts</p>
        </div>
        <Link to="/customers/new" className="btn btn-primary">
          <i className="bi bi-plus-lg me-2"></i>New Customer
        </Link>
      </div>

      {/* Search */}
      <div className="card shadow-sm mb-4">
        <div className="card-body py-2">
          <div className="input-group">
            <span className="input-group-text"><i className="bi bi-search"></i></span>
            <input type="text" className="form-control" placeholder="Search by name or account number..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="btn btn-outline-secondary" onClick={() => setSearch('')}><i className="bi bi-x"></i></button>}
          </div>
        </div>
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
                    <th>Account #</th>
                    <th>Name</th>
                    <th>Location</th>
                    <th className="text-center">Credit</th>
                    <th className="text-end">Credit Limit</th>
                    <th className="text-end">Balance</th>
                    <th className="text-center">Active</th>
                    <th className="text-center" style={{ width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan="8" className="text-center py-4 text-muted">No customers found</td></tr>
                  ) : filtered.map(item => (
                    <tr key={item.id_customer} className={!item.is_active ? 'table-secondary' : ''}>
                      <td><code className="bg-light px-2 py-1 rounded">{item.account_number}</code></td>
                      <td><i className="bi bi-person me-2 text-primary"></i>{item.account_name}</td>
                      <td className="text-muted small">{[item.account_state, item.account_country].filter(Boolean).join(', ') || '-'}</td>
                      <td className="text-center">
                        {item.has_credit ? (
                          <span className={`badge ${item.is_suspended ? 'bg-danger' : 'bg-success'}`}>
                            {item.credit_type || 'Yes'} {item.is_suspended && '(Suspended)'}
                          </span>
                        ) : <span className="badge bg-secondary">No</span>}
                      </td>
                      <td className="text-end">{item.has_credit ? formatCurrency(item.credit_limit) : '-'}</td>
                      <td className="text-end">{item.has_credit ? formatCurrency(item.current_balance) : '-'}</td>
                      <td className="text-center">
                        <div className="form-check form-switch d-flex justify-content-center">
                          <input className="form-check-input" type="checkbox" checked={item.is_active === 1} onChange={() => toggleActive(item)} style={{ cursor: 'pointer' }} />
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <Link to={`/customers/${item.id_customer}`} className="btn btn-outline-primary"><i className="bi bi-pencil"></i></Link>
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
        <div className="card-footer text-muted small">{filtered.length} customer(s)</div>
      </div>
    </div>
  )
}

export default Customers