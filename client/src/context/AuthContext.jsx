import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Al cargar, verificar si hay sesión guardada
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken')
      const savedUser = localStorage.getItem('user')
      
      if (token && savedUser) {
        try {
          // Verificar que el token siga válido
          const response = await api.get('/auth/me')
          setUser(response.data.data)
        } catch (error) {
          // Token inválido, limpiar
          logout()
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (username, password) => {
    const response = await api.post('/auth/login', { username, password })
    const { accessToken, refreshToken, user } = response.data.data

    // Guardar en localStorage
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('user', JSON.stringify(user))

    setUser(user)
    return user
  }

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Limpiar localStorage
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      setUser(null)
    }
  }

  const hasPermission = (permission) => {
    if (!user?.permissions) return false
    return user.permissions.includes(permission)
  }

  const hasAnyPermission = (...permissions) => {
    if (!user?.permissions) return false
    return permissions.some(p => user.permissions.includes(p))
  }

  const value = {
    user,
    loading,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}

export default AuthContext