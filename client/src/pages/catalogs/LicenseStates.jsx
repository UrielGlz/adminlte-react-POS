import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function LicenseStates() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [showInactive, setShowInactive] = useState(true)

  useEffect(() => { fetchData() }, [showInactive])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/catalogs/license-states?all=${showInactive}`)
      setItems(response.data.data)
    } catch (error) {
      Swal.fire('Error', 'Could not load states', 'error')
    } finally { setLoading(false) }
  }

  const handleDeactivate = async (item) => {
    const action = item.is_active ? 'deactivate' : 'activate'
    const result = await Swal.fire({
      title: `${item.is_active ? 'Deactivate' : 'Activate'}?`,
      html: `${action === 'deactivate' ? 'Deactivate' : 'Activate'} <b>${item.state_name} (${item.state_code})</b>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: item.is_active ? '#dc3545' : '#28a745',
      confirmButtonText: `Yes, ${action}`
    })
    if (result.isConfirmed) {
      try {
        if (item.is_active) {
          await api.delete(`/catalogs/license-states/${item.id_state}`)
        } else {
          await api.put(`/catalogs/license-states/${item.id_state}`, { is_active: true })
        }
        Swal.fire({
          icon: 'success',
          title: item.is_active ? 'Deactivated!' : 'Activated!',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        })
        fetchData()
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not update', 'error')
      }
    }
  }

  // Obtener países únicos para filtro
  const countries = [...new Set(items.map(i => i.country_code))].sort()

  const filtered = items.filter(i => {
    const matchesSearch =
      i.state_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.state_code?.toLowerCase().includes(search.toLowerCase())
    const matchesCountry = !filterCountry || i.country_code === filterCountry
    return matchesSearch && matchesCountry
  })

  const getCountryName = (code) => {
    const names = { 'US': 'United States', 'MX': 'Mexico', 'CA': 'Canada' }
    return names[code] || code
  }

  const getCountryFlag = (code) => {
    const flags = { 'US': '🇺🇸', 'MX': '🇲🇽', 'CA': '🇨🇦' }
    return flags[code] || '🏳️'
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1"><i className="bi bi-geo-alt me-2"></i>License States</h3>
          <p className="text-muted mb-0">Manage states for driver licenses</p>
        </div>
        <Link to="/catalogs/license-states/new" className="btn btn-primary">
          <i className="bi bi-plus-lg me-2"></i>New State
        </Link>
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-4">
        <div className="card-body py-2">
          <div className="row g-2 align-items-center">
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
              >
                <option value="">All Countries</option>
                {countries.map(c => (
                  <option key={c} value={c}>{getCountryFlag(c)} {getCountryName(c)}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="showInactive"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="showInactive">
                  Show inactive
                </label>
              </div>
            </div>
            <div className="col-md-2 text-end">
              <span className="text-muted">{filtered.length} state(s)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '100px' }}>Country</th>
                    <th style={{ width: '100px' }}>Code</th>
                    <th>State Name</th>
                    <th className="text-center" style={{ width: '100px' }}>Status</th>
                    <th style={{ width: '150px' }}>Created</th>
                    <th style={{ width: '150px' }}>Modified</th>
                    <th className="text-center" style={{ width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4 text-muted">
                        <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                        No states found
                      </td>
                    </tr>
                  ) : filtered.map(item => (
                    <tr key={item.id_state} className={!item.is_active ? 'table-secondary' : ''}>
                      <td>
                        <span className="me-1">{getCountryFlag(item.country_code)}</span>
                        <code className="bg-light px-1 rounded">{item.country_code}</code>
                      </td>
                      <td>
                        <code className="bg-primary text-white px-2 py-1 rounded fw-bold">
                          {item.state_code}
                        </code>
                      </td>
                      <td>
                        <i className="bi bi-geo-alt me-2 text-primary"></i>
                        {item.state_name}
                      </td>
                      <td className="text-center">
                        {item.is_active ? (
                          <span className="badge bg-success">Active</span>
                        ) : (
                          <span className="badge bg-secondary">Inactive</span>
                        )}
                      </td>
                      <td>
                        <small className="text-muted d-block">{formatDate(item.created_at)}</small>
                        {item.created_by_username && (
                          <small className="text-muted">by {item.created_by_username}</small>
                        )}
                      </td>
                      <td>
                        <small className="text-muted d-block">{formatDate(item.updated_at)}</small>
                        {item.edited_by_username && (
                          <small className="text-muted">by {item.edited_by_username}</small>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <Link
                            to={`/catalogs/license-states/${item.id_state}`}
                            className="btn btn-outline-primary"
                            title="Edit"
                          >
                            <i className="bi bi-pencil"></i>
                          </Link>
                          <button
                            className={`btn ${item.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                            onClick={() => handleDeactivate(item)}
                            title={item.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <i className={`bi ${item.is_active ? 'bi-x-circle' : 'bi-check-circle'}`}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LicenseStates