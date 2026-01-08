import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Footer from '../components/Footer'

function AdminLayout() {
  useEffect(() => {
    // Layout correcto para mini sidebar (cuando se colapse)
    document.body.classList.add('sidebar-mini', 'sidebar-expand-lg', 'layout-fixed')

    // ✅ Estado inicial: FIJO (expandido) si no hay preferencia
    const collapsed = localStorage.getItem('sidebarCollapsed') === '1'
    document.body.classList.toggle('sidebar-collapse', collapsed)

    // Cargar AdminLTE JS una sola vez
    const existing = document.getElementById('adminlte-js')
    if (!existing) {
      const script = document.createElement('script')
      script.id = 'adminlte-js'
      script.src = 'https://cdn.jsdelivr.net/npm/admin-lte@4.0.0-beta3/dist/js/adminlte.min.js'
      script.async = true
      document.body.appendChild(script)
    }

    return () => {
      document.body.classList.remove(
        'sidebar-collapse',
        'sidebar-open',
        'sidebar-mini',
        'sidebar-expand-lg',
        'layout-fixed'
      )
    }
  }, [])

  return (
    <div className="app-wrapper">
      <Header />
      <Sidebar />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default AdminLayout
