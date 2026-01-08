import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function Roles() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      setLoading(true)
      const response = await api.get('/roles')
      setRoles(response.data.data)
    } catch (error) {
      console.error('Error fetching roles:', error)
      Swal.fire('Error', 'Could not load roles', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (role) => {
    // No permitir eliminar si tiene usuarios
    if (role.users_count > 0) {
      Swal.fire(
        'Cannot Delete',
        `This role has ${role.users_count} user(s) assigned. Reassign them first.`,
        'warning'
      )
      return
    }

    const result = await Swal.fire({
      title: 'Delete Role?',
      text: `Are you sure you want to delete "${role.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    })

    if (result.isConfirmed) {
      try {
        await api.delete(`/roles/${role.role_id}`)
        Swal.fire('Deleted!', 'Role has been deleted.', 'success')
        fetchRoles()
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not delete role', 'error')
      }
    }
  }

  const toggleStatus = async (role) => {
    try {
      await api.put(`/roles/${role.role_id}`, {
        ...role,
        is_active: !role.is_active
      })
      fetchRoles()
      Swal.fire({
        icon: 'success',
        title: 'Status Updated',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      })
    } catch (error) {
      Swal.fire('Error', 'Could not update status', 'error')
    }
  }

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-shield-lock me-2"></i>
            Roles Management
          </h3>
          <p className="text-muted mb-0">Manage system roles and their permissions</p>
        </div>
        <Link to="/settings/roles/new" className="btn btn-primary">
          <i className="bi bi-plus-lg me-2"></i>
          New Role
        </Link>
      </div>

      {/* Table Card */}
      <div className="card shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '60px' }}>ID</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th className="text-center" style={{ width: '120px' }}>Permissions</th>
                    <th className="text-center" style={{ width: '100px' }}>Users</th>
                    <th className="text-center" style={{ width: '100px' }}>Status</th>
                    <th className="text-center" style={{ width: '150px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-4 text-muted">
                        No roles found
                      </td>
                    </tr>
                  ) : (
                    roles.map((role) => (
                      <tr key={role.role_id}>
                        <td className="text-muted">{role.role_id}</td>
                        <td>
                          <code className="bg-light px-2 py-1 rounded">{role.code}</code>
                        </td>
                        <td className="fw-semibold">{role.name}</td>
                        <td className="text-muted">{role.description || '-'}</td>
                        <td className="text-center">
                          <span className="badge bg-info">{role.permissions_count}</span>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${role.users_count > 0 ? 'bg-primary' : 'bg-secondary'}`}>
                            {role.users_count}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="form-check form-switch d-flex justify-content-center">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={role.is_active === 1}
                              onChange={() => toggleStatus(role)}
                              style={{ cursor: 'pointer' }}
                            />
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="btn-group btn-group-sm">
                            <Link
                              to={`/settings/roles/${role.role_id}`}
                              className="btn btn-outline-primary"
                              title="Edit"
                            >
                              <i className="bi bi-pencil"></i>
                            </Link>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => handleDelete(role)}
                              title="Delete"
                              disabled={role.users_count > 0}
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Roles