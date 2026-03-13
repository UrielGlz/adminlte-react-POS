import { query } from '../../../config/database.js'
import { getReportSettings } from '../reports.service.js'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import QRCode from 'qrcode'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Customer Statement Report Service
 */

const PT_PER_INCH = 72
const TICKET_W = 9.5 * PT_PER_INCH   // 684

const TICKET_H = 7.0 * PT_PER_INCH   // 468  (más alto)

const asBool = (v) => String(v || '0') === '1' || String(v || '').toLowerCase() === 'true'

const getLogoPath = (logoFilename) => {
  if (!logoFilename) return null
  const logoPath = path.join(__dirname, '../../../assets/images', logoFilename)
  if (fs.existsSync(logoPath)) return logoPath
  const defaultLogo = path.join(__dirname, '../../../assets/images/default-logo.png')
  if (fs.existsSync(defaultLogo)) return defaultLogo
  return null
}

const truthy = (v) => {
  const s = (v ?? '').toString().trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y'
}

const toInt0 = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

const formatTicketDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'America/Matamoros',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  })
}

const formatTicketTime = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleTimeString('en-US', {
    timeZone: 'America/Matamoros',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

const ticketHeaderLines = [
  'McAllen Foreign Trade Zone',
  'Certified Public Truck Scale',
  '6401 S. 33rd Street · McAllen, Texas 78503',
  '(956) 682-4306 · (956) 882-9111 Fax',
  'Certificate No. 036231',
  'Website: http://www.mftz.org    Email: fizinfo@mftz.org'
]

const buildQrPayload = ({ sale_uid, ticket_uid, payment_uid }) => {
  return JSON.stringify({ sale_uid, ticket_uid, payment_uid })
}

const normalizePaymentMethod = (value) => {
  const v = String(value || '').trim().toLowerCase()

  if (v === 'cash' || v.includes('cash')) return 'cash'

  if (
    v === 'card' ||
    v.includes('card') ||
    v.includes('credit') ||
    v.includes('debit')
  ) return 'card'

  if (
    v === 'business_account' ||
    v === 'business account' ||
    v.includes('business')
  ) return 'business_account'

  return null
}

const buildPaymentSummary = (transactions = []) => {
  const summary = {
    cash: { key: 'cash', label: 'Cash', count: 0, total: 0 },
    business_account: { key: 'business_account', label: 'Business Account', count: 0, total: 0 },
    card: { key: 'card', label: 'Card', count: 0, total: 0 }
  }

  transactions.forEach(row => {
    const paymentKey = normalizePaymentMethod(row.payment_method)
    if (!paymentKey || !summary[paymentKey]) return

    summary[paymentKey].count += 1
    summary[paymentKey].total += Number.parseFloat(row.total_amount) || 0
  })

  return summary
}

/**
 * Obtener información del cliente
 */
export const getCustomerInfo = async (customerId) => {
  const [customer] = await query(`
    SELECT 
      c.id_customer,
      c.account_number,
      c.account_name,
      c.account_address,
      c.city,
      c.account_state,
      c.account_country,
      c.phone_number,
      c.tax_id,
      c.has_credit,
      cc.credit_type,
      cc.credit_limit,
      cc.current_balance,
      cc.available_credit,
      cc.is_suspended,
      cc.payment_terms_days,
      cc.last_payment_date
    FROM customers c
    LEFT JOIN customer_credit cc ON c.id_customer = cc.customer_id
    WHERE c.id_customer = ?
  `, [customerId])

  return customer
}

/**
 * Obtener transacciones/tickets del cliente
 */
export const getCustomerTransactions = async (customerId, dateFrom, dateTo) => {
  const params = [customerId]

  let sql = `
    SELECT 
      t.ticket_id,
      t.ticket_uid,
      t.ticket_number,
      t.printed_at,
      t.reprint_count,
      s.sale_id,
      s.sale_uid,
      s.receipt_number,
      s.created_at as sale_date,
      s.subtotal,
      s.tax_total as tax_amount,
      s.total as total_amount,
      s.total as weigh_fee,
      s.amount_paid,
      s.balance_due,
      p.name as product_type,
      pm.name as payment_method,
      pay.payment_uid,
      pay.amount as payment_amount,
      pay.received_at as payment_date,
      pay_st.code as payment_status_code,
      pay_st.label as payment_status_label,
      sale_st.code as sale_status_code,
      sale_st.label as sale_status_label,
      ticket_st.code as ticket_status_code,
      ticket_st.label as ticket_status_label,
      sdi.driver_first_name,
      sdi.driver_last_name,
      sdi.vehicle_plates,
      sdi.license_state,
      dp.name as driver_product,
      sdi.trailer_number,
      sdi.tractor_number,
      u.full_name AS operator_name,
      ssa.eje1,
      ssa.eje2,
      ssa.eje3,
      ssa.peso_total,
      ssa.weight_lb as gross_weight,
      s.is_reweigh,
      s.reweigh_of_sale_id
    FROM tickets t
    JOIN sales s ON t.sale_uid = s.sale_uid
    JOIN sale_driver_info sdi ON s.sale_uid = sdi.sale_uid
    JOIN customers c ON sdi.account_number = c.account_number
    JOIN sale_lines sl ON s.sale_uid = sl.sale_uid
    JOIN products p ON sl.product_id = p.product_id
    LEFT JOIN scale_session_axles ssa ON sdi.match_key = ssa.uuid_weight
    LEFT JOIN driver_products dp ON sdi.driver_product_id = dp.product_id
    LEFT JOIN payments pay ON s.sale_uid = pay.sale_uid
    LEFT JOIN payment_methods pm ON pay.method_id = pm.method_id
    LEFT JOIN status_catalogo pay_st ON pay.payment_status_id = pay_st.status_id AND pay_st.module = 'PAYMENTS'
    LEFT JOIN status_catalogo sale_st ON s.sale_status_id = sale_st.status_id AND sale_st.module = 'SALES'
    LEFT JOIN status_catalogo ticket_st ON t.ticket_status_id = ticket_st.status_id AND ticket_st.module = 'TICKETS'
    LEFT JOIN users u ON s.operator_id = u.user_id
    WHERE c.id_customer = ?
  `

  if (dateFrom) {
    sql += ` AND DATE(s.created_at) >= ?`
    params.push(dateFrom)
  }
  if (dateTo) {
    sql += ` AND DATE(s.created_at) <= ?`
    params.push(dateTo)
  }

  sql += ` ORDER BY s.created_at ASC, t.ticket_id ASC`
  return await query(sql, params)
}

/**
 * Obtener datos completos del reporte
 */
export const getData = async (filters = {}) => {
  const { customer_id, date_from = null, date_to = null } = filters

  if (!customer_id || customer_id === 'all') {
    return { customer: null, transactions: [], totals: {}, payment_summary: {} }
  }

  const customer = await getCustomerInfo(customer_id)
  if (!customer) {
    return { customer: null, transactions: [], totals: {}, payment_summary: {} }
  }

  const transactions = await getCustomerTransactions(customer_id, date_from, date_to)
  const toNum = v => Number.parseFloat(v) || 0
  const norm = v => (v ?? '').toString().trim().toUpperCase()

  const totals = {
    total_transactions: transactions.length,
    total_weigh: transactions.filter(t => t.product_type === 'Weigh').length,
    total_reweigh: transactions.filter(t => t.product_type === 'Reweigh').length,
    total_weight: transactions.reduce((sum, t) => sum + (parseFloat(t.gross_weight) || 0), 0),
    total_subtotal: transactions.reduce((sum, t) => sum + (parseFloat(t.subtotal) || 0), 0),
    total_tax: transactions.reduce((sum, t) => sum + (parseFloat(t.tax_amount) || 0), 0),
    total_amount: transactions.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0),
    total_paid: transactions.reduce((sum, t) => {
      if (norm(t.sale_status_code) === 'CANCELLED') return sum
      if (norm(t.payment_status_code) === 'RECEIVED') return sum + toNum(t.total_amount)
      return sum
    }, 0),
    total_pending: transactions.reduce((sum, t) => {
      if (norm(t.sale_status_code) === 'CANCELLED') return sum
      if (norm(t.payment_status_code) === 'PENDING') return sum + toNum(t.total_amount)
      return sum
    }, 0),
    count_paid: transactions.filter(t => t.payment_status_code === 'RECEIVED').length,
    count_pending: transactions.filter(t => t.payment_status_code === 'PENDING').length,
    count_cancelled: transactions.filter(t => t.sale_status_code === 'CANCELLED').length
  }

  const payment_summary = buildPaymentSummary(transactions)

  return { customer, transactions, totals, payment_summary }
}

/**
 * Obtener opciones para filtros
 */
export const getFilterOptions = async () => {
  const customers = await query(`
    SELECT id_customer as value, account_name as label, account_number 
    FROM customers 
    WHERE is_active = 1 
    ORDER BY account_name
  `)

  return { customers }
}
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

const normalizePngBuffer = (v) => {
  if (!v) return null
  if (Buffer.isBuffer(v)) return v

  if (typeof v === 'string') {
    // caso: data URL base64
    if (v.startsWith('data:image/png;base64,')) {
      const b = Buffer.from(v.split(',')[1], 'base64')
      return b.slice(0, 8).equals(PNG_MAGIC) ? b : null
    }

    // caso: a veces tu query wrapper regresa el BLOB como string "latin1" (se ve como "‰PNG...")
    const latin = Buffer.from(v, 'latin1')
    if (latin.slice(0, 8).equals(PNG_MAGIC)) return latin

    // intento base64 (por si viene así)
    try {
      const b64 = Buffer.from(v, 'base64')
      if (b64.slice(0, 8).equals(PNG_MAGIC)) return b64
    } catch { }
  }

  return null
}

export const hydrateTicketsForPrint = async (tickets = [], opts = {}) => {
  const withSignature = opts.withSignature !== false
  const withQr = opts.withQr !== false
  const formatCurrency = opts.formatCurrency || ((n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
  )

  let sigMap = new Map()

  // 1) Signatures (solo si se pide y hay ticket_uid)
  if (withSignature) {
    const ticketUids = [...new Set((tickets || []).map(t => t?.ticket_uid).filter(Boolean))]
    if (ticketUids.length > 0) {
      const placeholders = ticketUids.map(() => '?').join(',')
      const sigRows = await query(
        `SELECT ticket_uid, signature_img
         FROM ticket_signatures
         WHERE ticket_uid IN (${placeholders})`,
        ticketUids
      )
      for (const r of sigRows) {
        sigMap.set(r.ticket_uid, normalizePngBuffer(r.signature_img))
      }
    }
  }

  // 2) Fetch original ticket numbers for reweigh sales
  // NOTE: reweigh_of_sale_id stores a sale_uid (UUID), not a numeric sale_id
  const reweighSaleUids = [...new Set((tickets || [])
    .filter(t => t.reweigh_of_sale_id)
    .map(t => t.reweigh_of_sale_id))]
  const originalTicketMap = new Map()
  if (reweighSaleUids.length > 0) {
    const ph = reweighSaleUids.map(() => '?').join(',')
    const rows = await query(
      `SELECT s.sale_uid, t.ticket_number
       FROM sales s
       JOIN tickets t ON s.sale_uid = t.sale_uid
       WHERE s.sale_uid IN (${ph})`,
      reweighSaleUids
    )
    for (const r of rows) {
      originalTicketMap.set(r.sale_uid, r.ticket_number)
    }
  }

  // 3) Return enriched tickets
  return await Promise.all((tickets || []).map(async (t) => {
    // QR (si se pide)
    let qrPng = t.qrPng || null
    if (withQr && !qrPng) {
      const payload = buildQrPayload({
        sale_uid: t.sale_uid,
        ticket_uid: t.ticket_uid,
        payment_uid: t.payment_uid
      })
      qrPng = await QRCode.toBuffer(payload, {
        type: 'png',
        errorCorrectionLevel: 'M',
        margin: 0,
        scale: 4
      })
    }

    // Original ticket number for reweigh
    const original_ticket_number = t.reweigh_of_sale_id
      ? (originalTicketMap.get(t.reweigh_of_sale_id) || null)
      : null

    return {
      ...t,
      qrPng,
      original_ticket_number,
      signaturePng: withSignature ? (sigMap.get(t.ticket_uid) || null) : (t.signaturePng || null),
      weigh_fee_text: t.weigh_fee_text || formatCurrency(t.weigh_fee ?? t.total_amount ?? 0)
    }
  }))
}

/**
 * Generar PDF
 *
 * FIX aplicado (mismo patrón que Sales Report):
 * 1. bufferPages:true para footers con conteo real al final.
 * 2. Detección dinámica de "última página" en el render loop.
 * 3. FIX ADICIONAL para Customer Statement: después del loop, si yPos > summaryAreaTop,
 *    se crea una página nueva para el summary. Esto resuelve el caso donde el header
 *    grande (Customer Info + Statement Summary) no deja espacio suficiente para que
 *    el loop dispare un page break antes de que las filas pasen de summaryAreaTop.
 */
export const generatePdf = async (filters = {}) => {
  const { customer, transactions, totals, payment_summary = {} } = await getData(filters)
  const settings = await getReportSettings()

  if (!customer) throw new Error('Customer not found')

  const includeTickets = asBool(filters.include_tickets)

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
  }

  const formatNumber = (val) => {
    if (val === null || val === undefined) return '0.00'
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  const formatDateTime = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('en-US', {
      timeZone: 'America/Matamoros',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const logoPath = getLogoPath(settings.companyLogo)

  const ticketPages = includeTickets
    ? await hydrateTicketsForPrint(transactions, {
      withQr: true,
      withSignature: true,
      formatCurrency
    })
    : []

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'portrait',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        bufferPages: true  // FIX: para footers con conteo real
      })

      const buffers = []
      doc.on('data', (c) => buffers.push(c))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const primaryColor = '#2E75B6'
      const headerBg = '#4472C4'
      const altRowBg = '#F2F2F2'
      const textGray = '#666666'
      const successColor = '#28a745'
      const warningColor = '#ffc107'
      const dangerColor = '#dc3545'

      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const marginLeft = doc.page.margins.left
      const marginRight = doc.page.margins.right
      const contentWidth = pageWidth - marginLeft - marginRight

      const footerY = pageHeight - doc.page.margins.bottom - 12
      const footerLineY = footerY - 6

      const rowHeight = 14
      const tableHeaderHeight = 16

      const tableLeft = marginLeft
      const colWidths = [35, 35, 70, 75, 35, 35, 55, 55, 50, 50, 37]
      const tableWidth = colWidths.reduce((a, b) => a + b, 0)

      const headers = [
        'Ticket #',
        'Service',
        'Date',
        'Driver',
        'Trailer #',
        'Tractor #',
        'Scale Op',
        'Weight',
        'Total',
        'Paid',
        'Status'
      ]

      // ===== Bottom blocks dimensions (calculadas ANTES del render) =====
      const paymentRows = Object.values(payment_summary || {})

      const summaryBoxWidth = 420
      const summaryHeaderHeight = 16
      const summaryBodyHeight = 28
      const summaryBlockHeight = summaryHeaderHeight + summaryBodyHeight

      const paymentTableWidth = 420
      const paymentTitleHeight = 16
      const paymentHeaderHeight = 14
      const paymentRowHeight = 14
      const paymentColWidths = [220, 80, 120]
      const paymentHeaders = ['Method', 'Qty', 'Amount']
      const paymentTableHeight =
        paymentTitleHeight + paymentHeaderHeight + (paymentRows.length * paymentRowHeight)

      const gapBetweenBlocks = 8
      const bottomGapFromFooter = 8

      const totalBottomBlocksHeight =
        bottomGapFromFooter + paymentTableHeight + gapBetweenBlocks + summaryBlockHeight

      // summaryAreaTop: si yPos pasa de aquí, el summary se sobrepondría
      const summaryAreaTop = footerY - totalBottomBlocksHeight
      const normalPageLimit = footerLineY - 4

      const dateRange =
        [
          filters.date_from ? `From: ${filters.date_from}` : '',
          filters.date_to ? `To: ${filters.date_to}` : ''
        ]
          .filter(Boolean)
          .join(' - ') || 'All time'

      // ========== drawMainHeader (sin cambios) ==========
      const drawMainHeader = () => {
        const headerTop = 20

        if (logoPath) {
          try {
            doc.image(logoPath, marginLeft, headerTop, { fit: [60, 35] })
          } catch (e) {
            // ignore
          }
        }

        doc
          .fontSize(14)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text(settings.companyName, marginLeft + 70, headerTop + 5, {
            width: contentWidth - 140,
            align: 'center'
          })

        doc
          .fontSize(11)
          .fillColor('#333333')
          .font('Helvetica-Bold')
          .text('Customer Statement', marginLeft + 70, headerTop + 22, {
            width: contentWidth - 140,
            align: 'center'
          })

        const metaW = 150
        const metaX = pageWidth - marginRight - metaW

        const generatedTxt = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(new Date())

        doc.fontSize(7).fillColor(textGray).font('Helvetica')
        doc.text(`Generated: ${generatedTxt}`, metaX, headerTop + 6, {
          width: metaW,
          align: 'right',
          lineBreak: false
        })

        if (filters.date_from) {
          doc.text(`From: ${filters.date_from}`, metaX, headerTop + 16, {
            width: metaW,
            align: 'right',
            lineBreak: false
          })
        }
        if (filters.date_to) {
          doc.text(`${filters.date_to}`, metaX, headerTop + 26, {
            width: metaW,
            align: 'right',
            lineBreak: false
          })
        }

        doc.moveTo(marginLeft, 65).lineTo(pageWidth - marginRight, 65).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        let yPos = 75

        doc.rect(marginLeft, yPos, contentWidth, 18).fill(headerBg)
        doc.fontSize(10).fillColor('#FFFFFF').font('Helvetica-Bold')
          .text('Customer Information', marginLeft + 5, yPos + 4)

        yPos += 22

        doc.fontSize(8).fillColor('#333333').font('Helvetica')
        doc.text(`Account #: `, marginLeft, yPos, { continued: true }).font('Helvetica-Bold').text(customer.account_number)
        doc.font('Helvetica').text(`Name: `, marginLeft, yPos + 12, { continued: true }).font('Helvetica-Bold').text(customer.account_name)
        doc.font('Helvetica').text(`Address: ${customer.account_address || '-'}`, marginLeft, yPos + 24)
        doc.text(`City: ${customer.city || '-'}, ${customer.account_state || '-'}`, marginLeft, yPos + 36)
        doc.text(`Phone: ${customer.phone_number || '-'}`, marginLeft, yPos + 48)
        doc.text(`Tax ID: ${customer.tax_id || '-'}`, marginLeft, yPos + 60)

        const rightCol = marginLeft + contentWidth / 2 + 20
        if (customer.has_credit) {
          doc.font('Helvetica-Bold').fillColor(primaryColor).text(`Credit Type: ${customer.credit_type}`, rightCol, yPos)
          doc.font('Helvetica').fillColor('#333333')
          doc.text(`Credit Limit: ${formatCurrency(customer.credit_limit)}`, rightCol, yPos + 12)
          doc.text(`Current Balance: ${formatCurrency(customer.current_balance)}`, rightCol, yPos + 24)
          doc.text(`Available Credit: ${formatCurrency(customer.available_credit)}`, rightCol, yPos + 36)
          doc.text(`Payment Terms: ${customer.payment_terms_days || 30} days`, rightCol, yPos + 48)

          if (customer.is_suspended) {
            doc.font('Helvetica-Bold').fillColor(dangerColor).text('⚠ ACCOUNT SUSPENDED', rightCol, yPos + 60)
          }
        } else {
          doc.text('No credit account', rightCol, yPos)
        }

        yPos += 75

        doc.rect(marginLeft, yPos, contentWidth, 18).fill('#E7E6E6')
        doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold')
          .text('Statement Summary', marginLeft + 5, yPos + 4)

        yPos += 22

        const padTop = 8
        const padBot = 6
        const lineH = 14
        const sumBoxY = yPos + 2
        const sumBoxH = padTop + padBot + (lineH * 3)

        doc.save()
        doc.fillColor('#FFFFFF')
        doc.rect(marginLeft, sumBoxY, contentWidth, sumBoxH).fill()
        doc.strokeColor('#D0D0D0').lineWidth(0.6)
        doc.rect(marginLeft, sumBoxY, contentWidth, sumBoxH).stroke()
        doc.restore()

        let sy = sumBoxY + padTop

        doc.fontSize(8).fillColor('#333333').font('Helvetica')
        doc.text(`Total Transactions: ${totals.total_transactions}`, marginLeft + 6, sy)
        doc.text(`Weigh: ${totals.total_weigh}`, marginLeft + 140, sy)
        doc.text(`Reweigh: ${totals.total_reweigh}`, marginLeft + 220, sy)
        doc.text(`Total Weight: ${formatNumber(totals.total_weight)} lb`,
          marginLeft + contentWidth - 210, sy, { width: 204, align: 'right' })

        sy += lineH

        doc.fontSize(8).font('Helvetica-Bold')
        doc.fillColor(successColor).text(`Paid: ${totals.count_paid}`, marginLeft + 6, sy)
        doc.fillColor(warningColor).text(`Pending: ${totals.count_pending}`, marginLeft + 90, sy)
        doc.fillColor(dangerColor).text(`Cancelled: ${totals.count_cancelled}`, marginLeft + 190, sy)

        sy += lineH

        doc.fillColor('#333333').font('Helvetica-Bold')
        doc.text(`Subtotal: ${formatCurrency(totals.total_subtotal)}`, marginLeft + 6, sy)
        doc.text(`Tax: ${formatCurrency(totals.total_tax)}`, marginLeft + 160, sy)
        doc.text(`Total: ${formatCurrency(totals.total_amount)}`, marginLeft + 290, sy)
        doc.fillColor(successColor).text(`Paid: ${formatCurrency(totals.total_paid)}`, marginLeft + 390, sy)
        doc.fillColor(dangerColor).text(`Pending: ${formatCurrency(totals.total_pending)}`, marginLeft + 480, sy)

        yPos = sumBoxY + sumBoxH + 10
        return yPos
      }

      // ========== drawSimpleHeader (sin cambios) ==========
      const drawSimpleHeader = () => {
        doc.fontSize(10).fillColor(primaryColor).font('Helvetica-Bold')
          .text(`${settings.companyName} - Customer Statement`, marginLeft, 25)

        doc.fontSize(9).fillColor('#333333').font('Helvetica')
          .text(`${customer.account_name} (${customer.account_number})`, marginLeft, 40)

        doc.moveTo(marginLeft, 55).lineTo(pageWidth - marginRight, 55).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        return 65
      }

      // FIX: drawFooter se elimina del loop; se llama al final con switchToPage
      const drawFooter = (pageNo, totalPages) => {
        doc.save()
        doc.strokeColor('#E5E7EB').lineWidth(0.7)
        doc.moveTo(marginLeft, footerLineY).lineTo(pageWidth - marginRight, footerLineY).stroke()
        doc.restore()

        doc.fontSize(7).fillColor(textGray).font('Helvetica')
        doc.text(settings.companyAddress || '', marginLeft, footerY, {
          width: contentWidth,
          align: 'left',
          lineBreak: false
        })

        doc.text(`Page ${pageNo} of ${totalPages}`, pageWidth - marginRight - 60, footerY, {
          width: 60,
          align: 'right',
          lineBreak: false
        })
      }

      // ========== drawTableHeader (sin cambios) ==========
      const drawTableHeader = (y) => {
        doc.rect(tableLeft, y, tableWidth, tableHeaderHeight).fill(headerBg)
        doc.fontSize(7).fillColor('#FFFFFF').font('Helvetica-Bold')
        let xPos = tableLeft + 2

        headers.forEach((header, i) => {
          const align =
            (i === 7 || i === 8 || i === 9) ? 'right' :
              (i === 10) ? 'center' :
                'left'

          doc.text(header, xPos, y + 5, { width: colWidths[i] - 4, align })
          xPos += colWidths[i]
        })

        return y + tableHeaderHeight
      }

      const getStatusColor = (paymentStatus, saleStatus) => {
        if (saleStatus === 'CANCELLED') return dangerColor
        if (paymentStatus === 'RECEIVED') return successColor
        if (paymentStatus === 'PENDING') return warningColor
        return textGray
      }

      const getStatusLabel = (paymentStatus, saleStatus) => {
        if (saleStatus === 'CANCELLED') return 'Cancelled'
        if (paymentStatus === 'RECEIVED') return 'Paid'
        if (paymentStatus === 'PENDING') return 'Pending'
        return '-'
      }

      // ======================================================================
      // FIX: Función auxiliar para dibujar los bloques de summary + payment
      //      Se extrae a función para poder llamarla en cualquier página.
      // ======================================================================
      const drawBottomBlocks = () => {
        const paymentTableTop = footerY - bottomGapFromFooter - paymentTableHeight
        const summaryTop = paymentTableTop - gapBetweenBlocks - summaryBlockHeight

        // Summary
        doc.rect(tableLeft, summaryTop, summaryBoxWidth, summaryHeaderHeight).fill('#E7E6E6')
        doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold')
          .text('Summary', tableLeft, summaryTop + 4, { width: summaryBoxWidth, align: 'center' })

        doc.fontSize(7).fillColor('#000000').font('Helvetica')
        doc.text(`Transactions: ${totals.total_transactions}`, tableLeft + 6, summaryTop + 22)
        doc.text(`Weigh: ${totals.total_weigh}`, tableLeft + 110, summaryTop + 22)
        doc.text(`Reweigh: ${totals.total_reweigh}`, tableLeft + 180, summaryTop + 22)
        doc.text(`Total Weight: ${formatNumber(totals.total_weight)} lb`, tableLeft + 250, summaryTop + 22, {
          width: 164,
          align: 'right'
        })

        doc.font('Helvetica-Bold')
        doc.fillColor('#333333').text(`Total: ${formatCurrency(totals.total_amount)}`, tableLeft + 6, summaryTop + 34)
        doc.fillColor(successColor).text(`Paid: ${formatCurrency(totals.total_paid)}`, tableLeft + 150, summaryTop + 34)
        doc.fillColor(dangerColor).text(`Pending: ${formatCurrency(totals.total_pending)}`, tableLeft + 300, summaryTop + 34)

        doc.rect(tableLeft, summaryTop, summaryBoxWidth, summaryBlockHeight)
          .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        // Payment Summary
        doc.rect(tableLeft, paymentTableTop, paymentTableWidth, paymentTitleHeight).fill(headerBg)
        doc.fontSize(8).fillColor('#FFFFFF').font('Helvetica-Bold')
          .text('Balance Summary by Payment Method', tableLeft, paymentTableTop + 4, {
            width: paymentTableWidth,
            align: 'center'
          })

        const paymentHeaderY = paymentTableTop + paymentTitleHeight
        doc.rect(tableLeft, paymentHeaderY, paymentTableWidth, paymentHeaderHeight).fill('#D9E2F3')
        doc.fontSize(7).fillColor('#000000').font('Helvetica-Bold')

        let px = tableLeft + 3
        paymentHeaders.forEach((header, i) => {
          const align = i === 0 ? 'left' : 'right'
          doc.text(header, px, paymentHeaderY + 4, {
            width: paymentColWidths[i] - 6,
            align
          })
          px += paymentColWidths[i]
        })

        let rowY = paymentHeaderY + paymentHeaderHeight
        paymentRows.forEach((item, index) => {
          if (index % 2 === 0) {
            doc.rect(tableLeft, rowY, paymentTableWidth, paymentRowHeight).fill('#F7F7F7')
          }

          doc.fontSize(7).fillColor('#000000').font('Helvetica')

          let cellX = tableLeft + 3
          const rowCells = [item.label, String(item.count), formatCurrency(item.total)]

          rowCells.forEach((cell, i) => {
            const align = i === 0 ? 'left' : 'right'
            doc.text(String(cell), cellX, rowY + 4, {
              width: paymentColWidths[i] - 6,
              align
            })
            cellX += paymentColWidths[i]
          })

          rowY += paymentRowHeight
        })

        doc.rect(tableLeft, paymentTableTop, paymentTableWidth, paymentTableHeight)
          .strokeColor('#CCCCCC').lineWidth(0.5).stroke()
      }

      // ===== Render del statement =====
      let rowIndex = 0
      let yPos = drawMainHeader()
      let tableTopY = yPos
      yPos = drawTableHeader(yPos)

      while (rowIndex < transactions.length) {
        // ---------------------------------------------------------------
        // FIX: Detección dinámica (mismo patrón que Sales Report)
        // ---------------------------------------------------------------
        const remainingRows = transactions.length - rowIndex
        const yAfterAllRemaining = yPos + (remainingRows * rowHeight)
        const fitsWithBottomBlocks = yAfterAllRemaining <= summaryAreaTop
        const pageLimit = fitsWithBottomBlocks ? summaryAreaTop : normalPageLimit

        if (yPos + rowHeight > pageLimit) {
          // Borde de tabla en esta página antes de cambiar
          doc.rect(tableLeft, tableTopY, tableWidth, yPos - tableTopY)
            .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

          doc.addPage({
            size: 'LETTER',
            layout: 'portrait',
            margins: { top: 40, bottom: 40, left: 40, right: 40 }
          })

          yPos = drawSimpleHeader()
          tableTopY = yPos
          yPos = drawTableHeader(yPos)
          continue  // re-evaluar con el nuevo yPos
        }

        if (rowIndex % 2 === 0) {
          doc.rect(tableLeft, yPos, tableWidth, rowHeight).fill(altRowBg)
        }

        const row = transactions[rowIndex]
        const statusColor = getStatusColor(row.payment_status_code, row.sale_status_code)
        const statusLabel = getStatusLabel(row.payment_status_code, row.sale_status_code)

        const driverName = [row.driver_first_name, row.driver_last_name]
          .filter(Boolean)
          .join(' ') || '-'

        const rowData = [
          row.ticket_number || '-',
          row.product_type || '-',
          formatDateTime(row.sale_date),
          driverName,
          row.trailer_number || '-',
          row.tractor_number || '-',
          row.operator_name || '-',
          formatNumber(row.gross_weight),
          formatCurrency(row.total_amount),
          formatCurrency(row.amount_paid),
          statusLabel
        ]

        doc.fontSize(6).font('Helvetica')

        let xPos = tableLeft + 2
        rowData.forEach((cell, i) => {
          if (i === 10) {
            doc.fillColor(statusColor).font('Helvetica-Bold')
          } else if (i === 1) {
            const typeColor = cell === 'Weigh' ? '#17a2b8' : '#6f42c1'
            doc.fillColor(typeColor).font('Helvetica-Bold')
          } else {
            doc.fillColor('#333333').font('Helvetica')
          }

          const align =
            (i === 7 || i === 8 || i === 9) ? 'right' :
              (i === 10) ? 'center' :
                'left'

          doc.text(String(cell), xPos, yPos + 4, { width: colWidths[i] - 4, align })
          xPos += colWidths[i]
        })

        yPos += rowHeight
        rowIndex++
      }

      // Borde final de tabla
      doc.rect(tableLeft, tableTopY, tableWidth, yPos - tableTopY)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

      // =====================================================================
      // FIX ADICIONAL (no necesario en Sales Report):
      // Si yPos > summaryAreaTop, las filas de la tabla ya pasaron la zona del
      // summary → crear una página nueva para el summary.
      // Esto pasa cuando el header grande (Customer Info) consume tanto espacio
      // que todas las filas caben en normalPageLimit sin page break, pero
      // invaden el espacio del summary.
      // =====================================================================
      if (yPos > summaryAreaTop) {
        doc.addPage({
          size: 'LETTER',
          layout: 'portrait',
          margins: { top: 40, bottom: 40, left: 40, right: 40 }
        })
        drawSimpleHeader()
        // El summary se dibuja anclado al fondo de esta nueva página
      }

      // Dibujar bloques de summary en la página actual (ya sea la original o la nueva)
      drawBottomBlocks()

      // Guardar cuántas páginas tuvo solo el statement
      const statementPageCount = doc.bufferedPageRange().count

      // ===== Tickets al final =====
      if (includeTickets && ticketPages.length > 0) {
        ticketPages.forEach((t) => {
          if (t.eje1 == null) t.eje1 = 0
          if (t.eje2 == null) t.eje2 = 0
          if (t.eje3 == null) t.eje3 = 0
          if (t.peso_total == null) t.peso_total = 0

          drawTicketPage(doc, t, logoPath)
        })
      }

      // =====================================================================
      // FIX: Footers con conteo REAL solo para páginas del statement
      // (las páginas de tickets no llevan footer del statement)
      // =====================================================================
      for (let i = 0; i < statementPageCount; i++) {
        doc.switchToPage(i)
        drawFooter(i + 1, statementPageCount)
      }

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Dibuja una página de ticket completa (LETTER landscape con ticket centrado)
 */
export function drawTicketPage(doc, t, logoPath) {
  doc.addPage({
    size: [TICKET_W, TICKET_H],   // <-- 612 x 396 (8.5 x 5.5)
    margins: { top: 0, bottom: 0, left: 0, right: 0 }
  })


  drawTicket612x396(doc, t, logoPath)

}

/**
 * Dibuja el ticket en un canvas de 612x396 (mitad de LETTER horizontal)
 * MEJORADO: diseño más fiel al ticket original del POS
 */
export function drawTicket612x396(doc, t, logoPath) {
  const W = TICKET_W
  const H = TICKET_H
  const MARGIN = 20

  // Borde exterior
  doc.save()
  doc.lineWidth(1.5)
  doc.strokeColor('#000000')
  doc.rect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2)
  doc.stroke()
  doc.restore()

  // =======================
  // 1) Columnas tipo WPF (3* / 2*)  <<< CLAVE
  // =======================
  const contentX = MARGIN + 15
  const contentY = MARGIN + 15
  const contentW = W - (MARGIN + 15) * 2

  const COL_GAP = 18
  const LEFT_W = Math.round(contentW * 0.60)      // 3/5
  const RIGHT_X = contentX + LEFT_W + COL_GAP      // inicio col derecha
  const RIGHT_W = (contentX + contentW) - RIGHT_X  // ancho col derecha

  const rightColX = RIGHT_X

  // ========== LOGO (top left — bigger) ==========
  const logoW = 110
  const logoH = 65
  const logoX = contentX
  const logoY = contentY

  if (logoPath) {
    try {
      doc.image(logoPath, logoX, logoY, { fit: [logoW, logoH], align: 'center', valign: 'center' })
    } catch (e) {
      // ignore
    }
  }

  // ========== HEADER CENTER (centered between logo and QR) ==========
  const headerCenterX = contentX + logoW + 10
  const headerTextW = RIGHT_X - headerCenterX - 10
  let headerY = contentY + 2

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000')
  doc.text('Certified Public Truck Scale', headerCenterX, headerY, { width: headerTextW, align: 'center' })
  headerY += 16

  doc.font('Helvetica').fontSize(8.5)
  doc.text('6401 S. 33rd Street · McAllen, Texas 78503', headerCenterX, headerY, { width: headerTextW, align: 'center' })
  headerY += 11

  doc.text('(956) 682-4306 · (956) 882-9111 Fax', headerCenterX, headerY, { width: headerTextW, align: 'center' })
  headerY += 11

  doc.text('Certificate No. 036231', headerCenterX, headerY, { width: headerTextW, align: 'center' })
  headerY += 11

  doc.text('Website: http://www.mftz.org', headerCenterX, headerY, { width: headerTextW, align: 'center' })
  headerY += 11

  doc.text('Email: fizinfo@mftz.org', headerCenterX, headerY, { width: headerTextW, align: 'center' })

  // ========== TICKET NUMBER (top right) ==========
  const ticketX = W - MARGIN - 135
  const ticketY = contentY

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
  doc.text('TICKET', ticketX, ticketY, { width: 120, align: 'right' })

  doc.fontSize(24)
  doc.text(String(t.ticket_number || ''), ticketX, ticketY + 16, { width: 120, align: 'right' })

  // ========== QR CODE (below ticket number) ==========
  const qrSize = 90
  const qrX = RIGHT_X + RIGHT_W - qrSize
  const qrY = contentY + 55

  doc.save()
  doc.lineWidth(1)
  doc.strokeColor('#000000')
  doc.rect(qrX, qrY, qrSize, qrSize)
  doc.stroke()
  doc.restore()

  if (t.qrPng) {
    try {
      doc.image(t.qrPng, qrX + 3, qrY + 3, { fit: [qrSize - 6, qrSize - 6] })
    } catch (e) {
      // ignore
    }
  }

  // ========== DRIVER INFO (left column) ==========
  const driverX = contentX
  const driverY = contentY + 115

  const driverName = [t.driver_first_name, t.driver_last_name].filter(Boolean).join(' ') || '-'

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
  doc.text('Driver:', driverX, driverY, { continued: true })
  doc.font('Helvetica').text(`  ${driverName}`)

  let infoY = driverY + 18
  doc.font('Helvetica-Bold').fontSize(9)
  doc.text('Lic. Plates:', driverX, infoY)

  infoY += 14
  doc.font('Helvetica')
  doc.text(t.vehicle_plates || '-', driverX, infoY)

  infoY += 18
  doc.font('Helvetica-Bold')
  doc.text('Lic. State:', driverX, infoY)

  infoY += 14
  doc.font('Helvetica')
  doc.text(t.license_state || '-', driverX, infoY)

  // ========== TRACTOR/TRAILER/TIME (right column) ==========
  let rightY = driverY + 18

  doc.font('Helvetica-Bold').fontSize(9)
  doc.text('Tractor#:', rightColX, rightY)
  rightY += 14
  doc.font('Helvetica')
  doc.text(t.tractor_number || '-', rightColX, rightY)

  rightY += 18
  doc.font('Helvetica-Bold')
  doc.text('Trailer#:', rightColX, rightY)
  rightY += 14
  doc.font('Helvetica')
  doc.text(t.trailer_number || '-', rightColX, rightY)

  rightY += 18
  doc.font('Helvetica-Bold')
  doc.text('Time:', rightColX, rightY, { continued: true })
  doc.font('Helvetica')
  doc.text(`  ${formatTicketTime(t.printed_at)}`)

  // ========== DATE / WEIGHER BOXES ==========
  const boxY = contentY + 210
  const boxH = 22

  // Date
  doc.font('Helvetica-Bold').fontSize(9)
  doc.text('Date', contentX, boxY)

  doc.save()
  doc.lineWidth(1)
  doc.strokeColor('#000000')
  doc.rect(contentX, boxY + 14, LEFT_W, boxH)
  doc.stroke()
  doc.restore()

  doc.font('Helvetica').fontSize(8.5)
  doc.text(formatTicketDate(t.printed_at), contentX + 5, boxY + 19)

  // Weigher
  doc.font('Helvetica-Bold').fontSize(9)
  doc.text('Weigher', RIGHT_X, boxY)

  doc.save()
  doc.lineWidth(1)
  doc.strokeColor('#000000')
  doc.rect(RIGHT_X, boxY + 14, RIGHT_W, boxH)
  doc.stroke()
  doc.restore()

  doc.font('Helvetica').fontSize(8.5)
  doc.text(t.operator_name || '-', RIGHT_X + 5, boxY + 19, { width: RIGHT_W - 10 })

  // =======================
  // 4) Product (SOLO col izquierda)
  // =======================
  const prodY = boxY + 46
  const fieldH = 22

  doc.font('Helvetica-Bold').fontSize(9)
  doc.text('Product', contentX, prodY)

  doc.save()
  doc.lineWidth(1)
  doc.strokeColor('#000000')
  doc.rect(contentX, prodY + 14, LEFT_W, fieldH)
  doc.stroke()
  doc.restore()

  doc.font('Helvetica').fontSize(8.5)
  doc.text(t.driver_product || '-', contentX + 5, prodY + 19, { width: LEFT_W - 10 })

  // =======================
  // 5) Signature (izquierda)
  // =======================
  const signY = prodY + 50

  doc.font('Helvetica').fontSize(8.5).fillColor('#000000')
  doc.text('Signature:', contentX, signY)

  const sigBoxX = contentX + 62
  const sigBoxY = signY - 10
  const sigBoxW = LEFT_W - 72
  const sigBoxH = 48

  if (t.signaturePng) {
    try {
      doc.image(t.signaturePng, sigBoxX, sigBoxY, { fit: [sigBoxW, sigBoxH] })
    } catch (e) {
      doc.text('___________________________', sigBoxX, signY)
    }
  } else {
    doc.text('___________________________', sigBoxX, signY)
  }

  doc.fontSize(7)
  doc.text(
    'ALL RE-WEIGHS MUST BE DONE WITHIN 12 HOURS OF ORIGINAL WEIGH TIME.',
    contentX,
    signY + 13,
    { width: LEFT_W }
  )

  // =======================
  // 6) RIGHT SIDE: Weigh Fee + Scales + Reweigh (sin empalmes)
  // =======================

  const scaleLabelW = 78
  const scaleValW = RIGHT_W - scaleLabelW

  const scaleRows = [
    { label: 'SCALE 1:', val: toInt0(t.eje1) },
    { label: 'SCALE 2:', val: toInt0(t.eje2) },
    { label: 'SCALE 3:', val: toInt0(t.eje3) },
    { label: 'Total Gross:', val: toInt0(t.peso_total) }
  ]

  const maxBottom = H - MARGIN - 10
  const productBottom = prodY + 14 + fieldH

  const presets = [
    { scaleRowH: 18, gap: 10, formH: 66 },
    { scaleRowH: 16, gap: 8, formH: 62 },
    { scaleRowH: 14, gap: 8, formH: 58 },
    { scaleRowH: 14, gap: 6, formH: 54 }
  ]

  const feeW = 95
  const feeX = RIGHT_X + RIGHT_W - feeW

  const minFeeTop = (boxY + 14 + boxH) + 6
  let layout = null

  const tryLayout = ({ scaleRowH, gap, formH }) => {
    const scalesH = scaleRows.length * scaleRowH
    const blockH = scalesH + gap + formH

    let scaleY = productBottom + 14
    if (scaleY + blockH > maxBottom) scaleY = maxBottom - blockH

    let feeTopY = Math.min(prodY, scaleY - (fieldH + 18))
    if (feeTopY < minFeeTop) feeTopY = minFeeTop

    const feeBoxY = feeTopY + 14
    const feeBottom = feeBoxY + fieldH

    const minScaleY = feeBottom + 10
    if (scaleY < minScaleY) scaleY = minScaleY

    if (scaleY + blockH > maxBottom) return null

    const formY = scaleY + scalesH + gap
    return { scaleRowH, gap, formH, scalesH, blockH, scaleY, formY, feeTopY, feeBoxY }
  }

  for (const p of presets) {
    const res = tryLayout(p)
    if (res) { layout = res; break }
  }

  if (!layout) {
    layout = tryLayout(presets[presets.length - 1]) || {
      scaleRowH: 14, gap: 6, formH: 46,
      scalesH: scaleRows.length * 14,
      blockH: (scaleRows.length * 14) + 6 + 46,
      scaleY: Math.max(minFeeTop + 60, productBottom),
      formY: Math.max(minFeeTop + 60, productBottom) + (scaleRows.length * 14) + 6,
      feeTopY: minFeeTop,
      feeBoxY: minFeeTop + 14
    }
  }

  // ---- WEIGH FEE ----
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
  doc.text('Weigh Fee', feeX, layout.feeTopY, { width: feeW, align: 'right' })

  doc.save()
  doc.lineWidth(1)
  doc.strokeColor('#000000')
  doc.rect(feeX, layout.feeBoxY, feeW, fieldH)
  doc.stroke()
  doc.restore()

  doc.font('Helvetica').fontSize(8.5)
  doc.text(t.weigh_fee_text || '$0.00', feeX, layout.feeBoxY + 6, { width: feeW, align: 'center' })

  // ---- SCALES ----
  const scaleX = RIGHT_X
  scaleRows.forEach((row, i) => {
    const rowY = layout.scaleY + i * layout.scaleRowH

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
    doc.text(row.label, scaleX, rowY + 4, { width: scaleLabelW, align: 'right' })

    doc.save()
    doc.lineWidth(1)
    doc.strokeColor('#000000')
    doc.rect(scaleX + scaleLabelW, rowY, scaleValW, layout.scaleRowH)
    doc.stroke()
    doc.restore()

    doc.font('Helvetica').fontSize(8.5)
    doc.text(String(row.val), scaleX + scaleLabelW + 6, rowY + 4)
  })

  // ---- REWEIGH FORM ----
  const formX = RIGHT_X
  const formW = RIGHT_W

  doc.save()
  doc.lineWidth(1)
  doc.strokeColor('#000000')
  doc.rect(formX, layout.formY, formW, layout.formH)
  doc.stroke()
  doc.restore()

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
  doc.text('Reweigh Form', formX + 10, layout.formY + 6)

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
  doc.text('Ticket No:', formX + 10, layout.formY + 19)
  doc.font('Helvetica').text(t.original_ticket_number ? String(t.original_ticket_number) : '', formX + 70, layout.formY + 19)

  doc.text('Date and Time:', formX + 10, layout.formY + 32)

  const initialsY = layout.formY + (layout.formH - 16)
  doc.text('Initials:', formX + 10, initialsY)
  doc.text('____________________', formX + 70, initialsY)

  // ========== TEXAS SEAL (bottom-left) ==========
  const sealPath = path.join(__dirname, '../../../assets/images/TexasSeal.png')
  const sealSize = 65
  const sealX = contentX + 5
  const sealY = H - MARGIN - sealSize - 10

  try {
    if (fs.existsSync(sealPath)) {
      doc.image(sealPath, sealX, sealY, { fit: [sealSize, sealSize] })
    }
  } catch (e) {
    // ignore
  }
}


/**
 * Generar Excel
 *
 * FIX: Se agrega payment_summary al destructuring y se agrega el bloque
 *      "Balance Summary by Payment Method" al final del Excel.
 */
export const generateExcel = async (filters = {}) => {
  const { customer, transactions, totals, payment_summary } = await getData(filters)
  const settings = await getReportSettings()

  if (!customer) {
    throw new Error('Customer not found')
  }

  const formatDate = (date) => date ? new Date(date).toLocaleString('en-US') : '-'

  const workbook = new ExcelJS.Workbook()
  workbook.creator = settings.companyName
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Statement', {
    pageSetup: { paperSize: 9, orientation: 'landscape' }
  })

  // ========== HEADER ==========

  worksheet.mergeCells('A1:M1')
  worksheet.getCell('A1').value = settings.companyName
  worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: '2E75B6' } }
  worksheet.getCell('A1').alignment = { horizontal: 'center' }

  worksheet.mergeCells('A2:M2')
  worksheet.getCell('A2').value = 'Customer Statement'
  worksheet.getCell('A2').font = { size: 12, bold: true }
  worksheet.getCell('A2').alignment = { horizontal: 'center' }

  const dateRange = [
    filters.date_from ? `From: ${filters.date_from}` : '',
    filters.date_to ? `To: ${filters.date_to}` : ''
  ].filter(Boolean).join(' - ') || 'All time'

  worksheet.mergeCells('A3:M3')
  worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString('en-US')} | ${dateRange}`
  worksheet.getCell('A3').font = { size: 9, italic: true, color: { argb: '666666' } }
  worksheet.getCell('A3').alignment = { horizontal: 'center' }

  worksheet.mergeCells('A4:M4')
  const companyInfoLine = [
    settings.companyName || '',
    settings.companyAddress || '',
    settings.companyPhone || ''
  ].filter(Boolean).join(' | ')
  worksheet.getCell('A4').value = companyInfoLine
  worksheet.getCell('A4').font = { size: 9, color: { argb: '333333' } }
  worksheet.getCell('A4').alignment = { horizontal: 'center' }

  worksheet.addRow([])

  // ========== CUSTOMER INFO ==========
  worksheet.mergeCells('A6:M6')
  const custHeader = worksheet.getCell('A6')
  custHeader.value = 'Customer Information'
  custHeader.font = { bold: true, color: { argb: 'FFFFFF' } }
  custHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } }

  worksheet.getCell('A7').value = 'Account #:'
  worksheet.getCell('B7').value = customer.account_number
  worksheet.getCell('B7').font = { bold: true }
  worksheet.getCell('F7').value = 'Credit Type:'
  worksheet.getCell('G7').value = customer.has_credit ? customer.credit_type : 'No Credit'

  worksheet.getCell('A8').value = 'Name:'
  worksheet.getCell('B8').value = customer.account_name
  worksheet.getCell('B8').font = { bold: true }
  worksheet.getCell('F8').value = 'Credit Limit:'
  worksheet.getCell('G8').value = customer.has_credit ? parseFloat(customer.credit_limit) : 0
  worksheet.getCell('G8').numFmt = '"$"#,##0.00'

  worksheet.getCell('A9').value = 'Address:'
  worksheet.getCell('B9').value = customer.account_address || '-'
  worksheet.getCell('F9').value = 'Current Balance:'
  worksheet.getCell('G9').value = customer.has_credit ? parseFloat(customer.current_balance) : 0
  worksheet.getCell('G9').numFmt = '"$"#,##0.00'

  worksheet.getCell('A10').value = 'City/State:'
  worksheet.getCell('B10').value = `${customer.city || '-'}, ${customer.account_state || '-'}`
  worksheet.getCell('F10').value = 'Available Credit:'
  worksheet.getCell('G10').value = customer.has_credit ? parseFloat(customer.available_credit) : 0
  worksheet.getCell('G10').numFmt = '"$"#,##0.00'

  worksheet.getCell('A11').value = 'Phone:'
  worksheet.getCell('B11').value = customer.phone_number || '-'
  worksheet.getCell('A12').value = 'Tax ID:'
  worksheet.getCell('B12').value = customer.tax_id || '-'

  worksheet.addRow([])

  // ========== SUMMARY ==========
  worksheet.mergeCells('A14:M14')
  const summHeader = worksheet.getCell('A14')
  summHeader.value = 'Statement Summary'
  summHeader.font = { bold: true }
  summHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } }

  worksheet.getCell('A15').value = `Total Transactions: ${totals.total_transactions}`
  worksheet.getCell('C15').value = `Weigh: ${totals.total_weigh}`
  worksheet.getCell('D15').value = `Reweigh: ${totals.total_reweigh}`
  worksheet.getCell('F15').value = 'Total Weight:'
  worksheet.getCell('G15').value = totals.total_weight
  worksheet.getCell('G15').numFmt = '#,##0.00'

  worksheet.getCell('A16').value = `Paid: ${totals.count_paid}`
  worksheet.getCell('A16').font = { color: { argb: '28A745' } }
  worksheet.getCell('B16').value = `Pending: ${totals.count_pending}`
  worksheet.getCell('B16').font = { color: { argb: 'FFC107' } }
  worksheet.getCell('C16').value = `Cancelled: ${totals.count_cancelled}`
  worksheet.getCell('C16').font = { color: { argb: 'DC3545' } }

  worksheet.getCell('A17').value = 'Subtotal:'
  worksheet.getCell('B17').value = totals.total_subtotal
  worksheet.getCell('B17').numFmt = '"$"#,##0.00'
  worksheet.getCell('C17').value = 'Tax:'
  worksheet.getCell('D17').value = totals.total_tax
  worksheet.getCell('D17').numFmt = '"$"#,##0.00'
  worksheet.getCell('E17').value = 'Total:'
  worksheet.getCell('E17').font = { bold: true }
  worksheet.getCell('F17').value = totals.total_amount
  worksheet.getCell('F17').numFmt = '"$"#,##0.00'
  worksheet.getCell('F17').font = { bold: true }
  worksheet.getCell('G17').value = 'Paid:'
  worksheet.getCell('H17').value = totals.total_paid
  worksheet.getCell('H17').numFmt = '"$"#,##0.00'
  worksheet.getCell('H17').font = { color: { argb: '28A745' } }
  worksheet.getCell('I17').value = 'Pending:'
  worksheet.getCell('J17').value = totals.total_pending
  worksheet.getCell('J17').numFmt = '"$"#,##0.00'
  worksheet.getCell('J17').font = { color: { argb: 'DC3545' } }

  worksheet.addRow([])

  // ========== TABLA DE TRANSACCIONES ==========
  const tableStartRow = 19

  const colWidths = [14, 10, 18, 20, 12, 12, 18, 12, 12, 12, 12]
  colWidths.forEach((w, i) => worksheet.getColumn(i + 1).width = w)

  const headers = [
    'Ticket #',
    'Service',
    'Date',
    'Driver',
    'Trailer #',
    'Tractor #',
    'Scale Op',
    'Weight',
    'Total',
    'Paid',
    'Status'
  ]

  headers.forEach((h, i) => {
    const cell = worksheet.getCell(tableStartRow, i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'CCCCCC' } },
      left: { style: 'thin', color: { argb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
      right: { style: 'thin', color: { argb: 'CCCCCC' } }
    }
  })

  let currentRow = tableStartRow + 1
  transactions.forEach((row, index) => {
    const statusLabel = row.sale_status_code === 'CANCELLED' ? 'Cancelled' :
      row.payment_status_code === 'RECEIVED' ? 'Paid' :
        row.payment_status_code === 'PENDING' ? 'Pending' : '-'

    const statusColor = row.sale_status_code === 'CANCELLED' ? 'DC3545' :
      row.payment_status_code === 'RECEIVED' ? '28A745' :
        row.payment_status_code === 'PENDING' ? 'FFC107' : '666666'

    const driverName = [row.driver_first_name, row.driver_last_name]
      .filter(Boolean)
      .join(' ') || '-'

    const rowData = [
      row.ticket_number || '-',
      row.product_type || '-',
      formatDate(row.sale_date),
      driverName,
      row.trailer_number || '-',
      row.tractor_number || '-',
      row.operator_name || '-',
      parseFloat(row.gross_weight) || 0,
      parseFloat(row.total_amount) || 0,
      parseFloat(row.amount_paid) || 0,
      statusLabel
    ]

    rowData.forEach((value, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1)
      cell.value = value

      if (index % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } }
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'CCCCCC' } },
        left: { style: 'thin', color: { argb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
        right: { style: 'thin', color: { argb: 'CCCCCC' } }
      }

      if (colIndex === 8 || colIndex === 9) {
        cell.numFmt = '"$"#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }

      if (colIndex === 7) {
        cell.numFmt = '#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }

      if (colIndex === 1) {
        const typeColor = value === 'Weigh' ? '17A2B8' : '6F42C1'
        cell.font = { bold: true, color: { argb: typeColor } }
      }

      if (colIndex === 10) {
        cell.font = { bold: true, color: { argb: statusColor } }
        cell.alignment = { horizontal: 'center' }
      }
    })

    currentRow++
  })

  // ========== BALANCE SUMMARY BY PAYMENT METHOD ==========
  currentRow += 2  // espacio entre tabla y payment summary

  // Título
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`)
  const paymentTitle = worksheet.getCell(`A${currentRow}`)
  paymentTitle.value = 'Balance Summary by Payment Method'
  paymentTitle.font = { bold: true, color: { argb: 'FFFFFF' } }
  paymentTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } }
  paymentTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  for (let col = 1; col <= 3; col++) {
    worksheet.getCell(currentRow, col).border = {
      top: { style: 'thin', color: { argb: '4472C4' } },
      bottom: { style: 'thin', color: { argb: '4472C4' } },
      left: { style: 'thin', color: { argb: '4472C4' } },
      right: { style: 'thin', color: { argb: '4472C4' } }
    }
  }

  // Encabezados: Method | Qty | Amount
  currentRow++
  const pmHeaders = ['Method', 'Qty', 'Amount']
  pmHeaders.forEach((h, i) => {
    const cell = worksheet.getCell(currentRow, i + 1)
    cell.value = h
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9E2F3' } }
    cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
      left: { style: 'thin', color: { argb: 'CCCCCC' } },
      right: { style: 'thin', color: { argb: 'CCCCCC' } }
    }
  })

  // Filas de datos
  const paymentEntries = Object.values(payment_summary || {})
  paymentEntries.forEach((item, index) => {
    currentRow++
    const rowValues = [item.label, item.count, item.total]

    rowValues.forEach((value, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1)
      cell.value = value

      if (index % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F7F7F7' } }
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
        left: { style: 'thin', color: { argb: 'CCCCCC' } },
        right: { style: 'thin', color: { argb: 'CCCCCC' } }
      }

      if (colIndex === 0) {
        cell.alignment = { horizontal: 'left' }
      } else if (colIndex === 1) {
        cell.alignment = { horizontal: 'right' }
      } else if (colIndex === 2) {
        cell.numFmt = '"$"#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }
    })
  })

  // Fila de totales
  currentRow++
  const totalCount = paymentEntries.reduce((sum, item) => sum + item.count, 0)
  const totalAmount = paymentEntries.reduce((sum, item) => sum + item.total, 0)

  const totalLabelCell = worksheet.getCell(currentRow, 1)
  totalLabelCell.value = 'Total'
  totalLabelCell.font = { bold: true }
  totalLabelCell.border = {
    top: { style: 'double', color: { argb: '4472C4' } },
    bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
    left: { style: 'thin', color: { argb: 'CCCCCC' } },
    right: { style: 'thin', color: { argb: 'CCCCCC' } }
  }

  const totalQtyCell = worksheet.getCell(currentRow, 2)
  totalQtyCell.value = totalCount
  totalQtyCell.font = { bold: true }
  totalQtyCell.alignment = { horizontal: 'right' }
  totalQtyCell.border = {
    top: { style: 'double', color: { argb: '4472C4' } },
    bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
    left: { style: 'thin', color: { argb: 'CCCCCC' } },
    right: { style: 'thin', color: { argb: 'CCCCCC' } }
  }

  const totalAmtCell = worksheet.getCell(currentRow, 3)
  totalAmtCell.value = totalAmount
  totalAmtCell.numFmt = '"$"#,##0.00'
  totalAmtCell.font = { bold: true }
  totalAmtCell.alignment = { horizontal: 'right' }
  totalAmtCell.border = {
    top: { style: 'double', color: { argb: '4472C4' } },
    bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
    left: { style: 'thin', color: { argb: 'CCCCCC' } },
    right: { style: 'thin', color: { argb: 'CCCCCC' } }
  }

  return await workbook.xlsx.writeBuffer()
}

export default { getData, getFilterOptions, getCustomerInfo, generatePdf, generateExcel }