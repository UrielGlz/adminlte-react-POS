import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UsersComplete from './pages/UsersComplete'
import Settings from './pages/Settings'
import Roles from './pages/settings/Roles'
import RoleForm from './pages/settings/RoleForm'
import Navigation from './pages/settings/Navigation'
import NavigationForm from './pages/settings/NavigationForm'
import Permissions from './pages/settings/Permissions'
import PermissionForm from './pages/settings/PermissionForm'
function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Ruta pública */}
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas */}
        <Route path="/" element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={<UsersComplete />} />
          <Route path="users-crud" element={<UsersComplete />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/general" element={<Settings />} />

          {/* Roles */}
          <Route path="settings/roles" element={<Roles />} />
          <Route path="settings/roles/new" element={<RoleForm />} />
          <Route path="settings/roles/:id" element={<RoleForm />} />

          {/* Navigation */}
          <Route path="settings/navigation" element={<Navigation />} />
          <Route path="settings/navigation/new" element={<NavigationForm />} />
          <Route path="settings/navigation/:id" element={<NavigationForm />} />

          {/* Permissions */}
          <Route path="settings/permissions" element={<Permissions />} />
          <Route path="settings/permissions/new" element={<PermissionForm />} />
          <Route path="settings/permissions/:id" element={<PermissionForm />} />
          

          <Route path="reports/sales" element={<div className="p-4">Sales - Coming soon</div>} />
          <Route path="reports/accounting" element={<div className="p-4">Accounting - Coming soon</div>} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App