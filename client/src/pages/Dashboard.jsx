import { useState, useEffect } from 'react'
import StatCard from '../components/StatCard'
import api from '../services/api'

function Dashboard() {
  const [stats, setStats] = useState({
    orders: 0,
    users: 0,
    sales: 0,
    visitors: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await api.get('/stats')
      console.log(response.data);
      setStats(response.data.data)
    } catch (error) {
      console.error('Error loading stats:', error)
      // Datos de ejemplo si falla la API
      setStats({ orders: 150, users: 53, sales: 44, visitors: 65 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Content Header */}
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h3 className="mb-0">Dashboard</h3>
            </div>
            <div className="col-sm-6">
              <ol className="breadcrumb float-sm-end">
                <li className="breadcrumb-item"><a href="#">Home</a></li>
                <li className="breadcrumb-item active">Dashboard</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="app-content">
        <div className="container-fluid">
          
          {/* Stat Cards Row */}
          <div className="row">
            <div className="col-lg-3 col-6">
              <StatCard 
                title="Nuevas Órdenes" 
                value={loading ? '...' : stats.orders}
                icon="bi-cart-fill"
                color="primary"
              />
            </div>
            <div className="col-lg-3 col-6">
              <StatCard 
                title="Bounce Rate" 
                value={loading ? '...' : `${stats.users}%`}
                icon="bi-graph-down-arrow"
                color="success"
              />
            </div>
            <div className="col-lg-3 col-6">
              <StatCard 
                title="Registros" 
                value={loading ? '...' : stats.sales}
                icon="bi-person-plus-fill"
                color="warning"
              />
            </div>
            <div className="col-lg-3 col-6">
              <StatCard 
                title="Visitantes Únicos" 
                value={loading ? '...' : stats.visitors}
                icon="bi-eye-fill"
                color="danger"
              />
            </div>
          </div>

          {/* Cards Row */}
          <div className="row">
            {/* Sales Chart Card */}
            <div className="col-lg-8">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Ventas Mensuales</h3>
                  <div className="card-tools">
                    <button type="button" className="btn btn-tool" data-lte-toggle="card-collapse">
                      <i className="bi bi-dash-lg"></i>
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="chart-container" style={{ height: '300px' }}>
                    <p className="text-muted text-center pt-5">
                      <i className="bi bi-bar-chart-fill" style={{ fontSize: '48px' }}></i>
                      <br />
                      Aquí iría tu gráfica de ventas
                      <br />
                      <small>Integrar con Chart.js o Recharts</small>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="col-lg-4">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Actividad Reciente</h3>
                </div>
                <div className="card-body p-0">
                  <ul className="list-group list-group-flush">
                    <li className="list-group-item">
                      <i className="bi bi-check-circle-fill text-success me-2"></i>
                      Orden #1234 completada
                      <span className="float-end text-muted">hace 2 min</span>
                    </li>
                    <li className="list-group-item">
                      <i className="bi bi-person-fill text-primary me-2"></i>
                      Nuevo usuario registrado
                      <span className="float-end text-muted">hace 15 min</span>
                    </li>
                    <li className="list-group-item">
                      <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                      Stock bajo en producto
                      <span className="float-end text-muted">hace 1 hora</span>
                    </li>
                    <li className="list-group-item">
                      <i className="bi bi-cash-stack text-success me-2"></i>
                      Pago recibido $500
                      <span className="float-end text-muted">hace 2 horas</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Table Example */}
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Últimas Órdenes</h3>
                </div>
                <div className="card-body table-responsive p-0">
                  <table className="table table-hover text-nowrap">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Cliente</th>
                        <th>Producto</th>
                        <th>Monto</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>#1001</td>
                        <td>Juan Pérez</td>
                        <td>Laptop HP</td>
                        <td>$15,000</td>
                        <td><span className="badge text-bg-success">Completado</span></td>
                      </tr>
                      <tr>
                        <td>#1002</td>
                        <td>María García</td>
                        <td>Monitor Dell</td>
                        <td>$5,500</td>
                        <td><span className="badge text-bg-warning">Pendiente</span></td>
                      </tr>
                      <tr>
                        <td>#1003</td>
                        <td>Carlos López</td>
                        <td>Teclado Mecánico</td>
                        <td>$2,300</td>
                        <td><span className="badge text-bg-primary">Enviado</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

export default Dashboard
