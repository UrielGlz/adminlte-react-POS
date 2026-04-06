import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import Swal from 'sweetalert2'
import { todayDateString } from '../../utils/dateHelpers'

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)

const EMPTY_FORM = {
  occurred_at: `${todayDateString()}T08:00`,
  customer_id: '',
  product_id: '',
  weigh_fee: '',
  driver_first_name: '',
  driver_last_name: '',
  driver_phone: '',
  vehicle_plates: '',
  license_number: '',
  license_state: '',
  tractor_number: '',
  trailer_number: '',
  driver_product_id: '',
  vehicle_type_id: '',
  product_description: '',
  eje1: '',
  eje2: '',
  eje3: '',
  payment_method_id: '',
  reference_number: ''
}

function ManualTicket() {
  const navigate = useNavigate()
  const [catalogs, setCatalogs] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => { loadCatalogs() }, [])

  const loadCatalogs = async () => {
    try {
      const res = await api.get('/sales/manual/catalogs')
      setCatalogs(res.data.data)
    } catch (e) {
      Swal.fire('Error', 'Could not load form catalogs', 'error')
    }
  }

  // ── derived values ──────────────────────────────────────────────────────────

  const selectedProduct = catalogs?.products?.find(
    (p) => String(p.product_id) === String(form.product_id)
  )

  const selectedMethod = catalogs?.paymentMethods?.find(
    (m) => String(m.method_id) === String(form.payment_method_id)
  )

  const isBusinessAccount = selectedMethod?.code === 'business_account'

  const selectedCustomer = catalogs?.customers?.find(
    (c) => String(c.customer_id) === String(form.customer_id)
  )

  const weigh = parseFloat(form.weigh_fee) || 0
  const taxPct = parseFloat(selectedProduct?.tax_percent) || 0
  const taxAmt = selectedProduct?.taxable ? weigh * (taxPct / 100) : 0
  const totalAmt = weigh + taxAmt

  const pesoTotal =
    (parseFloat(form.eje1) || 0) +
    (parseFloat(form.eje2) || 0) +
    (parseFloat(form.eje3) || 0)

  // ── form helpers ────────────────────────────────────────────────────────────

  const set = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleChange = (e) => set(e.target.name, e.target.value)

  // When product changes, pre-fill weigh_fee from default_price
  const handleProductChange = (e) => {
    const pid = e.target.value
    const prod = catalogs?.products?.find((p) => String(p.product_id) === pid)
    setForm((prev) => ({
      ...prev,
      product_id: pid,
      weigh_fee: prod?.default_price != null ? String(prod.default_price) : prev.weigh_fee
    }))
    setErrors((prev) => ({ ...prev, product_id: undefined, weigh_fee: undefined }))
  }

  // When payment method changes, clear business-account-only fields if no longer BA
  const handleMethodChange = (e) => {
    const mid = e.target.value
    const meth = catalogs?.paymentMethods?.find((m) => String(m.method_id) === mid)
    if (meth?.code !== 'business_account') {
      setForm((prev) => ({ ...prev, payment_method_id: mid }))
    } else {
      setForm((prev) => ({ ...prev, payment_method_id: mid }))
    }
    setErrors((prev) => ({ ...prev, payment_method_id: undefined, customer_id: undefined }))
  }

  // ── validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {}
    if (!form.occurred_at) e.occurred_at = 'Transaction date/time is required'
    else {
      const dt = new Date(form.occurred_at)
      if (isNaN(dt.getTime())) e.occurred_at = 'Invalid date/time'
      else if (dt > new Date()) e.occurred_at = 'Date cannot be in the future'
    }
    if (!form.product_id) e.product_id = 'Service/product is required'
    if (!form.weigh_fee && form.weigh_fee !== 0) e.weigh_fee = 'Service fee is required'
    else if (parseFloat(form.weigh_fee) < 0) e.weigh_fee = 'Fee cannot be negative'
    if (!form.driver_first_name.trim()) e.driver_first_name = 'Driver first name is required'
    if (!form.driver_last_name.trim()) e.driver_last_name = 'Driver last name is required'
    if (!form.vehicle_plates.trim()) e.vehicle_plates = 'Vehicle plates are required'
    if (!form.eje1 || parseFloat(form.eje1) <= 0) e.eje1 = 'Axle 1 weight is required'
    if (!form.eje2 || parseFloat(form.eje2) <= 0) e.eje2 = 'Axle 2 weight is required'
    if (!form.payment_method_id) e.payment_method_id = 'Payment method is required'
    if (isBusinessAccount && !form.customer_id) e.customer_id = 'Customer is required for business account'

    // Business account credit check
    if (isBusinessAccount && form.customer_id && selectedCustomer) {
      if (selectedCustomer.is_suspended) e.customer_id = 'This account is suspended'
      else if (selectedCustomer.available_credit != null && selectedCustomer.available_credit < totalAmt) {
        e.customer_id = `Insufficient credit. Available: ${formatCurrency(selectedCustomer.available_credit)}`
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    const confirm = await Swal.fire({
      title: 'Confirm Manual Ticket',
      html: `
        <div class="text-start">
          <p><strong>Date:</strong> ${form.occurred_at}</p>
          <p><strong>Driver:</strong> ${form.driver_first_name} ${form.driver_last_name}</p>
          <p><strong>Plates:</strong> ${form.vehicle_plates}</p>
          <p><strong>Total weight:</strong> ${pesoTotal.toLocaleString()} lbs</p>
          <p><strong>Total:</strong> ${formatCurrency(totalAmt)}</p>
          <p><strong>Payment:</strong> ${selectedMethod?.name || ''}</p>
          ${isBusinessAccount ? `<p><strong>Account:</strong> ${selectedCustomer?.account_name || ''}</p>` : ''}
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Create Ticket',
      cancelButtonText: 'Go Back',
      confirmButtonColor: '#0d6efd'
    })

    if (!confirm.isConfirmed) return

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        customer_id:       form.customer_id       ? Number(form.customer_id)       : null,
        product_id:        Number(form.product_id),
        driver_product_id: form.driver_product_id ? Number(form.driver_product_id) : null,
        vehicle_type_id:   form.vehicle_type_id   ? Number(form.vehicle_type_id)   : null,
        payment_method_id: Number(form.payment_method_id),
        vehicle_plates:    String(form.vehicle_plates).trim().toUpperCase(),
        weigh_fee:         parseFloat(form.weigh_fee),
        eje1:              parseFloat(form.eje1),
        eje2:              parseFloat(form.eje2),
        eje3:              form.eje3 ? parseFloat(form.eje3) : null
      }
      const res = await api.post('/sales/manual', payload)
      const result = res.data.data
      await Swal.fire({
        title: 'Ticket Created',
        html: `<p>Ticket <strong>#${result.ticket_number}</strong> created successfully.</p>
               <p>Total: <strong>${formatCurrency(result.total)}</strong></p>`,
        icon: 'success',
        confirmButtonText: 'View Ticket'
      })
      navigate(`/sales/${result.sale_id}`)
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not create ticket. Please try again.'
      Swal.fire('Error', msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────

  if (!catalogs) {
    return (
      <div className="container-fluid p-4 text-center py-5">
        <div className="spinner-border text-primary"></div>
        <p className="mt-2 text-muted">Loading form...</p>
      </div>
    )
  }

  return (
    <div className="container-fluid p-4">
      <div className="d-flex align-items-center mb-4">
        <button className="btn btn-outline-secondary btn-sm me-3" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left"></i>
        </button>
        <div>
          <h3 className="mb-0"><i className="bi bi-pencil-square me-2"></i>Manual Ticket Capture</h3>
          <p className="text-muted mb-0 small">Contingency entry — creates a real transaction in the system</p>
        </div>
        <span className="badge bg-warning text-dark ms-3 fs-6">WEB_MANUAL</span>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="row g-4">

          {/* ── Col Left ─────────────────────────────────────────────────── */}
          <div className="col-lg-8">

            {/* Transaction Info */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-primary text-white py-2">
                <i className="bi bi-calendar-event me-2"></i>Transaction
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Date &amp; Time <span className="text-danger">*</span></label>
                    <input
                      type="datetime-local"
                      className={`form-control ${errors.occurred_at ? 'is-invalid' : ''}`}
                      name="occurred_at"
                      value={form.occurred_at}
                      onChange={handleChange}
                    />
                    {errors.occurred_at && <div className="invalid-feedback">{errors.occurred_at}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Service / Product <span className="text-danger">*</span></label>
                    <select
                      className={`form-select ${errors.product_id ? 'is-invalid' : ''}`}
                      name="product_id"
                      value={form.product_id}
                      onChange={handleProductChange}
                    >
                      <option value="">-- Select product --</option>
                      {catalogs.products.map((p) => (
                        <option key={p.product_id} value={p.product_id}>{p.name}</option>
                      ))}
                    </select>
                    {errors.product_id && <div className="invalid-feedback">{errors.product_id}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Service Fee (pre-tax) <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={`form-control ${errors.weigh_fee ? 'is-invalid' : ''}`}
                        name="weigh_fee"
                        value={form.weigh_fee}
                        onChange={handleChange}
                        placeholder="0.00"
                      />
                      {errors.weigh_fee && <div className="invalid-feedback">{errors.weigh_fee}</div>}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Product Description</label>
                    <input
                      type="text"
                      className="form-control"
                      name="product_description"
                      value={form.product_description}
                      onChange={handleChange}
                      placeholder="Optional description for ticket"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Driver Info */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-secondary text-white py-2">
                <i className="bi bi-person-badge me-2"></i>Driver Information
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">First Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control ${errors.driver_first_name ? 'is-invalid' : ''}`}
                      name="driver_first_name"
                      value={form.driver_first_name}
                      onChange={handleChange}
                    />
                    {errors.driver_first_name && <div className="invalid-feedback">{errors.driver_first_name}</div>}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Last Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control ${errors.driver_last_name ? 'is-invalid' : ''}`}
                      name="driver_last_name"
                      value={form.driver_last_name}
                      onChange={handleChange}
                    />
                    {errors.driver_last_name && <div className="invalid-feedback">{errors.driver_last_name}</div>}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      name="driver_phone"
                      value={form.driver_phone}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">License #</label>
                    <input
                      type="text"
                      className="form-control"
                      name="license_number"
                      value={form.license_number}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">License State</label>
                    <select
                      className="form-select"
                      name="license_state"
                      value={form.license_state}
                      onChange={handleChange}
                    >
                      <option value="">-- State --</option>
                      {catalogs.licenseStates.map((s) => (
                        <option key={s.id_state} value={s.state_code}>
                          {s.state_code} — {s.state_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Driver Product</label>
                    <select
                      className="form-select"
                      name="driver_product_id"
                      value={form.driver_product_id}
                      onChange={handleChange}
                    >
                      <option value="">-- Product --</option>
                      {catalogs.driverProducts.map((dp) => (
                        <option key={dp.product_id} value={dp.product_id}>{dp.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-secondary text-white py-2">
                <i className="bi bi-truck me-2"></i>Vehicle Information
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Plates <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control text-uppercase ${errors.vehicle_plates ? 'is-invalid' : ''}`}
                      name="vehicle_plates"
                      value={form.vehicle_plates}
                      onChange={handleChange}
                    />
                    {errors.vehicle_plates && <div className="invalid-feedback">{errors.vehicle_plates}</div>}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Vehicle Type</label>
                    <select
                      className="form-select"
                      name="vehicle_type_id"
                      value={form.vehicle_type_id}
                      onChange={handleChange}
                    >
                      <option value="">-- Type --</option>
                      {catalogs.vehicleTypes.map((vt) => (
                        <option key={vt.vehicle_type_id} value={vt.vehicle_type_id}>{vt.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Tractor #</label>
                    <input
                      type="text"
                      className="form-control"
                      name="tractor_number"
                      value={form.tractor_number}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Trailer #</label>
                    <input
                      type="text"
                      className="form-control"
                      name="trailer_number"
                      value={form.trailer_number}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Axle Weights */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-dark text-white py-2">
                <i className="bi bi-speedometer me-2"></i>Axle Weights
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Axle 1 (lbs) <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className={`form-control ${errors.eje1 ? 'is-invalid' : ''}`}
                      name="eje1"
                      value={form.eje1}
                      onChange={handleChange}
                    />
                    {errors.eje1 && <div className="invalid-feedback">{errors.eje1}</div>}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Axle 2 (lbs) <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className={`form-control ${errors.eje2 ? 'is-invalid' : ''}`}
                      name="eje2"
                      value={form.eje2}
                      onChange={handleChange}
                    />
                    {errors.eje2 && <div className="invalid-feedback">{errors.eje2}</div>}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Axle 3 (lbs)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="form-control"
                      name="eje3"
                      value={form.eje3}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold text-success">Total Weight</label>
                    <input
                      type="text"
                      className="form-control bg-light fw-bold text-success"
                      value={pesoTotal > 0 ? `${pesoTotal.toLocaleString()} lbs` : '—'}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── Col Right ────────────────────────────────────────────────── */}
          <div className="col-lg-4">

            {/* Payment */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-success text-white py-2">
                <i className="bi bi-credit-card me-2"></i>Payment
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Payment Method <span className="text-danger">*</span></label>
                  <select
                    className={`form-select ${errors.payment_method_id ? 'is-invalid' : ''}`}
                    name="payment_method_id"
                    value={form.payment_method_id}
                    onChange={handleMethodChange}
                  >
                    <option value="">-- Select --</option>
                    {catalogs.paymentMethods.map((m) => (
                      <option key={m.method_id} value={m.method_id}>{m.name}</option>
                    ))}
                  </select>
                  {errors.payment_method_id && <div className="invalid-feedback">{errors.payment_method_id}</div>}
                </div>

                {selectedMethod?.allow_reference && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Reference #</label>
                    <input
                      type="text"
                      className="form-control"
                      name="reference_number"
                      value={form.reference_number}
                      onChange={handleChange}
                      placeholder="Check / card ref"
                    />
                  </div>
                )}

                {isBusinessAccount && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Customer Account <span className="text-danger">*</span></label>
                    <select
                      className={`form-select ${errors.customer_id ? 'is-invalid' : ''}`}
                      name="customer_id"
                      value={form.customer_id}
                      onChange={handleChange}
                    >
                      <option value="">-- Select account --</option>
                      {catalogs.customers.filter((c) => c.has_credit).map((c) => (
                        <option key={c.customer_id} value={c.customer_id}>
                          {c.account_number} — {c.account_name}
                        </option>
                      ))}
                    </select>
                    {errors.customer_id && <div className="invalid-feedback">{errors.customer_id}</div>}
                    {selectedCustomer && (
                      <div className={`mt-2 p-2 rounded small ${selectedCustomer.is_suspended ? 'bg-danger text-white' : 'bg-light'}`}>
                        <div><strong>Type:</strong> {selectedCustomer.credit_type}</div>
                        <div><strong>Available:</strong> {formatCurrency(selectedCustomer.available_credit)}</div>
                        <div><strong>Limit:</strong> {formatCurrency(selectedCustomer.credit_limit)}</div>
                        {selectedCustomer.is_suspended && <div className="fw-bold mt-1">ACCOUNT SUSPENDED</div>}
                      </div>
                    )}
                  </div>
                )}

                {!isBusinessAccount && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Customer (optional)</label>
                    <select
                      className="form-select"
                      name="customer_id"
                      value={form.customer_id}
                      onChange={handleChange}
                    >
                      <option value="">-- No customer --</option>
                      {catalogs.customers.map((c) => (
                        <option key={c.customer_id} value={c.customer_id}>
                          {c.account_number} — {c.account_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Price Summary */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-info text-white py-2">
                <i className="bi bi-calculator me-2"></i>Price Summary
              </div>
              <div className="card-body">
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr>
                      <td>Subtotal</td>
                      <td className="text-end">{formatCurrency(weigh)}</td>
                    </tr>
                    {selectedProduct?.taxable ? (
                      <tr>
                        <td>Tax ({taxPct}%)</td>
                        <td className="text-end">{formatCurrency(taxAmt)}</td>
                      </tr>
                    ) : (
                      <tr className="text-muted">
                        <td><small>Tax (exempt)</small></td>
                        <td className="text-end"><small>$0.00</small></td>
                      </tr>
                    )}
                    <tr className="table-success fw-bold">
                      <td>Total</td>
                      <td className="text-end fs-5">{formatCurrency(totalAmt)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="d-grid gap-2">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={submitting}
              >
                {submitting
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating...</>
                  : <><i className="bi bi-check-circle me-2"></i>Create Ticket</>
                }
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={submitting}
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  )
}

export default ManualTicket
