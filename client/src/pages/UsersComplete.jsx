import { useState, useEffect } from 'react'
import api from '../services/api'
import { showAlert, showToast, confirmAction } from '../utils/alerts'

function UsersComplete() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    role_code: 'USER',
    is_active: 1,
    password: '',
    confirmPassword: ''
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [changePw, setChangePw] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])
  useEffect(() => { setPage(1) }, [searchTerm])


  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await api.get('/users')
      console.log('API Response:', response.data) // Debug

      // La respuesta viene en response.data.data (paginada)
      setUsers(response.data.data || [])

      setPage(1)

    } catch (error) {
      console.error('Error loading users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const isCreate = !editUser
    const wantsPw = isCreate || (editUser && changePw)

    if (wantsPw) {
      if (!formData.password || formData.password.length < 6) {
        await showAlert({
          type: 'warning',
          title: 'Invalid password',
          text: 'Password must be at least 6 characters long.'
        })
        return
      }

      if (formData.password !== formData.confirmPassword) {
        await showAlert({
          type: 'warning',
          title: 'Passwords do not match',
          text: 'Please make sure both password fields are the same.'
        })
        return
      }
    }


    const payload = { ...formData }
    delete payload.confirmPassword

    // 👇 Si NO quiere cambiar password en edición, no mandarlo
    if (!wantsPw) delete payload.password

    try {
      if (editUser) {
        await api.put(`/users/${editUser.user_id}`, payload)
        showToast({ type: 'success', title: 'Saved', text: 'User updated successfully.' })
      } else {
        await api.post('/users', payload)
        showToast({ type: 'success', title: 'Created', text: 'User created successfully.' })
      }

      loadUsers()
      closeModal()
    } catch (error) {
      console.error('Error saving user:', error)

      await showAlert({
        type: 'error',
        title: 'Save failed',
        text: error.response?.data?.message || 'Something went wrong while saving the user.'
      })
    }

  }



  const handleDelete = async (id) => {
    const ok = await confirmAction({
      title: 'Disable user?',
      text: 'This will disable the user..',
      confirmText: 'Yes, delete',
      cancelText: 'Cancel',
      type: 'warning',
    })

    if (!ok) return

    try {
      await api.delete(`/users/${id}`)
      showToast({ type: 'success', title: 'Deleted', text: 'User deleted successfully.' })
      loadUsers()
    } catch (error) {
      console.error('Error deleting user:', error)

      await showAlert({
        type: 'error',
        title: 'Delete failed',
        text: error.response?.data?.message || 'Something went wrong while deleting the user.'
      })
    }
  }


  const openModal = (user = null) => {
    setEditUser(user)
    setChangePw(false)

    setFormData(user ? {
      username: user.username || '',
      full_name: user.full_name || '',
      email: user.email || '',
      role_code: user.role_code || '',
      is_active: user.is_active ?? 1,
      password: '',           // 👈 en edición NO forzar password
      confirmPassword: ''
    } : {
      username: '',
      full_name: '',
      email: '',
      role_code: '',
      is_active: 1,
      password: '',           // 👈 en nuevo sí se captura
      confirmPassword: ''
    })

    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditUser(null)
    setFormData({ username: '', full_name: '', email: '', role_code: '', is_active: 1 })
  }

  const filteredUsers = users.filter(user =>
    (user.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )
  const totalRows = filteredUsers.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)

  const start = (safePage - 1) * pageSize
  const end = start + pageSize
  const pagedUsers = filteredUsers.slice(start, end)

  const getRoleBadge = (role) => {
    const badges = {
      'ADMIN': 'danger',
      'OPERATOR': 'warning',
      'USER': 'info',
      'EDITOR': 'primary'
    }
    return badges[role] || 'secondary'
  }

  // const formatDate = (dateString) => {
  //   if (!dateString) return '-'
  //   return new Date(dateString).toLocaleDateString('es-MX')
  // }
  const formatDate = (date) => {
    if (!date) return '-'

    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',        // respeta la hora del ...Z
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date))
  }

  return (
    <>
      {/* Content Header */}
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h3 className="mb-0">User Management</h3>
            </div>
            <div className="col-sm-6">
              <ol className="breadcrumb float-sm-end">
                <li className="breadcrumb-item"><a href="#">Home</a></li>
                <li className="breadcrumb-item"><a href="#">Administration</a></li>
                <li className="breadcrumb-item active">Users</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="app-content">
        <div className="container-fluid">

          {/* Stats Cards */}
          <div className="row">
            <div className="col-lg-3 col-6">
              <div className="small-box text-bg-primary">
                <div className="inner">
                  <h3>{pagination.total}</h3>
                  <p>Total Users</p>
                </div>
                <div className="small-box-icon">
                  <i className="bi bi-people-fill"></i>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="small-box text-bg-success">
                <div className="inner">
                  <h3>{users.filter(u => u.is_active === 1).length}</h3>
                  <p>Active Users</p>
                </div>
                <div className="small-box-icon">
                  <i className="bi bi-person-check-fill"></i>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="small-box text-bg-warning">
                <div className="inner">
                  <h3>{users.filter(u => u.role_code === 'ADMIN').length}</h3>
                  <p>Administrators</p>
                </div>
                <div className="small-box-icon">
                  <i className="bi bi-shield-fill"></i>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="small-box text-bg-danger">
                <div className="inner">
                  <h3>{users.filter(u => u.is_active === 0).length}</h3>
                  <p>Inactive</p>
                </div>
                <div className="small-box-icon">
                  <i className="bi bi-person-x-fill"></i>
                </div>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <i className="bi bi-table me-2"></i>
                Users List
              </h3>
              <div className="card-tools">
                <div className="input-group input-group-sm" style={{ width: '250px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="btn btn-default">
                    <i className="bi bi-search"></i>
                  </button>
                </div>
              </div>
            </div>

            <div className="card-body border-bottom">
              <button className="btn btn-primary" onClick={() => openModal()}>
                <i className="bi bi-plus-lg me-2"></i>
                New User
              </button>
              <button className="btn btn-default ms-2" onClick={loadUsers}>
                <i className="bi bi-arrow-clockwise me-2"></i>
                Refresh
              </button>
            </div>

            <div className="card-body table-responsive p-0">
              {loading ? (
                <div className="text-center p-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 text-muted">Loading users...</p>
                </div>
              ) : (
                <table className="table table-hover table-striped align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>ID</th>
                      <th>Username</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Created</th>
                      <th>Created By</th>
                      <th>Last Edit By</th>
                      <th style={{ width: '150px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center text-muted py-4">
                          <i className="bi bi-inbox" style={{ fontSize: '48px' }}></i>
                          <p className="mt-2">No users found</p>
                        </td>
                      </tr>
                    ) : (
                      pagedUsers.map((user) => (
                        <tr key={user.user_id}>
                          <td>{user.user_id}</td>
                          <td>
                            <div className="d-flex align-items-center">
                              {/* <img
                                src={`https://i.pravatar.cc/40?u=${user.user_id}`}
                                className="rounded-circle me-2"
                                alt=""
                                style={{ width: '32px', height: '32px' }}
                              /> */}
                              <strong>{user.username}</strong>
                            </div>
                          </td>
                          <td>{user.full_name}</td>
                          <td>
                            {user.email ? (
                              <a href={`mailto:${user.email}`}>{user.email}</a>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge text-bg-${getRoleBadge(user.role_code)}`}>
                              {user.role_code}
                            </span>
                          </td>
                          <td>
                            {user.is_active === 1 ? (
                              <span className="badge text-bg-success">
                                <i className="bi bi-check-circle me-1"></i>Active
                              </span>
                            ) : (
                              <span className="badge text-bg-secondary">
                                <i className="bi bi-x-circle me-1"></i>Inactive
                              </span>
                            )}
                          </td>
                          <td>{formatDate(user.created_at)}</td>
                          <td>{formatDate(user.created_at)}</td>
                          <td>
                            {user.created_by_username ? (
                              <span className="badge text-bg-light">{user.created_by_username}</span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            {user.edited_by_username ? (
                              <span className="badge text-bg-light">{user.edited_by_username}</span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            <div className="btn-group">
                              <button
                                className="btn btn-sm btn-info"
                                title="Edit"
                                onClick={() => openModal(user)}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                title="Delete"
                                onClick={() => handleDelete(user.user_id)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card-footer clearfix">
              <div className="float-start">
                <span className="text-muted">
                  Showing {totalRows === 0 ? 0 : start + 1}-{Math.min(end, totalRows)} of {totalRows} users

                </span>
              </div>
              <ul className="pagination pagination-sm m-0 float-end">
                <li className={`page-item ${safePage === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(1)}>«</button>
                </li>
                <li className={`page-item ${safePage === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(safePage - 1)}>‹</button>
                </li>

                <li className="page-item active">
                  <span className="page-link">{safePage} / {totalPages}</span>
                </li>

                <li className={`page-item ${safePage === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(safePage + 1)}>›</button>
                </li>
                <li className={`page-item ${safePage === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(totalPages)}>»</button>
                </li>
              </ul>

            </div>
          </div>

        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className={`bi ${editUser ? 'bi-pencil' : 'bi-person-plus'} me-2`}></i>
                    {editUser ? 'Edit User' : 'New User'}
                  </h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            Username <span className="text-danger">*</span>
                          </label>
                          <div className="input-group">
                            <span className="input-group-text">
                              <i className="bi bi-person"></i>
                            </span>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g. jperez"
                              value={formData.username}
                              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            Full Name <span className="text-danger">*</span>
                          </label>
                          <div className="input-group">
                            <span className="input-group-text">
                              <i className="bi bi-person-badge"></i>
                            </span>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g. John Doe"
                              value={formData.full_name}
                              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Email</label>
                          <div className="input-group">
                            <span className="input-group-text">
                              <i className="bi bi-envelope"></i>
                            </span>
                            <input
                              type="email"
                              className="form-control"
                              placeholder="e.g. john@email.com"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Role</label>
                          <select
                            className="form-select"
                            value={formData.role_code}
                            onChange={(e) => setFormData({ ...formData, role_code: e.target.value })}
                            required
                          >
                            <option value="">Select an option</option>
                            <option value="OPERATOR">Operator</option>
                            <option value="ADMINISTRATOR">Administrator</option>
                            <option value="ACCOUNTING">Accounting</option>

                          </select>
                        </div>
                      </div>
                    </div>

                    {editUser && (
                      <div className="form-check form-switch mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="changePwSwitch"
                          checked={changePw}
                          onChange={(e) => {
                            const on = e.target.checked
                            setChangePw(on)
                            if (!on) {
                              // if turned off, clear fields
                              setFormData(f => ({ ...f, password: '', confirmPassword: '' }))
                            }
                          }}
                        />
                        <label className="form-check-label" htmlFor="changePwSwitch">
                          Change password
                        </label>
                      </div>
                    )}

                    {(editUser ? changePw : true) && (
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Password <span className="text-danger">*</span>
                            </label>
                            <input
                              type="password"
                              className="form-control"
                              disabled={editUser && !changePw}
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              required={!editUser || changePw}
                            />
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Confirm Password <span className="text-danger">*</span>
                            </label>
                            <input
                              type="password"
                              className="form-control"
                              disabled={editUser && !changePw}
                              value={formData.confirmPassword}
                              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                              required={!editUser || changePw}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Status</label>
                          <select
                            className="form-select"
                            value={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: parseInt(e.target.value) })}
                          >
                            <option value={1}>Active</option>
                            <option value={0}>Inactive</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="callout callout-info">
                      <h5><i className="bi bi-info-circle me-2"></i>Note</h5>
                      <p className="mb-0">
                        Fields marked with <span className="text-danger">*</span> are required.
                      </p>
                    </div>
                  </div>

                  <div className="modal-footer justify-content-between">
                    <button type="button" className="btn btn-default" onClick={closeModal}>
                      <i className="bi bi-x-lg me-2"></i>Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <i className="bi bi-check-lg me-2"></i>
                      {editUser ? 'Save Changes' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </>
  )

}

export default UsersComplete
