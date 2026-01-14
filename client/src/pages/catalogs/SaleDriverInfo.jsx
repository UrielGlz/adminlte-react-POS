import { useState, useEffect } from 'react'
import api from '../../services/api'
import Swal from 'sweetalert2'

function SaleDriverInfo() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  
  // Filtros
  const [search, setSearch] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterLicenseState, setFilterLicenseState] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Modal de detalle
  const [selectedItem, setSelectedItem] = useState(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { 
    fetchStats()
  }, [])

  useEffect(() => {
    fetchData()
  }, [pagination.page, filterAccount, filterLicenseState, filterProduct, dateFrom, dateTo])

  const fetchStats = async () => {
    try {
      const response = await api.get('/catalogs/sale-driver-info/stats')
      setStats(response.data.data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(search && { search }),
        ...(filterAccount && { account_number: filterAccount }),
        ...(filterLicenseState && { license_state: filterLicenseState }),
        ...(filterProduct && { driver_product_id: filterProduct }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo })
      })

      const response = await api.get(`/catalogs/sale-driver-info?${params}`)
      setItems(response.data.data)
      setPagination(prev => ({ ...prev, ...response.data.pagination }))
    } catch (error) {
      Swal.fire('Error', 'Could not load data', 'error')
    } finally { setLoading(false) }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchData()
  }

  const openDetail = async (id) => {
    try {
      const response = await api.get(`/catalogs/sale-driver-info/${id}`)
      setSelectedItem(response.data.data)
      setShowModal(true)
    } catch (error) {
      Swal.fire('Error', 'Could not load details', 'error')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const clearFilters = () => {
    setSearch('')
    setFilterAccount('')
    setFilterLicenseState('')
    setFilterProduct('')
    setDateFrom('')
    setDateTo('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1"><i className="bi bi-person-vcard me-2"></i>Driver Information Records</h3>
          <p className="text-muted mb-0">View driver data captured during scale transactions (Read-only)</p>
        </div>
        <span className="badge bg-secondary fs-6">
          <i className="bi bi-lock me-1"></i>Read Only
        </span>
      </div>

      {/* Stats Cards */}
      {stats?.totals && (
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card bg-primary text-white">
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h4 className="mb-0">{stats.totals.total_records}</h4>
                    <small>Total Records</small>
                  </div>
                  <i className="bi bi-list-ul fs-1 opacity-50"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-success text-white">
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h4 className="mb-0">{stats.totals.unique_drivers}</h4>
                    <small>Unique Drivers</small>
                  </div>
                  <i className="bi bi-people fs-1 opacity-50"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-info text-white">
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h4 className="mb-0">{stats.totals.unique_accounts}</h4>
                    <small>Unique Accounts</small>
                  </div>
                  <i className="bi bi-building fs-1 opacity-50"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-warning text-dark">
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h4 className="mb-0">{stats.totals.unique_vehicles}</h4>
                    <small>Unique Vehicles</small>
                  </div>
                  <i className="bi bi-truck fs-1 opacity-50"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-light">
          <h6 className="mb-0"><i className="bi bi-funnel me-2"></i>Filters</h6>
        </div>
        <div className="card-body">
          <form onSubmit={handleSearch}>
            <div className="row g-3">
              {/* Search */}
              <div className="col-md-4">
                <label className="form-label small">Search</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-search"></i></span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Driver, account, plates, license..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Account */}
              <div className="col-md-2">
                <label className="form-label small">Account</label>
                <select
                  className="form-select"
                  value={filterAccount}
                  onChange={(e) => { setFilterAccount(e.target.value); setPagination(p => ({...p, page: 1})) }}
                >
                  <option value="">All Accounts</option>
                  {stats?.accounts?.map(a => (
                    <option key={a.account_number} value={a.account_number}>
                      {a.account_number} - {a.account_name?.substring(0, 20)}
                    </option>
                  ))}
                </select>
              </div>

              {/* License State */}
              <div className="col-md-2">
                <label className="form-label small">License State</label>
                <select
                  className="form-select"
                  value={filterLicenseState}
                  onChange={(e) => { setFilterLicenseState(e.target.value); setPagination(p => ({...p, page: 1})) }}
                >
                  <option value="">All States</option>
                  {stats?.licenseStates?.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Product */}
              <div className="col-md-2">
                <label className="form-label small">Product</label>
                <select
                  className="form-select"
                  value={filterProduct}
                  onChange={(e) => { setFilterProduct(e.target.value); setPagination(p => ({...p, page: 1})) }}
                >
                  <option value="">All Products</option>
                  {stats?.products?.map(p => (
                    <option key={p.product_id} value={p.product_id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div className="col-md-2">
                <label className="form-label small">From Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPagination(p => ({...p, page: 1})) }}
                />
              </div>

              {/* Date To */}
              <div className="col-md-2">
                <label className="form-label small">To Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPagination(p => ({...p, page: 1})) }}
                />
              </div>

              {/* Buttons */}
              <div className="col-md-2 d-flex align-items-end gap-2">
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-search me-1"></i>Search
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
          </form>
        </div>
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
              <table className="table table-hover table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Driver</th>
                    <th>License</th>
                    <th>Account</th>
                    <th>Vehicle</th>
                    <th>Product</th>
                    <th>Sale UID</th>
                    <th className="text-center" style={{ width: '80px' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-4 text-muted">
                        <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                        No records found
                      </td>
                    </tr>
                  ) : items.map(item => (
                    <tr key={item.id_driver_info}>
                      <td>
                        <small className="text-muted">{formatDate(item.created_at)}</small>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '32px', height: '32px' }}>
                            <i className="bi bi-person-fill"></i>
                          </div>
                          <div>
                            <strong>{item.driver_first_name} {item.driver_last_name}</strong>
                            {item.driver_phone && (
                              <small className="text-muted d-block">
                                <i className="bi bi-telephone me-1"></i>{item.driver_phone}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <code className="bg-light px-1 rounded">{item.license_number}</code>
                        {item.license_state && (
                          <span className="badge bg-info ms-1">{item.license_state}</span>
                        )}
                      </td>
                      <td>
                        {item.account_number ? (
                          <div>
                            <code className="bg-light px-1 rounded small">{item.account_number}</code>
                            <small className="text-muted d-block text-truncate" style={{ maxWidth: '150px' }}>
                              {item.account_name}
                            </small>
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-secondary">{item.vehicle_plates || '-'}</span>
                        {item.tractor_number && (
                          <small className="text-muted d-block">T: {item.tractor_number}</small>
                        )}
                      </td>
                      <td>
                        {item.product_name ? (
                          <span className="badge bg-success">{item.product_name}</span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        {item.sale_uid ? (
                          <code className="small text-truncate d-inline-block" style={{ maxWidth: '100px' }} title={item.sale_uid}>
                            {item.sale_uid.substring(0, 8)}...
                          </code>
                        ) : (
                          <span className="badge bg-warning text-dark">No Sale</span>
                        )}
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openDetail(item.id_driver_info)}
                          title="View Details"
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center">
            <small className="text-muted">
              Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </small>
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPagination(p => ({...p, page: p.page - 1}))}>
                    <i className="bi bi-chevron-left"></i>
                  </button>
                </li>
                {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                  const pageNum = i + 1
                  return (
                    <li key={pageNum} className={`page-item ${pagination.page === pageNum ? 'active' : ''}`}>
                      <button className="page-link" onClick={() => setPagination(p => ({...p, page: pageNum}))}>
                        {pageNum}
                      </button>
                    </li>
                  )
                })}
                {pagination.totalPages > 5 && <li className="page-item disabled"><span className="page-link">...</span></li>}
                <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPagination(p => ({...p, page: p.page + 1}))}>
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedItem && (
        <>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">
                    <i className="bi bi-person-vcard me-2"></i>
                    Driver Record #{selectedItem.id_driver_info}
                  </h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-4">
                    {/* Driver Info */}
                    <div className="col-md-6">
                      <div className="card h-100">
                        <div className="card-header bg-light">
                          <h6 className="mb-0"><i className="bi bi-person me-2"></i>Driver Information</h6>
                        </div>
                        <div className="card-body">
                          <table className="table table-sm table-borderless mb-0">
                            <tbody>
                              <tr>
                                <td className="text-muted" style={{ width: '40%' }}>Name</td>
                                <td><strong>{selectedItem.driver_first_name} {selectedItem.driver_last_name}</strong></td>
                              </tr>
                              <tr>
                                <td className="text-muted">Phone</td>
                                <td>{selectedItem.driver_phone || '-'}</td>
                              </tr>
                              <tr>
                                <td className="text-muted">License #</td>
                                <td><code>{selectedItem.license_number || '-'}</code></td>
                              </tr>
                              <tr>
                                <td className="text-muted">License State</td>
                                <td><span className="badge bg-info">{selectedItem.license_state || '-'}</span></td>
                              </tr>
                              <tr>
                                <td className="text-muted">License Expiry</td>
                                <td>{selectedItem.license_expiry || '-'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Info */}
                    <div className="col-md-6">
                      <div className="card h-100">
                        <div className="card-header bg-light">
                          <h6 className="mb-0"><i className="bi bi-truck me-2"></i>Vehicle Information</h6>
                        </div>
                        <div className="card-body">
                          <table className="table table-sm table-borderless mb-0">
                            <tbody>
                              <tr>
                                <td className="text-muted" style={{ width: '40%' }}>Plates</td>
                                <td><span className="badge bg-secondary">{selectedItem.vehicle_plates || '-'}</span></td>
                              </tr>
                              <tr>
                                <td className="text-muted">Type</td>
                                <td>{selectedItem.vehicle_type_name || '-'}</td>
                              </tr>
                              <tr>
                                <td className="text-muted">Brand</td>
                                <td>{selectedItem.vehicle_brand || '-'}</td>
                              </tr>
                              <tr>
                                <td className="text-muted">Model</td>
                                <td>{selectedItem.vehicle_model || '-'}</td>
                              </tr>
                              <tr>
                                <td className="text-muted">Tractor #</td>
                                <td>{selectedItem.tractor_number || '-'}</td>
                              </tr>
                              <tr>
                                <td className="text-muted">Trailer #</td>
                                <td>{selectedItem.trailer_number || '-'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Account Info */}
                    <div className="col-md-6">
                      <div className="card h-100">
                        <div className="card-header bg-light">
                          <h6 className="mb-0"><i className="bi bi-building me-2"></i>Account Information</h6>
                        </div>
                        <div className="card-body">
                          <table className="table table-sm table-borderless mb-0">
                            <tbody>
                              <tr>
                                <td className="text-muted" style={{ width: '40%' }}>Account #</td>
                                <td><code>{selectedItem.account_number || '-'}</code></td>
                              </tr>
                              <tr>
                                <td className="text-muted">Name</td>
                                <td>{selectedItem.account_name || '-'}</td>
                              </tr>
                              <tr>
                                <td className="text-muted">Address</td>
                                <td><small>{selectedItem.account_address || '-'}</small></td>
                              </tr>
                              <tr>
                                <td className="text-muted">State</td>
                                <td>{selectedItem.account_state || '-'}</td>
                              </tr>
                              <tr>
                                <td className="text-muted">Country</td>
                                <td>{selectedItem.account_country || '-'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Transaction Info */}
                    <div className="col-md-6">
                      <div className="card h-100">
                        <div className="card-header bg-light">
                          <h6 className="mb-0"><i className="bi bi-receipt me-2"></i>Transaction Information</h6>
                        </div>
                        <div className="card-body">
                          <table className="table table-sm table-borderless mb-0">
                            <tbody>
                              <tr>
                                <td className="text-muted" style={{ width: '40%' }}>Sale UID</td>
                                <td>
                                  {selectedItem.sale_uid ? (
                                    <code className="small">{selectedItem.sale_uid}</code>
                                  ) : (
                                    <span className="badge bg-warning text-dark">No Sale</span>
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <td className="text-muted">Product</td>
                                <td>
                                  {selectedItem.product_name ? (
                                    <span className="badge bg-success">{selectedItem.product_code} - {selectedItem.product_name}</span>
                                  ) : '-'}
                                </td>
                              </tr>
                              <tr>
                                <td className="text-muted">Match Key</td>
                                <td><code className="small">{selectedItem.match_key || '-'}</code></td>
                              </tr>
                              <tr>
                                <td className="text-muted">Identify By</td>
                                <td>{selectedItem.identify_by || '-'}</td>
                              </tr>
                              <tr>
                                <td className="text-muted">Created</td>
                                <td>{formatDate(selectedItem.created_at)}</td>
                              </tr>
                              <tr>
                                <td className="text-muted">Updated</td>
                                <td>{formatDate(selectedItem.updated_at)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {selectedItem.notes && (
                      <div className="col-12">
                        <div className="card">
                          <div className="card-header bg-light">
                            <h6 className="mb-0"><i className="bi bi-sticky me-2"></i>Notes</h6>
                          </div>
                          <div className="card-body">
                            <p className="mb-0">{selectedItem.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    <i className="bi bi-x-lg me-2"></i>Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </div>
  )
}

export default SaleDriverInfo