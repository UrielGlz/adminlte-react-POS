import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState({})

  const isAdmin = ['SUPERADMIN', 'ADMINISTRATOR', 'ACCOUNTING'].includes(user?.role_code)

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      const response = await api.get('/dashboard')
      setData(response.data.data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)
  const formatNumber = (val) => new Intl.NumberFormat('en-US').format(val || 0)

  const COLORS = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#20c997']

  if (loading) {
    return (
      <div className="container-fluid p-4 text-center">
        <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
        <p className="mt-3 text-muted">Loading dashboard...</p>
      </div>
    )
  }

  const today = data?.today || {}
  const month = data?.month || {}
  const comparison = data?.comparison || {}

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1"><i className="bi bi-speedometer2 me-2"></i>Dashboard</h3>
          <p className="text-muted mb-0">Welcome back, {user?.full_name || 'User'}</p>
        </div>
        <button className="btn btn-outline-primary" onClick={fetchDashboard}>
          <i className="bi bi-arrow-clockwise me-2"></i>Refresh
        </button>
      </div>

      {/* ============ SECTION: TODAY's KPIs ============ */}
      <div className="card shadow-sm mb-4">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ cursor: 'pointer' }} onClick={() => toggleSection('today')}>
          <h5 className="mb-0"><i className="bi bi-calendar-check me-2"></i>Today's Summary</h5>
          <i className={`bi bi-chevron-${collapsed.today ? 'down' : 'up'}`}></i>
        </div>
        {!collapsed.today && (
          <div className="card-body">
            <div className="row g-3">
              {/* Total Sales */}
              <div className="col-md-3">
                <div className="card bg-primary text-white h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <div>
                        <h6 className="text-white-50 mb-1">Total Sales</h6>
                        <h3 className="mb-0">{formatCurrency(today.total_sales)}</h3>
                      </div>
                      <i className="bi bi-cash-stack" style={{ fontSize: '2.5rem', opacity: 0.5 }}></i>
                    </div>
                  </div>
                  <div className="card-footer bg-primary border-top border-light border-opacity-25 py-2">
                    <small>{today.completed_count || 0} completed transactions</small>
                  </div>
                </div>
              </div>

              {/* Transactions */}
              <div className="col-md-3">
                <div className="card bg-success text-white h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <div>
                        <h6 className="text-white-50 mb-1">Transactions</h6>
                        <h3 className="mb-0">{formatNumber(today.total_transactions)}</h3>
                      </div>
                      <i className="bi bi-receipt" style={{ fontSize: '2.5rem', opacity: 0.5 }}></i>
                    </div>
                  </div>
                  <div className="card-footer bg-success border-top border-light border-opacity-25 py-2">
                    <small>Avg ticket: {formatCurrency(today.avg_ticket)}</small>
                  </div>
                </div>
              </div>

              {/* Weighs vs Re-weighs */}
              <div className="col-md-3">
                <div className="card bg-info text-white h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <div>
                        <h6 className="text-white-50 mb-1">Weighs / Re-weighs</h6>
                        <h3 className="mb-0">{today.weigh_count || 0} / {today.reweigh_count || 0}</h3>
                      </div>
                      <i className="bi bi-arrow-repeat" style={{ fontSize: '2.5rem', opacity: 0.5 }}></i>
                    </div>
                  </div>
                  <div className="card-footer bg-info border-top border-light border-opacity-25 py-2">
                    <small>{today.reweigh_count > 0 ? ((today.reweigh_count / today.total_transactions) * 100).toFixed(1) : 0}% re-weighs</small>
                  </div>
                </div>
              </div>

              {/* Cancelled */}
              <div className="col-md-3">
                <div className="card bg-danger text-white h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <div>
                        <h6 className="text-white-50 mb-1">Cancelled</h6>
                        <h3 className="mb-0">{today.cancelled_count || 0}</h3>
                      </div>
                      <i className="bi bi-x-circle" style={{ fontSize: '2.5rem', opacity: 0.5 }}></i>
                    </div>
                  </div>
                  <div className="card-footer bg-danger border-top border-light border-opacity-25 py-2">
                    <small>{today.total_transactions > 0 ? ((today.cancelled_count / today.total_transactions) * 100).toFixed(1) : 0}% cancel rate</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ SECTION: CHARTS ROW ============ */}
      <div className="row mb-4">
        {/* Hourly Sales */}
        <div className="col-lg-8">
          <div className="card shadow-sm h-100">
            <div className="card-header d-flex justify-content-between align-items-center" style={{ cursor: 'pointer' }} onClick={() => toggleSection('hourly')}>
              <h5 className="mb-0"><i className="bi bi-clock me-2"></i>Sales by Hour (Today)</h5>
              <i className={`bi bi-chevron-${collapsed.hourly ? 'down' : 'up'}`}></i>
            </div>
            {!collapsed.hourly && (
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data?.salesByHour || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" orientation="left" stroke="#0d6efd" />
                    <YAxis yAxisId="right" orientation="right" stroke="#198754" />
                    <Tooltip formatter={(value, name) => name === 'total_sales' ? formatCurrency(value) : value} />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="transactions" name="Transactions" stroke="#0d6efd" fill="#0d6efd" fillOpacity={0.3} />
                    <Area yAxisId="right" type="monotone" dataKey="total_sales" name="Sales ($)" stroke="#198754" fill="#198754" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Sales by Category (Pie) */}
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-header d-flex justify-content-between align-items-center" style={{ cursor: 'pointer' }} onClick={() => toggleSection('category')}>
              <h5 className="mb-0"><i className="bi bi-pie-chart me-2"></i>By Category</h5>
              <i className={`bi bi-chevron-${collapsed.category ? 'down' : 'up'}`}></i>
            </div>
            {!collapsed.category && (
              <div className="card-body">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data?.salesByCategory || []}
                      dataKey="total_amount"
                      nameKey="category_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ category_name, percent }) => `${category_name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {(data?.salesByCategory || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3">
                  {(data?.salesByCategory || []).map((cat, idx) => (
                    <div key={cat.category} className="d-flex justify-content-between mb-1">
                      <span><i className="bi bi-circle-fill me-2" style={{ color: COLORS[idx] }}></i>{cat.category_name}</span>
                      <span className="fw-bold">{formatCurrency(cat.total_amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ SECTION: TREND ============ */}
      <div className="card shadow-sm mb-4">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ cursor: 'pointer' }} onClick={() => toggleSection('trend')}>
          <h5 className="mb-0"><i className="bi bi-graph-up me-2"></i>Sales Trend (Last 7 Days)</h5>
          <div className="d-flex align-items-center">
            {comparison.week_change !== 0 && (
              <span className={`badge me-2 ${parseFloat(comparison.week_change) >= 0 ? 'bg-success' : 'bg-danger'}`}>
                {parseFloat(comparison.week_change) >= 0 ? '↑' : '↓'} {Math.abs(comparison.week_change)}% vs last week
              </span>
            )}
            <i className={`bi bi-chevron-${collapsed.trend ? 'down' : 'up'}`}></i>
          </div>
        </div>
        {!collapsed.trend && (
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.salesTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" orientation="left" stroke="#0d6efd" />
                <YAxis yAxisId="right" orientation="right" stroke="#198754" />
                <Tooltip formatter={(value, name) => name === 'total_sales' ? formatCurrency(value) : value} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="transactions" name="Transactions" stroke="#0d6efd" strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="total_sales" name="Sales ($)" stroke="#198754" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ============ ADMIN ONLY SECTIONS ============ */}
      {isAdmin && (
        <>
          {/* Row: Payment Methods + Top Customers */}
          <div className="row mb-4">
            {/* Payment Methods */}
            <div className="col-lg-6">
              <div className="card shadow-sm h-100">
                <div className="card-header d-flex justify-content-between align-items-center" style={{ cursor: 'pointer' }} onClick={() => toggleSection('payments')}>
                  <h5 className="mb-0"><i className="bi bi-credit-card me-2"></i>Payment Methods</h5>
                  <i className={`bi bi-chevron-${collapsed.payments ? 'down' : 'up'}`}></i>
                </div>
                {!collapsed.payments && (
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data?.paymentMethods || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                        <YAxis type="category" dataKey="method_name" width={100} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="total_amount" fill="#0d6efd" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <hr />
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Method</th>
                          <th className="text-center">Qty</th>
                          <th className="text-end">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.paymentMethods || []).map(pm => (
                          <tr key={pm.code}>
                            <td>{pm.method_name}</td>
                            <td className="text-center">{pm.quantity}</td>
                            <td className="text-end fw-bold">{formatCurrency(pm.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Top Customers */}
            <div className="col-lg-6">
              <div className="card shadow-sm h-100">
                <div className="card-header d-flex justify-content-between align-items-center" style={{ cursor: 'pointer' }} onClick={() => toggleSection('customers')}>
                  <h5 className="mb-0"><i className="bi bi-people me-2"></i>Top Customers (This Month)</h5>
                  <i className={`bi bi-chevron-${collapsed.customers ? 'down' : 'up'}`}></i>
                </div>
                {!collapsed.customers && (
                  <div className="card-body p-0">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Customer</th>
                          <th className="text-center">Transactions</th>
                          <th className="text-end">Total Spent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.topCustomers || []).map((c, idx) => (
                          <tr key={c.account_number}>
                            <td><span className="badge bg-primary">{idx + 1}</span></td>
                            <td>
                              <div className="fw-bold">{c.account_name}</div>
                              <small className="text-muted">{c.account_number}</small>
                            </td>
                            <td className="text-center">{c.transaction_count}</td>
                            <td className="text-end fw-bold text-success">{formatCurrency(c.total_spent)}</td>
                          </tr>
                        ))}
                        {(data?.topCustomers || []).length === 0 && (
                          <tr><td colSpan="4" className="text-center text-muted py-3">No data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row: Credit Summary + Operator Stats */}
          <div className="row mb-4">
            {/* Credit Summary */}
            <div className="col-lg-6">
              <div className="card shadow-sm h-100">
                <div className="card-header d-flex justify-content-between align-items-center" style={{ cursor: 'pointer' }} onClick={() => toggleSection('credit')}>
                  <h5 className="mb-0"><i className="bi bi-bank me-2"></i>Credit Summary</h5>
                  <i className={`bi bi-chevron-${collapsed.credit ? 'down' : 'up'}`}></i>
                </div>
                {!collapsed.credit && (
                  <div className="card-body">
                    <div className="row g-3 mb-4">
                      <div className="col-6">
                        <div className="border rounded p-3 text-center">
                          <h4 className="text-primary mb-0">{formatCurrency(data?.creditSummary?.total_credit_limit)}</h4>
                          <small className="text-muted">Total Credit Limit</small>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="border rounded p-3 text-center">
                          <h4 className="text-danger mb-0">{formatCurrency(data?.creditSummary?.total_balance_due)}</h4>
                          <small className="text-muted">Outstanding Balance</small>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="border rounded p-3 text-center">
                          <h4 className="text-success mb-0">{formatCurrency(data?.creditSummary?.total_available)}</h4>
                          <small className="text-muted">Available Credit</small>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="border rounded p-3 text-center">
                          <h4 className="text-warning mb-0">{data?.creditSummary?.suspended_accounts || 0}</h4>
                          <small className="text-muted">Suspended Accounts</small>
                        </div>
                      </div>
                    </div>

                    <h6>Top Credit Usage</h6>
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th className="text-end">Balance</th>
                          <th className="text-end">Limit</th>
                          <th className="text-end">Usage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.topCreditUsage || []).map(c => (
                          <tr key={c.account_number}>
                            <td>{c.account_name}</td>
                            <td className="text-end">{formatCurrency(c.current_balance)}</td>
                            <td className="text-end">{formatCurrency(c.credit_limit)}</td>
                            <td className="text-end">
                              <div className="progress" style={{ height: '20px' }}>
                                <div 
                                  className={`progress-bar ${c.usage_percent > 80 ? 'bg-danger' : c.usage_percent > 50 ? 'bg-warning' : 'bg-success'}`}
                                  style={{ width: `${c.usage_percent}%` }}
                                >
                                  {c.usage_percent}%
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Operator Stats */}
            <div className="col-lg-6">
              <div className="card shadow-sm h-100">
                <div className="card-header d-flex justify-content-between align-items-center" style={{ cursor: 'pointer' }} onClick={() => toggleSection('operators')}>
                  <h5 className="mb-0"><i className="bi bi-person-badge me-2"></i>Operator Performance (Today)</h5>
                  <i className={`bi bi-chevron-${collapsed.operators ? 'down' : 'up'}`}></i>
                </div>
                {!collapsed.operators && (
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data?.operatorStats || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="operator_name" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip formatter={(value, name) => name === 'total_sales' ? formatCurrency(value) : value} />
                        <Legend />
                        <Bar dataKey="transaction_count" name="Transactions" fill="#0d6efd" />
                        <Bar dataKey="total_sales" name="Sales" fill="#198754" />
                      </BarChart>
                    </ResponsiveContainer>
                    <hr />
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Operator</th>
                          <th className="text-center">Transactions</th>
                          <th className="text-end">Total Sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.operatorStats || []).map(op => (
                          <tr key={op.user_id}>
                            <td>{op.operator_name}</td>
                            <td className="text-center">{op.transaction_count}</td>
                            <td className="text-end fw-bold">{formatCurrency(op.total_sales)}</td>
                          </tr>
                        ))}
                        {(data?.operatorStats || []).length === 0 && (
                          <tr><td colSpan="3" className="text-center text-muted py-3">No activity today</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ============ QUICK LINKS ============ */}
      <div className="card shadow-sm">
        <div className="card-header">
          <h5 className="mb-0"><i className="bi bi-lightning me-2"></i>Quick Actions</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <Link to="/sales" className="btn btn-outline-primary w-100 py-3">
                <i className="bi bi-receipt d-block" style={{ fontSize: '2rem' }}></i>
                Daily Operations
              </Link>
            </div>
            <div className="col-md-3">
              <Link to="/customers" className="btn btn-outline-success w-100 py-3">
                <i className="bi bi-people d-block" style={{ fontSize: '2rem' }}></i>
                Customers
              </Link>
            </div>
            <div className="col-md-3">
              <Link to="/catalogs/products" className="btn btn-outline-warning w-100 py-3">
                <i className="bi bi-box-seam d-block" style={{ fontSize: '2rem' }}></i>
                Products
              </Link>
            </div>
            <div className="col-md-3">
              <Link to="/settings/roles" className="btn btn-outline-secondary w-100 py-3">
                <i className="bi bi-gear d-block" style={{ fontSize: '2rem' }}></i>
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard