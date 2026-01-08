import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const toggleSidebar = (e) => {
    e.preventDefault()
    const collapsedNow = document.body.classList.toggle('sidebar-collapse')
    localStorage.setItem('sidebarCollapsed', collapsedNow ? '1' : '0')
  }

  const handleLogout = async (e) => {
    e.preventDefault()
    await logout()
    navigate('/login', { replace: true })
  }

  const toggleFullscreen = (e) => {
    e.preventDefault()
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  return (
    <nav className="app-header navbar navbar-expand bg-body">
      <div className="container-fluid">
        {/* Sidebar Toggle */}
        <ul className="navbar-nav">
          <li className="nav-item">
            <a className="nav-link" href="#" role="button" onClick={toggleSidebar}>
              <i className="bi bi-list"></i>
            </a>
          </li>
          <li className="nav-item d-none d-md-block">
            <Link to="/" className="nav-link">Home</Link>
          </li>
        </ul>

        {/* Right Side */}
        <ul className="navbar-nav ms-auto">
          {/* Fullscreen */}
          <li className="nav-item">
            <a className="nav-link" href="#" onClick={toggleFullscreen}>
              <i className="bi bi-arrows-fullscreen"></i>
            </a>
          </li>

          {/* Notifications */}
          <li className="nav-item dropdown">
            <a className="nav-link" data-bs-toggle="dropdown" href="#">
              <i className="bi bi-bell-fill"></i>
              <span className="navbar-badge badge text-bg-warning">15</span>
            </a>
            <div className="dropdown-menu dropdown-menu-lg dropdown-menu-end">
              <span className="dropdown-item dropdown-header">15 Notifications</span>
              <div className="dropdown-divider"></div>
              <a href="#" className="dropdown-item" onClick={(e) => e.preventDefault()}>
                <i className="bi bi-envelope me-2"></i> 4 new messages
                <span className="float-end text-secondary fs-7">3 mins</span>
              </a>
              <div className="dropdown-divider"></div>
              <a href="#" className="dropdown-item" onClick={(e) => e.preventDefault()}>
                <i className="bi bi-people me-2"></i> 2 new users registered
                <span className="float-end text-secondary fs-7">12 mins</span>
              </a>
              <div className="dropdown-divider"></div>
              <a href="#" className="dropdown-item dropdown-footer" onClick={(e) => e.preventDefault()}>
                View all notifications
              </a>
            </div>
          </li>

          {/* User Menu */}
          <li className="nav-item dropdown user-menu">
            <a href="#" className="nav-link dropdown-toggle" data-bs-toggle="dropdown">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'User')}&background=0d6efd&color=fff`}
                className="user-image rounded-circle shadow"
                alt="User"
              />
              <span className="d-none d-md-inline">{user?.fullName || 'User'}</span>
            </a>
            <ul className="dropdown-menu dropdown-menu-lg dropdown-menu-end">
              <li className="user-header text-bg-primary">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'User')}&background=0d6efd&color=fff&size=128`}
                  className="rounded-circle shadow"
                  alt="User"
                />
                <p>
                  {user?.fullName || 'User'}
                  <small>{user?.role || 'Role'}</small>
                </p>
              </li>
              <li className="user-body">
                <div className="row text-center">
                  <div className="col-6 border-end">
                    <small className="text-muted d-block">Username</small>
                    <span className="fw-semibold">{user?.username || '-'}</span>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Site ID</small>
                    <span className="fw-semibold">{user?.siteId || '-'}</span>
                  </div>
                </div>
              </li>
              <li className="user-footer">
                <a href="#" className="btn btn-outline-secondary btn-sm" onClick={(e) => e.preventDefault()}>
                  <i className="bi bi-person me-1"></i> Profile
                </a>
                <a href="#" className="btn btn-outline-danger btn-sm float-end" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-1"></i> Sign Out
                </a>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Header