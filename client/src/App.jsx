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
import StatusCatalog from './pages/catalogs/StatusCatalog'
import StatusCatalogForm from './pages/catalogs/StatusCatalogForm'
import PaymentMethods from './pages/catalogs/PaymentMethods'
import PaymentMethodForm from './pages/catalogs/PaymentMethodForm'
import Products from './pages/catalogs/Products'
import ProductForm from './pages/catalogs/ProductForm'

import VehicleTypes from './pages/catalogs/VehicleTypes'
import VehicleTypeForm from './pages/catalogs/VehicleTypeForm'
import Customers from './pages/customers/Customers'
import CustomerForm from './pages/customers/CustomerForm'
import Sales from './pages/sales/Sales'
import SaleDetail from './pages/sales/SaleDetail'
import LicenseStates from './pages/catalogs/LicenseStates'
import LicenseStateForm from './pages/catalogs/LicenseStateForm'
import DriverProducts from './pages/catalogs/DriverProducts'
import DriverProductForm from './pages/catalogs/DriverProductForm'
import SaleDriverInfo from './pages/catalogs/SaleDriverInfo'


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

          <Route path="catalogs/status" element={<StatusCatalog />} />
          <Route path="catalogs/status/new" element={<StatusCatalogForm />} />
          <Route path="catalogs/status/:id" element={<StatusCatalogForm />} />
          <Route path="catalogs/payment-methods" element={<PaymentMethods />} />
          <Route path="catalogs/payment-methods/new" element={<PaymentMethodForm />} />
          <Route path="catalogs/payment-methods/:id" element={<PaymentMethodForm />} />
          <Route path="catalogs/products" element={<Products />} />
          <Route path="catalogs/products/new" element={<ProductForm />} />
          <Route path="catalogs/products/:id" element={<ProductForm />} />

          <Route path="catalogs/vehicle-types" element={<VehicleTypes />} />
          <Route path="catalogs/vehicle-types/new" element={<VehicleTypeForm />} />
          <Route path="catalogs/vehicle-types/:id" element={<VehicleTypeForm />} />
          <Route path="/catalogs/license-states" element={<LicenseStates />} />
          <Route path="/catalogs/license-states/new" element={<LicenseStateForm />} />
          <Route path="/catalogs/license-states/:id" element={<LicenseStateForm />} />
          <Route path="/catalogs/driver-products" element={<DriverProducts />} />
          <Route path="/catalogs/driver-products/new" element={<DriverProductForm />} />
          <Route path="/catalogs/driver-products/:id" element={<DriverProductForm />} />
          <Route path="/catalogs/sale-driver-info" element={<SaleDriverInfo />} />

          <Route path="customers" element={<Customers />} />
          <Route path="customers/new" element={<CustomerForm />} />
          <Route path="customers/:id" element={<CustomerForm />} />

          <Route path="sales" element={<Sales />} />
          <Route path="sales/:id" element={<SaleDetail />} />


        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App