import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ children, permission }) {
  const { isAuthenticated, loading, hasPermission } = useAuth()
  const location = useLocation()

  // Mostrar loading mientras verifica autenticación
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    )
  }

  // Si no está autenticado, redirigir a login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Si requiere permiso específico y no lo tiene
  if (permission && !hasPermission(permission)) {
    return (
      <div className="content-wrapper p-4">
        <div className="alert alert-danger">
          <h5><i className="bi bi-shield-exclamation"></i> Acceso denegado</h5>
          No tienes permiso para acceder a esta sección.
        </div>
      </div>
    )
  }

  return children
}

export default ProtectedRoute