import { useState, useEffect } from 'react'
import api from '../services/api'

function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', role: 'user' })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await api.get('/users')
      setUsers(response.data)
    } catch (error) {
      console.error('Error loading users:', error)
      // Datos de ejemplo
      setUsers([
        { id: 1, name: 'Juan Pérez', email: 'juan@email.com', role: 'admin', status: 'active' },
        { id: 2, name: 'María García', email: 'maria@email.com', role: 'user', status: 'active' },
        { id: 3, name: 'Carlos López', email: 'carlos@email.com', role: 'user', status: 'inactive' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, formData)
      } else {
        await api.post('/users', formData)
      }
      loadUsers()
      closeModal()
    } catch (error) {
      console.error('Error saving user:', error)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar este usuario?')) {
      try {
        await api.delete(`/users/${id}`)
        loadUsers()
      } catch (error) {
        console.error('Error deleting user:', error)
      }
    }
  }

  const openModal = (user = null) => {
    setEditUser(user)
    setFormData(user || { name: '', email: '', role: 'user' })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditUser(null)
    setFormData({ name: '', email: '', role: 'user' })
  }

  return (
    <>
      {/* Content Header */}
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h3 className="mb-0">Usuarios</h3>
            </div>
            <div className="col-sm-6">
              <ol className="breadcrumb float-sm-end">
                <li className="breadcrumb-item"><a href="#">Home</a></li>
                <li className="breadcrumb-item active">Usuarios</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="app-content">
        <div className="container-fluid">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Lista de Usuarios</h3>
              <div className="card-tools">
                <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
                  <i className="bi bi-plus-lg me-1"></i> Nuevo Usuario
                </button>
              </div>
            </div>
            <div className="card-body table-responsive p-0">
              {loading ? (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                </div>
              ) : (
                <table className="table table-hover text-nowrap">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>
                          <img 
                            src={`https://i.pravatar.cc/40?u=${user.id}`} 
                            className="rounded-circle me-2" 
                            alt=""
                            style={{ width: '32px', height: '32px' }}
                          />
                          {user.name}
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`badge text-bg-${user.role === 'admin' ? 'danger' : 'info'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge text-bg-${user.status === 'active' ? 'success' : 'secondary'}`}>
                            {user.status === 'active' ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn btn-info btn-sm me-1"
                            onClick={() => openModal(user)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(user.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nombre</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input 
                      type="email" 
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Rol</label>
                    <select 
                      className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editUser ? 'Guardar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Users
