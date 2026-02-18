import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'

function PaymentDetail() {
  const { id } = useParams()
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPaymentDetail()
  }, [id])

  const fetchPaymentDetail = async () => {
    try {
      const response = await api.get(`/ar/payments/${id}`)
      setPayment(response.data.data)
      console.log(response.data.data);
    } catch (error) {
      console.error('Error fetching payment detail:', error)
      Swal.fire('Error', 'Could not load payment details', 'error')
    } finally {
      setLoading(false)
    }
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



  const formatDateTime = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('en-US')
  }

  if (loading) {
    return (
      <div className="container-fluid text-center py-5">
        <div className="spinner-border text-primary"></div>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="container-fluid">
        <div className="alert alert-danger">Payment not found</div>
        <Link to="/ar/all-payments" className="btn btn-primary">Back to History</Link>
      </div>
    )
  }

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h3 mb-0">
                <i className="bi bi-receipt me-2"></i>
                Payment Detail #{payment.ar_payment_id}
              </h1>
              <p className="text-muted mb-0">A/R Payment Record</p>
            </div>
            <Link to="/ar/all-payments" className="btn btn-outline-primary">
              <i className="bi bi-arrow-left me-1"></i>
              Back to History
            </Link>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Payment Info */}
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header">
              <i className="bi bi-info-circle me-2"></i>
              Payment Information
            </div>
            <div className="card-body">
              <table className="table table-borderless mb-0">
                <tbody>
                  <tr>
                    <td className="text-muted" style={{ width: '40%' }}>Customer:</td>
                    <td><strong>{payment.account_name}</strong> ({payment.account_number})</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Payment Date:</td>
                    <td>{formatDate(payment.payment_date)}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Payment Method:</td>
                    <td>{payment.payment_method}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Reference:</td>
                    <td>{payment.reference_number || '-'}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Apply Method:</td>
                    <td>
                      <span className={`badge ${payment.apply_method === 'FIFO' ? 'bg-info' : 'bg-secondary'}`}>
                        {payment.apply_method}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted">Status:</td>
                    <td>
                      <span className={`badge ${payment.status === 'APPLIED' ? 'bg-success' : payment.status === 'VOIDED' ? 'bg-danger' : 'bg-warning'}`}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted">Created By:</td>
                    <td>{payment.created_by || '-'}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Created At:</td>
                    <td>{formatDateTime(payment.created_at)}</td>
                  </tr>
                  {payment.notes && (
                    <tr>
                      <td className="text-muted">Notes:</td>
                      <td>{payment.notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Amount Summary */}
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header">
              <i className="bi bi-currency-dollar me-2"></i>
              Amount Summary
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col">
                  <h6 className="text-muted">Received</h6>
                  <h3 className="text-primary">{formatCurrency(payment.amount_received)}</h3>
                </div>
                <div className="col">
                  <h6 className="text-muted">Applied</h6>
                  <h3 className="text-success">{formatCurrency(payment.amount_applied)}</h3>
                </div>
                <div className="col">
                  <h6 className="text-muted">Unapplied</h6>
                  <h3 className={parseFloat(payment.amount_unapplied) > 0 ? 'text-warning' : 'text-muted'}>
                    {formatCurrency(payment.amount_unapplied)}
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Allocations */}
      <div className="card">
        <div className="card-header">
          <i className="bi bi-list-check me-2"></i>
          Applied to Transactions ({payment.allocations?.length || 0})
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Ticket #</th>
                <th>Date</th>
                <th>Scale Op</th>
                <th>Driver</th>

                <th className="text-end">Amount Applied</th>
                <th>Applied At</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations?.map((a, index) => (
                <tr key={a.allocation_id}>
                  <td>{index + 1}</td>
                  <td><strong>{a.ticket_number || a.sale_uid}</strong></td>

                  <td>{formatDateTime(a.printed_at)}</td>

                  <td>{a.operator_user}</td>
                  <td>{a.driver_name}</td>


                  <td className="text-end text-success">{formatCurrency(a.amount_applied)}</td>
                  <td>{formatDateTime(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-light">
              <tr>
                <th></th>
                <th></th>
                <th></th>


                <th colSpan="2">Total Applied</th>
                <th className="text-end text-success">{formatCurrency(payment.amount_applied)}</th>
                <th></th>
                <th></th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PaymentDetail