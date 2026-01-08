import { useState } from 'react'

function Settings() {
  const [settings, setSettings] = useState({
    siteName: 'Mi Aplicación',
    siteEmail: 'admin@miapp.com',
    timezone: 'America/Mexico_City',
    language: 'es',
    notifications: true,
    darkMode: false
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Settings saved:', settings)
    alert('Configuración guardada')
  }

  return (
    <>
      {/* Content Header */}
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h3 className="mb-0">Configuración</h3>
            </div>
            <div className="col-sm-6">
              <ol className="breadcrumb float-sm-end">
                <li className="breadcrumb-item"><a href="#">Home</a></li>
                <li className="breadcrumb-item active">Configuración</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            {/* General Settings */}
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="bi bi-gear me-2"></i>
                    Configuración General
                  </h3>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="card-body">
                    <div className="mb-3">
                      <label className="form-label">Nombre del Sitio</label>
                      <input 
                        type="text" 
                        className="form-control"
                        name="siteName"
                        value={settings.siteName}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Email del Sitio</label>
                      <input 
                        type="email" 
                        className="form-control"
                        name="siteEmail"
                        value={settings.siteEmail}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Zona Horaria</label>
                      <select 
                        className="form-select"
                        name="timezone"
                        value={settings.timezone}
                        onChange={handleChange}
                      >
                        <option value="America/Mexico_City">Ciudad de México</option>
                        <option value="America/New_York">New York</option>
                        <option value="America/Los_Angeles">Los Angeles</option>
                        <option value="Europe/Madrid">Madrid</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Idioma</label>
                      <select 
                        className="form-select"
                        name="language"
                        value={settings.language}
                        onChange={handleChange}
                      >
                        <option value="es">Español</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>
                  <div className="card-footer">
                    <button type="submit" className="btn btn-primary">
                      <i className="bi bi-save me-1"></i> Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Preferences */}
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="bi bi-sliders me-2"></i>
                    Preferencias
                  </h3>
                </div>
                <div className="card-body">
                  <div className="form-check form-switch mb-3">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id="notifications"
                      name="notifications"
                      checked={settings.notifications}
                      onChange={handleChange}
                    />
                    <label className="form-check-label" htmlFor="notifications">
                      Recibir Notificaciones
                    </label>
                  </div>
                  <div className="form-check form-switch mb-3">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id="darkMode"
                      name="darkMode"
                      checked={settings.darkMode}
                      onChange={handleChange}
                    />
                    <label className="form-check-label" htmlFor="darkMode">
                      Modo Oscuro
                    </label>
                  </div>
                </div>
              </div>

              {/* Info Card */}
              <div className="card card-outline card-info">
                <div className="card-header">
                  <h3 className="card-title">Información del Sistema</h3>
                </div>
                <div className="card-body">
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Versión</dt>
                    <dd className="col-sm-8">1.0.0</dd>
                    
                    <dt className="col-sm-4">React</dt>
                    <dd className="col-sm-8">18.2.0</dd>
                    
                    <dt className="col-sm-4">AdminLTE</dt>
                    <dd className="col-sm-8">4.0.0</dd>
                    
                    <dt className="col-sm-4">Node.js</dt>
                    <dd className="col-sm-8">20.x</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Settings
