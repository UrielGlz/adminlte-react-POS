import { Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

function Sidebar() {
  const location = useLocation()

  const isActive = (path) => (location.pathname === path ? 'active' : '')

  // Abre el menú si estás dentro de /settings (o rutas hijas)
  const isInSettings = useMemo(
    () => location.pathname.startsWith('/settings'),
    [location.pathname]
  )

  const [settingsOpen, setSettingsOpen] = useState(isInSettings)

  useEffect(() => {
    setSettingsOpen(isInSettings)
  }, [isInSettings])

  const toggleSettings = (e) => {
    e.preventDefault()
    setSettingsOpen((v) => !v)
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
            {/* Dashboard */}
            <li className="nav-item">
              <Link to="/" className={`nav-link ${isActive('/')}`}>
                <i className="nav-icon bi bi-speedometer"></i>
                <p>Dashboard</p>
              </Link>
            </li>

            {/* Management Section */}
            <li className="nav-header">ADMINISTRACIÓN</li>

            <li className="nav-item">
              <Link to="/users-crud" className={`nav-link ${isActive('/users-crud')}`}>
                <i className="nav-icon bi bi-people"></i>
                <p>Usuarios</p>
              </Link>
            </li>

            {/* Settings with submenu */}
            <li className={`nav-item ${settingsOpen ? 'menu-open' : ''}`}>
              <a
                href="#"
                className={`nav-link ${settingsOpen ? 'active' : ''}`}
                onClick={toggleSettings}
              >
                <i className="nav-icon bi bi-gear"></i>
                <p>
                  Configuración
                  <i className="nav-arrow bi bi-chevron-right"></i>
                </p>
              </a>

              {/* SIN inline style: AdminLTE lo maneja con menu-open */}
              <ul className="nav nav-treeview">
                <li className="nav-item">
                  <Link to="/settings" className={`nav-link ${isActive('/settings')}`}>
                    <i className="nav-icon bi bi-circle"></i>
                    <p>General</p>
                  </Link>
                </li>

                <li className="nav-item">
                  <a href="#" className="nav-link" onClick={(e) => e.preventDefault()}>
                    <i className="nav-icon bi bi-circle"></i>
                    <p>Seguridad</p>
                  </a>
                </li>
              </ul>
            </li>

            {/* Reports */}
            <li className="nav-header">REPORTES</li>

            <li className="nav-item">
              <a href="#" className="nav-link" onClick={(e) => e.preventDefault()}>
                <i className="nav-icon bi bi-bar-chart"></i>
                <p>Ventas</p>
              </a>
            </li>

            <li className="nav-item">
              <a href="#" className="nav-link" onClick={(e) => e.preventDefault()}>
                <i className="nav-icon bi bi-graph-up"></i>
                <p>Analytics</p>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar
