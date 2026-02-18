import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function PaymentHistory() {
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/ar/customers')
      setCustomers(response.data.data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchHistory = async (customerId) => {
    if (!customerId) {
      setHistory([])
      return
    }

    setLoading(true)
    try {
      const response = await api.get(`/ar/customers/${customerId}/history`)
      setHistory(response.data.data || [])
    } catch (error) {
      console.error('Error fetching history:', error)
      Swal.fire('Error', 'Could not load payment history', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerChange = (e) => {
    const customerId = e.target.value
    setSelectedCustomerId(customerId)
    fetchHistory(customerId)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
  }

  // const formatDate = (date) => {
  //   if (!date) return '-'
  //   return new Date(date).toLocaleDateString('en-US')
  // }
  const formatDate = (date) => {
    if (!date) return '-'

    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',        // respeta la hora del ...Z
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date))
  }



  const getStatusBadge = (status) => {
    const badges = {
      'APPLIED': 'bg-success',
      'PARTIAL': 'bg-warning text-dark',
      'VOIDED': 'bg-danger'
    }
    return badges[status] || 'bg-secondary'
  }

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h3 mb-0">
                <i className="bi bi-clock-history me-2"></i>
                Payment History
              </h1>
              <p className="text-muted mb-0">View A/R payment history by customer</p>
            </div>
            <Link to="/ar" className="btn btn-outline-primary">
              <i className="bi bi-arrow-left me-1"></i>
              Back to A/R
            </Link>
          </div>
        </div>
      </div>

      {/* Customer Selector */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <label className="form-label">Select Customer</label>
              <select
                className="form-select"
                value={selectedCustomerId}
                onChange={handleCustomerChange}
              >
                <option value="">-- Select a customer --</option>
                {customers.map(c => (
                  <option key={c.id_customer} value={c.id_customer}>
                    {c.account_number} - {c.account_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      ) : selectedCustomerId && history.length > 0 ? (
        <div className="card">
          <div className="card-header">
            <i className="bi bi-list me-2"></i>
            Payment History ({history.length} records)
          </div>
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th className="text-end">Received</th>
                  <th className="text-end">Applied</th>
                  <th className="text-end">Unapplied</th>
                  <th className="text-center">Mode</th>
                  <th className="text-center">Status</th>
                  <th>Created By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.ar_payment_id}>
                    <td>{h.ar_payment_id}</td>
                    <td>{formatDate(h.payment_date)}</td>
                    <td>{h.payment_method}</td>
                    <td>{h.reference_number || '-'}</td>
                    <td className="text-end">{formatCurrency(h.amount_received)}</td>
                    <td className="text-end text-success">{formatCurrency(h.amount_applied)}</td>
                    <td className="text-end">
                      {parseFloat(h.amount_unapplied) > 0
                        ? <span className="text-warning">{formatCurrency(h.amount_unapplied)}</span>
                        : '-'}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${h.apply_method === 'FIFO' ? 'bg-info' : 'bg-secondary'}`}>
                        {h.apply_method}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`badge ${getStatusBadge(h.status)}`}>
                        {h.status}
                      </span>
                    </td>
                    <td>{h.created_by || '-'}</td>
                    <td>
                      <Link
                        to={`/ar/payments/${h.ar_payment_id}`}
                        className="btn btn-sm btn-outline-primary"
                      >
                        <i className="bi bi-eye"></i>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedCustomerId ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          No payment history found for this customer.
        </div>
      ) : (
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="bi bi-search display-1 text-muted"></i>
            <h4 className="mt-3 text-muted">Select a Customer</h4>
            <p className="text-muted">Choose a customer to view their payment history.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentHistory