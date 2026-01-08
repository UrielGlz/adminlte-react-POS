import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

function Sidebar() {
  const location = useLocation()
  const { user } = useAuth()
  const [navigation, setNavigation] = useState([])
  const [openMenus, setOpenMenus] = useState({})
  const [loading, setLoading] = useState(true)

  // Cargar navegación del backend
  useEffect(() => {
    const fetchNavigation = async () => {
      try {
        const response = await api.get('/navigation')
        setNavigation(response.data.data)
      } catch (error) {
        console.error('Error loading navigation:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchNavigation()
    }
  }, [user])

  // Detectar menús abiertos por ruta actual
  useEffect(() => {
    const newOpenMenus = {}
    navigation.forEach(item => {
      if (item.type === 'tree' && item.children) {
        const isChildActive = item.children.some(child => 
          location.pathname === child.to || location.pathname.startsWith(child.to + '/')
        )
        if (isChildActive) {
          newOpenMenus[item.id] = true
        }
      }
    })
    setOpenMenus(prev => ({ ...prev, ...newOpenMenus }))
  }, [location.pathname, navigation])

  const isActive = (path) => location.pathname === path ? 'active' : ''

  const toggleMenu = (id, e) => {
    e.preventDefault()
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Renderizar item según tipo
  const renderNavItem = (item) => {
    switch (item.type) {
      case 'header':
        return (
          <li key={item.id} className="nav-header">
            {item.label}
          </li>
        )

      case 'link':
        return (
          <li key={item.id} className="nav-item">
            <Link to={item.to} className={`nav-link ${isActive(item.to)}`}>
              {item.icon && <i className={`nav-icon bi ${item.icon}`}></i>}
              <p>{item.label}</p>
            </Link>
          </li>
        )

      case 'tree':
        const isOpen = openMenus[item.id]
        return (
          <li key={item.id} className={`nav-item ${isOpen ? 'menu-open' : ''}`}>            
             <a href="#"
              className={`nav-link ${isOpen ? 'active' : ''}`}
              onClick={(e) => toggleMenu(item.id, e)}
            >
              {item.icon && <i className={`nav-icon bi ${item.icon}`}></i>}
              <p>
                {item.label}
                <i className="nav-arrow bi bi-chevron-right"></i>
              </p>
            </a>
            <ul className="nav nav-treeview">
              {item.children?.map(child => (
                <li key={child.id} className="nav-item">
                  <Link to={child.to} className={`nav-link ${isActive(child.to)}`}>
                    <i className="nav-icon bi bi-circle"></i>
                    <p>{child.label}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        )

      default:
        return null
    }
  }

  return (
    <aside className="app-sidebar bg-body-secondary shadow" data-bs-theme="dark">
      {/* Sidebar Brand */}
      <div className="sidebar-brand">
        <Link to="/" className="brand-link">
          <img
            src="https://adminlte.io/themes/v3/dist/img/AdminLTELogo.png"
            alt="Logo"
            className="brand-image opacity-75 shadow"
          />
          <span className="brand-text fw-light">AdminLTE React</span>
        </Link>
      </div>

      {/* Sidebar Wrapper */}
      <div className="sidebar-wrapper">
        <nav className="mt-2">
          <ul
            className="nav sidebar-menu flex-column"
            data-lte-toggle="treeview"
            role="menu"
            data-accordion="false"
          >
            {loading ? (
              <li className="nav-item">
                <span className="nav-link">
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Cargando...
                </span>
              </li>
            ) : (
              navigation.map(item => renderNavItem(item))
            )}
          </ul>
        </nav>
      </div>

      {/* User Panel (opcional) */}
      {user && (
        <div className="sidebar-footer p-3 border-top">
          <div className="d-flex align-items-center">
            <div className="flex-shrink-0">
              <i className="bi bi-person-circle fs-4"></i>
            </div>
            <div className="flex-grow-1 ms-2 text-truncate">
              <small className="d-block text-muted">{user.role}</small>
              <span>{user.fullName}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

export default Sidebar