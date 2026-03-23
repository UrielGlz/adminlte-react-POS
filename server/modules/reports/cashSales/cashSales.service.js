import { query } from '../../../config/database.js'
import { getReportSettings } from '../reports.service.js'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { formatDateTime as _formatDateTime, formatGeneratedTimestamp } from '../../../utils/dateHelpers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Cash Sales Report Service
 * Transactions without associated customer (account_number IS NULL)
 */

const getLogoPath = (logoFilename) => {
  if (!logoFilename) return null
  const logoPath = path.join(__dirname, '../../../assets/images', logoFilename)
  if (fs.existsSync(logoPath)) return logoPath
  const defaultLogo = path.join(__dirname, '../../../assets/images/default-logo.png')
  if (fs.existsSync(defaultLogo)) return defaultLogo
  return null
}

/**
 * Normaliza el método de pago a una clave estándar
 * Reutilizable por pantalla, PDF y Excel
 */
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

/**
 * Construye el resumen por método de pago en formato normalizado
 * Estructura reutilizable por pantalla, PDF y Excel
 */
const buildPaymentSummary = (transactions = []) => {
  const summary = {
    cash: { key: 'cash', label: 'Cash', count: 0, total: 0 },
    business_account: { key: 'business_account', label: 'Business Account', count: 0, total: 0 },
    card: { key: 'card', label: 'Card', count: 0, total: 0 }
  }

  transactions.forEach(row => {
    const paymentKey = normalizePaymentMethod(row.payment_method || row.payment_method_code)
    if (!paymentKey || !summary[paymentKey]) return

    summary[paymentKey].count += 1
    summary[paymentKey].total += parseFloat(row.total_amount) || 0
  })

  return summary
}

/**
 * Obtener datos del reporte
 *
 * Retorna: { transactions, totals, payment_summary }
 *
 * - transactions: array de filas para tabla principal
 * - totals: conteos y sumas para KPIs
 * - payment_summary: resumen normalizado por método de pago
 *   (Cash, Business Account, Card) — reutilizable por pantalla, PDF y Excel
 */
export const getData = async (filters = {}) => {
  const {
    date_from = null,
    date_to = null,
    payment_method = 'all',
    product_type = 'all',
    sale_status = 'all'
  } = filters

  const params = []

  let sql = `
    SELECT DISTINCT
      t.ticket_id,
      t.ticket_number,
      t.printed_at,
      s.sale_id,
      s.sale_uid,
      s.receipt_number,
      s.created_at as sale_date,
      s.subtotal,
      s.tax_total as tax_amount,
      s.total as total_amount,
      s.amount_paid,
      s.balance_due,
      p.name as product_type,
      p.code as product_code,
      ssa.weight_lb as gross_weight,
      (SELECT pm2.name 
       FROM payments pay2 
       JOIN payment_methods pm2 ON pay2.method_id = pm2.method_id 
       WHERE pay2.sale_uid = s.sale_uid 
       LIMIT 1) as payment_method,
      (SELECT pm2.code 
       FROM payments pay2 
       JOIN payment_methods pm2 ON pay2.method_id = pm2.method_id 
       WHERE pay2.sale_uid = s.sale_uid 
       LIMIT 1) as payment_method_code,
      (SELECT pay2.amount 
       FROM payments pay2 
       WHERE pay2.sale_uid = s.sale_uid 
       LIMIT 1) as payment_amount,
      (SELECT pay2.received_at 
       FROM payments pay2 
       WHERE pay2.sale_uid = s.sale_uid 
       LIMIT 1) as payment_date,
      (SELECT pay_st2.code 
       FROM payments pay2 
       JOIN status_catalogo pay_st2 ON pay2.payment_status_id = pay_st2.status_id AND pay_st2.module = 'PAYMENTS'
       WHERE pay2.sale_uid = s.sale_uid 
       LIMIT 1) as payment_status_code,
      (SELECT pay_st2.label 
       FROM payments pay2 
       JOIN status_catalogo pay_st2 ON pay2.payment_status_id = pay_st2.status_id AND pay_st2.module = 'PAYMENTS'
       WHERE pay2.sale_uid = s.sale_uid 
       LIMIT 1) as payment_status_label,
      sale_st.code as sale_status_code,
      sale_st.label as sale_status_label,
      u.full_name as operator_name,
      sdi.driver_first_name,
      sdi.driver_last_name,
      sdi.driver_phone,
      sdi.vehicle_plates,
      sdi.license_number,
      sdi.license_state,
      sdi.trailer_number,
      sdi.tractor_number,
      sdi.product_description as driver_product,
      dp.name as driver_product_name
    FROM tickets t
    JOIN sales s ON t.sale_uid = s.sale_uid
    JOIN sale_driver_info sdi ON s.sale_uid = sdi.sale_uid
    JOIN sale_lines sl ON s.sale_uid = sl.sale_uid
    JOIN products p ON sl.product_id = p.product_id
    LEFT JOIN scale_session_axles ssa ON sdi.match_key = ssa.uuid_weight
    LEFT JOIN users u ON s.operator_id = u.user_id
    LEFT JOIN status_catalogo sale_st ON s.sale_status_id = sale_st.status_id AND sale_st.module = 'SALES'
    LEFT JOIN driver_products dp ON sdi.driver_product_id = dp.product_id
    WHERE sdi.account_number IS NULL
  `

  // Filtros
  if (date_from) {
    sql += ` AND DATE(s.created_at) >= ?`
    params.push(date_from)
  }
  if (date_to) {
    sql += ` AND DATE(s.created_at) <= ?`
    params.push(date_to)
  }

  if (payment_method !== 'all') {
    sql += ` AND EXISTS (SELECT 1 FROM payments pay WHERE pay.sale_uid = s.sale_uid AND pay.method_id = ?)`
    params.push(payment_method)
  }

  if (product_type !== 'all') {
    sql += ` AND p.product_id = ?`
    params.push(product_type)
  }
  if (sale_status !== 'all') {
    sql += ` AND s.sale_status_id = ?`
    params.push(sale_status)
  }

  sql += ` ORDER BY s.created_at ASC, t.ticket_id ASC`

  const transactions = await query(sql, params)

  // payment_summary normalizado (reutilizable por pantalla, PDF y Excel)
  const payment_summary = buildPaymentSummary(transactions)

  // Totales para KPIs
  const totals = {
    total_transactions: transactions.length,
    total_weigh: transactions.filter(t => t.product_code === 'WEIGH' || t.product_type === 'Weigh').length,
    total_reweigh: transactions.filter(t => t.product_code === 'REWEIGH' || t.product_type === 'Reweigh').length,
    total_weight: transactions.reduce((sum, t) => sum + (parseFloat(t.gross_weight) || 0), 0),
    total_subtotal: transactions.reduce((sum, t) => sum + (parseFloat(t.subtotal) || 0), 0),
    total_tax: transactions.reduce((sum, t) => sum + (parseFloat(t.tax_amount) || 0), 0),
    total_amount: transactions.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0),
    total_paid: transactions.reduce((sum, t) => sum + (parseFloat(t.amount_paid) || 0), 0),
    total_pending: transactions.reduce((sum, t) => sum + (parseFloat(t.balance_due) || 0), 0),
    count_completed: transactions.filter(t => t.sale_status_code === 'COMPLETED').length,
    count_open: transactions.filter(t => t.sale_status_code === 'OPEN').length,
    count_cancelled: transactions.filter(t => t.sale_status_code === 'CANCELLED').length
  }

  return { transactions, totals, payment_summary }
}

/**
 * Obtener opciones para filtros
 */
export const getFilterOptions = async () => {
  const paymentMethods = await query(`
    SELECT method_id as value, name as label 
    FROM payment_methods 
    WHERE is_active = 1 
    ORDER BY name
  `)

  const products = await query(`
    SELECT product_id as value, name as label, code 
    FROM products 
    WHERE is_active = 1 
    ORDER BY name
  `)

  const saleStatuses = await query(`
    SELECT status_id as value, label 
    FROM status_catalogo 
    WHERE module = 'SALES' AND is_active = 1 
    ORDER BY sort_order
  `)

  return { paymentMethods, products, saleStatuses }
}

/**
 * Generar PDF
 *
 * Patrón robusto (igual que Sales Report y Customer Statement):
 * - bufferPages: true para footers con conteo real
 * - Detección dinámica de última página
 * - Summary + Balance Summary by Payment Method al final sin sobreposición
 * - Footer con "Page X of Y" real
 */
export const generatePdf = async (filters = {}) => {
  const { transactions, totals, payment_summary } = await getData(filters)
  const settings = await getReportSettings()

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
  }

  const formatNumber = (val) => {
    if (val === null || val === undefined) return '0.00'
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  const formatDateTime = _formatDateTime

  const logoPath = getLogoPath(settings.companyLogo)

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        bufferPages: true  // Para footers con conteo real de páginas
      })

      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Colores
      const primaryColor = '#17a2b8'
      const headerBg = '#138496'
      const altRowBg = '#F2F2F2'
      const textGray = '#666666'
      const successColor = '#28a745'
      const warningColor = '#ffc107'
      const dangerColor = '#dc3545'

      // Dimensiones
      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const marginLeft = doc.page.margins.left
      const marginRight = doc.page.margins.right
      const contentWidth = pageWidth - marginLeft - marginRight
      const footerY = pageHeight - doc.page.margins.bottom - 12
      const rowHeight = 12
      const headerAreaHeight = 145
      const tableHeaderHeight = 14

      // ===== Dimensiones de bloques inferiores (calculadas ANTES del render) =====
      const paymentRows = Object.values(payment_summary || {})

      const summaryBoxWidth = 500
      const summaryHeaderHeight = 16
      const summaryBodyHeight = 28
      const summaryBlockHeight = summaryHeaderHeight + summaryBodyHeight

      const paymentTableWidth = 500
      const paymentTitleHeight = 16
      const paymentHeaderHeight = 14
      const paymentRowHeight = 14
      const paymentColWidths = [260, 100, 140]
      const paymentHeaders = ['Method', 'Qty', 'Amount']
      const paymentTableHeight =
        paymentTitleHeight + paymentHeaderHeight + (paymentRows.length * paymentRowHeight)

      const gapBetweenBlocks = 8
      const bottomGapFromFooter = 8

      const totalBottomBlocksHeight =
        bottomGapFromFooter + paymentTableHeight + gapBetweenBlocks + summaryBlockHeight

      const summaryAreaTop = footerY - totalBottomBlocksHeight
      const normalPageLimit = footerY - 5

      // Fecha del reporte
      const dateRange = [
        filters.date_from ? `From: ${filters.date_from}` : '',
        filters.date_to ? `To: ${filters.date_to}` : ''
      ].filter(Boolean).join(' - ') || 'All time'

      const rightColW = 190
      const rightX = pageWidth - marginRight - rightColW

      // ========== HEADER PRINCIPAL ==========
      const drawMainHeader = () => {
        const headerTop = 15

        if (logoPath) {
          try {
            doc.image(logoPath, marginLeft, headerTop, { fit: [50, 30] })
          } catch (e) { /* ignore */ }
        }

        doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold')
          .text(settings.companyName, marginLeft + 60, headerTop + 3, { width: contentWidth - 180, align: 'center' })

        doc.fontSize(11).fillColor('#333333').font('Helvetica-Bold')
          .text('Cash Sales Report', marginLeft + 60, headerTop + 20, { width: contentWidth - 180, align: 'center' })

        doc.fontSize(8).fillColor(textGray).font('Helvetica')
          .text(`Generated: ${formatGeneratedTimestamp()}`, rightX, headerTop + 5, { width: rightColW, align: 'right', ellipsis: true })
          .text(dateRange, rightX, headerTop + 15, { width: rightColW, align: 'right', ellipsis: true })

        doc.moveTo(marginLeft, 48).lineTo(pageWidth - marginRight, 48).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        // Company info line
        const companyInfoLine = [
          settings.companyName || '',
          settings.companyAddress || '',
          settings.companyPhone || ''
        ].filter(Boolean).join(' | ')

        doc.fontSize(7).fillColor(textGray).font('Helvetica')
          .text(companyInfoLine, marginLeft, 52, { width: contentWidth, align: 'center' })

        // ========== RESUMEN CARDS ==========
        let yPos = 65

        const cardWidth = 85
        const cardHeight = 35
        const cardGap = 8
        let cardX = marginLeft

        const summaryCards = [
          { label: 'Transactions', value: totals.total_transactions, color: primaryColor },
          { label: 'Weigh', value: totals.total_weigh, color: '#17a2b8' },
          { label: 'Reweigh', value: totals.total_reweigh, color: '#6f42c1' },
          { label: 'Completed', value: totals.count_completed, color: successColor },
          { label: 'Pending', value: totals.count_open, color: warningColor },
          { label: 'Cancelled', value: totals.count_cancelled, color: dangerColor }
        ]

        summaryCards.forEach(card => {
          doc.rect(cardX, yPos, cardWidth, cardHeight).fill('#F8F9FA').stroke('#DEE2E6')
          doc.fontSize(14).fillColor(card.color).font('Helvetica-Bold')
            .text(String(card.value), cardX, yPos + 5, { width: cardWidth, align: 'center' })
          doc.fontSize(6).fillColor(textGray).font('Helvetica')
            .text(card.label, cardX, yPos + 22, { width: cardWidth, align: 'center' })
          cardX += cardWidth + cardGap
        })

        // Totales financieros
        yPos += cardHeight + 10
        doc.fontSize(7).fillColor('#333333').font('Helvetica')
        doc.text(`Total Weight: ${formatNumber(totals.total_weight)} lb`, marginLeft, yPos)
        doc.font('Helvetica-Bold').text(`Total: ${formatCurrency(totals.total_amount)}`, marginLeft + 150, yPos)
        doc.fillColor(successColor).text(`Paid: ${formatCurrency(totals.total_paid)}`, marginLeft + 280, yPos)
        doc.fillColor(dangerColor).text(`Pending: ${formatCurrency(totals.total_pending)}`, marginLeft + 400, yPos)

        // Por método de pago (inline, compacto)
        yPos += 12
        doc.fontSize(6).fillColor(textGray).font('Helvetica')
        let methodX = marginLeft
        paymentRows.forEach(item => {
          doc.text(`${item.label}: ${item.count} (${formatCurrency(item.total)})`, methodX, yPos)
          methodX += 130
        })

        return yPos + 18
      }

      // ========== HEADER SIMPLE (páginas siguientes) ==========
      const drawSimpleHeader = () => {
        doc.fontSize(10).fillColor(primaryColor).font('Helvetica-Bold')
          .text(`${settings.companyName} - Cash Sales Report`, marginLeft, 20)

        doc.moveTo(marginLeft, 35).lineTo(pageWidth - marginRight, 35).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        return 45
      }

      // ========== TABLA ==========
      const tableLeft = marginLeft
      const colWidths = [50, 45, 65, 70, 50, 50, 65, 50, 45, 50, 50, 50, 55]
      const tableWidth = colWidths.reduce((a, b) => a + b, 0)
      const headers = ['Ticket #', 'Service', 'Date', 'Driver', 'Trailer #', 'Tractor #', 'Scale Op', 'Plates', 'Weight', 'Total', 'Paid', 'Method', 'Status']

      const drawTableHeader = (y) => {
        doc.rect(tableLeft, y, tableWidth, tableHeaderHeight).fill(headerBg)
        doc.fontSize(6).fillColor('#FFFFFF').font('Helvetica-Bold')
        let xPos = tableLeft + 2
        headers.forEach((header, i) => {
          const align = i >= 8 && i <= 10 ? 'right' : 'left'
          doc.text(header, xPos, y + 4, { width: colWidths[i] - 4, align })
          xPos += colWidths[i]
        })
        return y + tableHeaderHeight
      }

      const getStatusColor = (saleStatus) => {
        if (saleStatus === 'CANCELLED') return dangerColor
        if (saleStatus === 'COMPLETED') return successColor
        if (saleStatus === 'OPEN') return warningColor
        return textGray
      }

      // ========== RENDER ==========
      let yPos = drawMainHeader()
      let tableTopY = yPos
      yPos = drawTableHeader(yPos)
      let rowIndex = 0

      while (rowIndex < transactions.length) {
        // ---------------------------------------------------------------
        // Detección dinámica de última página (patrón Sales Report)
        // ---------------------------------------------------------------
        const remainingRows = transactions.length - rowIndex
        const yAfterAllRemaining = yPos + (remainingRows * rowHeight)
        const fitsWithSummary = yAfterAllRemaining <= summaryAreaTop
        const pageLimit = fitsWithSummary ? summaryAreaTop : normalPageLimit

        if (yPos + rowHeight > pageLimit) {
          // Borde de tabla en esta página
          doc.rect(tableLeft, tableTopY, tableWidth, yPos - tableTopY)
            .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

          doc.addPage()
          yPos = drawSimpleHeader()
          tableTopY = yPos
          yPos = drawTableHeader(yPos)
          continue  // re-evaluar
        }

        // Fondo alternado
        if (rowIndex % 2 === 0) {
          doc.rect(tableLeft, yPos, tableWidth, rowHeight).fill(altRowBg)
        }

        const row = transactions[rowIndex]
        const driverName = [row.driver_first_name, row.driver_last_name].filter(Boolean).join(' ') || '-'
        const statusColor = getStatusColor(row.sale_status_code)

        const rowData = [
          row.ticket_number || '-',
          row.product_type || '-',
          formatDateTime(row.sale_date),
          driverName.length > 12 ? driverName.substring(0, 12) + '...' : driverName,
          row.trailer_number || '-',
          row.tractor_number || '-',
          row.operator_name ? (row.operator_name.length > 10 ? row.operator_name.substring(0, 10) + '...' : row.operator_name) : '-',
          row.vehicle_plates || '-',
          formatNumber(row.gross_weight),
          formatCurrency(row.total_amount),
          formatCurrency(row.amount_paid),
          row.payment_method || '-',
          row.sale_status_label || '-'
        ]

        doc.fontSize(5.5).font('Helvetica')
        let xPos = tableLeft + 2
        rowData.forEach((cell, i) => {
          if (i === 12) {
            doc.fillColor(statusColor).font('Helvetica-Bold')
          } else if (i === 1) {
            const typeColor = cell === 'Weigh' ? '#17a2b8' : '#6f42c1'
            doc.fillColor(typeColor).font('Helvetica-Bold')
          } else {
            doc.fillColor('#333333').font('Helvetica')
          }
          const align = i >= 8 && i <= 10 ? 'right' : 'left'
          doc.text(String(cell), xPos, yPos + 3, { width: colWidths[i] - 4, align })
          xPos += colWidths[i]
        })

        yPos += rowHeight
        rowIndex++
      }

      // Borde final de tabla
      doc.rect(tableLeft, tableTopY, tableWidth, yPos - tableTopY)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

      // =====================================================================
      // Si la tabla invadió la zona del summary → nueva página
      // (mismo fix adicional que Customer Statement)
      // =====================================================================
      if (yPos > summaryAreaTop) {
        doc.addPage()
        drawSimpleHeader()
      }

      // ========== SUMMARY + PAYMENT SUMMARY (anclados al fondo) ==========
      const paymentTableTop = footerY - bottomGapFromFooter - paymentTableHeight
      const summaryTop = paymentTableTop - gapBetweenBlocks - summaryBlockHeight

      // Summary general
      doc.rect(tableLeft, summaryTop, summaryBoxWidth, summaryHeaderHeight).fill('#E7E6E6')
      doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold')
        .text('Summary', tableLeft, summaryTop + 4, { width: summaryBoxWidth, align: 'center' })

      doc.fontSize(7).fillColor('#000000').font('Helvetica')
      doc.text(`Total Transactions: ${totals.total_transactions}`, tableLeft + 6, summaryTop + 22)
      doc.text(`Weigh: ${totals.total_weigh}`, tableLeft + 130, summaryTop + 22)
      doc.text(`Reweigh: ${totals.total_reweigh}`, tableLeft + 200, summaryTop + 22)
      doc.text(`Total Weight: ${formatNumber(totals.total_weight)} lb`, tableLeft + 280, summaryTop + 22)

      doc.font('Helvetica-Bold')
      doc.text(`Total: ${formatCurrency(totals.total_amount)}`, tableLeft + 6, summaryTop + 34)
      doc.fillColor(successColor).text(`Paid: ${formatCurrency(totals.total_paid)}`, tableLeft + 140, summaryTop + 34)
      doc.fillColor(dangerColor).text(`Pending: ${formatCurrency(totals.total_pending)}`, tableLeft + 300, summaryTop + 34)

      doc.rect(tableLeft, summaryTop, summaryBoxWidth, summaryBlockHeight)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

      // Balance Summary by Payment Method
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

      // =====================================================================
      // Footers con conteo REAL usando switchToPage
      // =====================================================================
      const range = doc.bufferedPageRange()
      const totalPages = range.count

      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i)
        doc.fontSize(6).fillColor(textGray).font('Helvetica')
        doc.text(settings.companyAddress || '', marginLeft, footerY, { lineBreak: false })
        doc.text(`Page ${i + 1} of ${totalPages}`, pageWidth - marginRight - 80, footerY, {
          width: 80,
          align: 'right',
          lineBreak: false
        })
      }

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Generar Excel
 *
 * Incluye: header, summary cards, tabla principal,
 *          y bloque "Balance Summary by Payment Method" al final.
 * Reutiliza totals y payment_summary de getData().
 */
export const generateExcel = async (filters = {}) => {
  const { transactions, totals, payment_summary } = await getData(filters)
  const settings = await getReportSettings()

  const formatDate = _formatDateTime

  const workbook = new ExcelJS.Workbook()
  workbook.creator = settings.companyName
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Cash Sales', {
    pageSetup: { paperSize: 9, orientation: 'landscape' }
  })

  // ========== HEADER (A..M = 13 columnas) ==========

  worksheet.mergeCells('A1:M1')
  worksheet.getCell('A1').value = settings.companyName
  worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: '17A2B8' } }
  worksheet.getCell('A1').alignment = { horizontal: 'center' }

  worksheet.mergeCells('A2:M2')
  worksheet.getCell('A2').value = 'Cash Sales Report'
  worksheet.getCell('A2').font = { size: 12, bold: true }
  worksheet.getCell('A2').alignment = { horizontal: 'center' }

  const fmtShort = (v) => v ? String(v).slice(0, 10) : ''
  const dateRange = [
    filters.date_from ? `From: ${fmtShort(filters.date_from)}` : '',
    filters.date_to ? `To: ${fmtShort(filters.date_to)}` : ''
  ].filter(Boolean).join(' | ') || 'All time'

  worksheet.mergeCells('A3:M3')
  worksheet.getCell('A3').value = `Generated: ${formatGeneratedTimestamp()} | ${dateRange}`
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

  worksheet.addRow([]) // Fila 5 vacía

  // ========== SUMMARY ==========
  worksheet.mergeCells('A6:M6')
  const summHeader = worksheet.getCell('A6')
  summHeader.value = 'Summary'
  summHeader.font = { bold: true, color: { argb: 'FFFFFF' } }
  summHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '138496' } }

  worksheet.getCell('A7').value = 'Total Transactions:'
  worksheet.getCell('B7').value = totals.total_transactions
  worksheet.getCell('C7').value = 'Weigh:'
  worksheet.getCell('D7').value = totals.total_weigh
  worksheet.getCell('E7').value = 'Reweigh:'
  worksheet.getCell('F7').value = totals.total_reweigh

  worksheet.getCell('A8').value = 'Completed:'
  worksheet.getCell('B8').value = totals.count_completed
  worksheet.getCell('B8').font = { color: { argb: '28A745' } }
  worksheet.getCell('C8').value = 'Pending:'
  worksheet.getCell('D8').value = totals.count_open
  worksheet.getCell('D8').font = { color: { argb: 'FFC107' } }
  worksheet.getCell('E8').value = 'Cancelled:'
  worksheet.getCell('F8').value = totals.count_cancelled
  worksheet.getCell('F8').font = { color: { argb: 'DC3545' } }

  worksheet.getCell('A9').value = 'Total Weight:'
  worksheet.getCell('B9').value = totals.total_weight
  worksheet.getCell('B9').numFmt = '#,##0.00'
  worksheet.getCell('C9').value = 'Total:'
  worksheet.getCell('C9').font = { bold: true }
  worksheet.getCell('D9').value = totals.total_amount
  worksheet.getCell('D9').numFmt = '"$"#,##0.00'
  worksheet.getCell('D9').font = { bold: true }
  worksheet.getCell('E9').value = 'Paid:'
  worksheet.getCell('F9').value = totals.total_paid
  worksheet.getCell('F9').numFmt = '"$"#,##0.00'
  worksheet.getCell('F9').font = { color: { argb: '28A745' } }
  worksheet.getCell('G9').value = 'Pending:'
  worksheet.getCell('H9').value = totals.total_pending
  worksheet.getCell('H9').numFmt = '"$"#,##0.00'
  worksheet.getCell('H9').font = { color: { argb: 'DC3545' } }

  worksheet.addRow([]) // Fila 10 vacía

  // ========== TABLE ==========
  const tableStartRow = 11

  const colWidths = [14, 10, 18, 18, 12, 12, 16, 12, 12, 12, 12, 14, 12]
  colWidths.forEach((w, i) => worksheet.getColumn(i + 1).width = w)

  const headers = ['Ticket #', 'Service', 'Date', 'Driver', 'Trailer #', 'Tractor #', 'Scale Op', 'Plates', 'Weight', 'Total', 'Paid', 'Method', 'Status']
  headers.forEach((h, i) => {
    const cell = worksheet.getCell(tableStartRow, i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '138496' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'CCCCCC' } },
      left: { style: 'thin', color: { argb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
      right: { style: 'thin', color: { argb: 'CCCCCC' } }
    }
  })

  // Data rows
  let currentRow = tableStartRow + 1
  transactions.forEach((row, index) => {
    const driverName = [row.driver_first_name, row.driver_last_name].filter(Boolean).join(' ') || '-'
    const statusColor = row.sale_status_code === 'CANCELLED' ? 'DC3545' :
      row.sale_status_code === 'COMPLETED' ? '28A745' :
        row.sale_status_code === 'OPEN' ? 'FFC107' : '666666'

    const rowData = [
      row.ticket_number || '-',
      row.product_type || '-',
      formatDate(row.sale_date),
      driverName,
      row.trailer_number || '-',
      row.tractor_number || '-',
      row.operator_name || '-',
      row.vehicle_plates || '-',
      parseFloat(row.gross_weight) || 0,
      parseFloat(row.total_amount) || 0,
      parseFloat(row.amount_paid) || 0,
      row.payment_method || '-',
      row.sale_status_label || '-'
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

      if (colIndex === 9 || colIndex === 10) {
        cell.numFmt = '"$"#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }

      if (colIndex === 8) {
        cell.numFmt = '#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }

      if (colIndex === 1) {
        const typeColor = value === 'Weigh' ? '17A2B8' : '6F42C1'
        cell.font = { bold: true, color: { argb: typeColor } }
      }

      if (colIndex === 12) {
        cell.font = { bold: true, color: { argb: statusColor } }
        cell.alignment = { horizontal: 'center' }
      }
    })

    currentRow++
  })

  // ========== BALANCE SUMMARY BY PAYMENT METHOD ==========
  currentRow += 2

  // Título
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`)
  const paymentTitle = worksheet.getCell(`A${currentRow}`)
  paymentTitle.value = 'Balance Summary by Payment Method'
  paymentTitle.font = { bold: true, color: { argb: 'FFFFFF' } }
  paymentTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '138496' } }
  paymentTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  for (let col = 1; col <= 3; col++) {
    worksheet.getCell(currentRow, col).border = {
      top: { style: 'thin', color: { argb: '138496' } },
      bottom: { style: 'thin', color: { argb: '138496' } },
      left: { style: 'thin', color: { argb: '138496' } },
      right: { style: 'thin', color: { argb: '138496' } }
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
    top: { style: 'double', color: { argb: '138496' } },
    bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
    left: { style: 'thin', color: { argb: 'CCCCCC' } },
    right: { style: 'thin', color: { argb: 'CCCCCC' } }
  }

  const totalQtyCell = worksheet.getCell(currentRow, 2)
  totalQtyCell.value = totalCount
  totalQtyCell.font = { bold: true }
  totalQtyCell.alignment = { horizontal: 'right' }
  totalQtyCell.border = {
    top: { style: 'double', color: { argb: '138496' } },
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
    top: { style: 'double', color: { argb: '138496' } },
    bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
    left: { style: 'thin', color: { argb: 'CCCCCC' } },
    right: { style: 'thin', color: { argb: 'CCCCCC' } }
  }

  return await workbook.xlsx.writeBuffer()
}

export default { getData, getFilterOptions, generatePdf, generateExcel }