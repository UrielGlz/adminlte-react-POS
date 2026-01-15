import { query } from '../../../config/database.js'
import { getReportSettings } from '../reports.service.js'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Customer Statement Report Service
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
      s.amount_paid,
      s.balance_due,
      p.name as product_type,
      ssa.weight_lb as gross_weight,
      pm.name as payment_method,
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
      sdi.product_description as driver_product
    FROM tickets t
    JOIN sales s ON t.sale_uid = s.sale_uid
    JOIN sale_driver_info sdi ON s.sale_uid = sdi.sale_uid
    JOIN customers c ON sdi.account_number = c.account_number
    JOIN sale_lines sl ON s.sale_uid = sl.sale_uid
    JOIN products p ON sl.product_id = p.product_id
    JOIN scale_session_axles ssa ON sdi.match_key = ssa.uuid_weight
    LEFT JOIN payments pay ON s.sale_uid = pay.sale_uid
    LEFT JOIN payment_methods pm ON pay.method_id = pm.method_id
    LEFT JOIN status_catalogo pay_st ON pay.payment_status_id = pay_st.status_id AND pay_st.module = 'PAYMENTS'
    LEFT JOIN status_catalogo sale_st ON s.sale_status_id = sale_st.status_id AND sale_st.module = 'SALES'
    LEFT JOIN status_catalogo ticket_st ON t.ticket_status_id = ticket_st.status_id AND ticket_st.module = 'TICKETS'
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

  sql += ` ORDER BY s.created_at DESC, t.ticket_id DESC`

  return await query(sql, params)
}

/**
 * Obtener datos completos del reporte
 */
export const getData = async (filters = {}) => {
  const { customer_id, date_from = null, date_to = null } = filters

  if (!customer_id || customer_id === 'all') {
    return { customer: null, transactions: [], totals: {} }
  }

  const customer = await getCustomerInfo(customer_id)
  if (!customer) {
    return { customer: null, transactions: [], totals: {} }
  }

  const transactions = await getCustomerTransactions(customer_id, date_from, date_to)

  // Calcular totales del período
  const totals = {
    total_transactions: transactions.length,
    total_weigh: transactions.filter(t => t.product_type === 'Weigh').length,
    total_reweigh: transactions.filter(t => t.product_type === 'Reweigh').length,
    total_weight: transactions.reduce((sum, t) => sum + (parseFloat(t.gross_weight) || 0), 0),
    total_subtotal: transactions.reduce((sum, t) => sum + (parseFloat(t.subtotal) || 0), 0),
    total_tax: transactions.reduce((sum, t) => sum + (parseFloat(t.tax_amount) || 0), 0),
    total_amount: transactions.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0),
    total_paid: transactions.reduce((sum, t) => sum + (parseFloat(t.amount_paid) || 0), 0),
    total_pending: transactions.reduce((sum, t) => sum + (parseFloat(t.balance_due) || 0), 0),
    // Por estado de pago
    count_paid: transactions.filter(t => t.payment_status_code === 'RECEIVED').length,
    count_pending: transactions.filter(t => t.payment_status_code === 'PENDING').length,
    count_cancelled: transactions.filter(t => t.sale_status_code === 'CANCELLED').length
  }

  return { customer, transactions, totals }
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

/**
 * Generar PDF
 */
export const generatePdf = async (filters = {}) => {
  const { customer, transactions, totals } = await getData(filters)
  const settings = await getReportSettings()

  if (!customer) {
    throw new Error('Customer not found')
  }

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
  }

  const formatNumber = (val) => {
    if (val === null || val === undefined) return '0.00'
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric'
    })
  }

  const formatDateTime = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const logoPath = getLogoPath(settings.companyLogo)

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'LETTER', 
        layout: 'portrait',
        margins: { top: 40, bottom: 40, left: 40, right: 40 }
      })

      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Colores
      const primaryColor = '#2E75B6'
      const headerBg = '#4472C4'
      const altRowBg = '#F2F2F2'
      const textGray = '#666666'
      const successColor = '#28a745'
      const warningColor = '#ffc107'
      const dangerColor = '#dc3545'

      // Dimensiones
      const pageWidth = 612
      const pageHeight = 792
      const marginLeft = 40
      const marginRight = 40
      const contentWidth = pageWidth - marginLeft - marginRight
      const footerY = pageHeight - 35
      const rowHeight = 14

      // Variables de paginación
      const headerAreaHeight = 200 // Header + Customer Info + Summary
      const tableHeaderHeight = 16
      const summaryHeight = 0 // Ya está arriba
      const footerHeight = 40
      const availableForRows = pageHeight - 100 - tableHeaderHeight - footerHeight // Para páginas siguientes
      const rowsFirstPage = Math.floor((pageHeight - headerAreaHeight - tableHeaderHeight - footerHeight) / rowHeight)
      const rowsPerPage = Math.floor(availableForRows / rowHeight)
      
      const totalPages = Math.max(1, Math.ceil((transactions.length - rowsFirstPage) / rowsPerPage) + 1)
      let currentPage = 1
      let rowIndex = 0

      // Fecha del reporte
      const dateRange = [
        filters.date_from ? `From: ${filters.date_from}` : '',
        filters.date_to ? `To: ${filters.date_to}` : ''
      ].filter(Boolean).join(' - ') || 'All time'

      // ========== HEADER PRINCIPAL (solo primera página) ==========
      const drawMainHeader = () => {
        const headerTop = 20

        // Logo
        if (logoPath) {
          try {
            doc.image(logoPath, marginLeft, headerTop, { fit: [60, 35] })
          } catch (e) { /* ignore */ }
        }

        // Título
        doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold')
           .text(settings.companyName, marginLeft + 70, headerTop + 5, { width: contentWidth - 140, align: 'center' })
        
        doc.fontSize(11).fillColor('#333333').font('Helvetica-Bold')
           .text('Customer Statement', marginLeft + 70, headerTop + 22, { width: contentWidth - 140, align: 'center' })

        // Fecha generación
        doc.fontSize(8).fillColor(textGray).font('Helvetica')
           .text(`Generated: ${new Date().toLocaleString('en-US')}`, pageWidth - marginRight - 120, headerTop + 8, { width: 120, align: 'right' })
           .text(dateRange, pageWidth - marginRight - 120, headerTop + 20, { width: 120, align: 'right' })

        // Línea separadora
        doc.moveTo(marginLeft, 65).lineTo(pageWidth - marginRight, 65).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        // ========== INFORMACIÓN DEL CLIENTE ==========
        let yPos = 75

        doc.rect(marginLeft, yPos, contentWidth, 18).fill(headerBg)
        doc.fontSize(10).fillColor('#FFFFFF').font('Helvetica-Bold')
           .text('Customer Information', marginLeft + 5, yPos + 4)
        
        yPos += 22

        // Columna izquierda
        doc.fontSize(8).fillColor('#333333').font('Helvetica')
        doc.text(`Account #: `, marginLeft, yPos, { continued: true }).font('Helvetica-Bold').text(customer.account_number)
        doc.font('Helvetica').text(`Name: `, marginLeft, yPos + 12, { continued: true }).font('Helvetica-Bold').text(customer.account_name)
        doc.font('Helvetica').text(`Address: ${customer.account_address || '-'}`, marginLeft, yPos + 24)
        doc.text(`City: ${customer.city || '-'}, ${customer.account_state || '-'}`, marginLeft, yPos + 36)
        doc.text(`Phone: ${customer.phone_number || '-'}`, marginLeft, yPos + 48)
        doc.text(`Tax ID: ${customer.tax_id || '-'}`, marginLeft, yPos + 60)

        // Columna derecha - Crédito
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

        // ========== RESUMEN DEL PERÍODO ==========
        doc.rect(marginLeft, yPos, contentWidth, 18).fill('#E7E6E6')
        doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold')
           .text('Statement Summary', marginLeft + 5, yPos + 4)

        yPos += 22
        doc.fontSize(8).font('Helvetica')

        // Fila 1: Conteos
        doc.text(`Total Transactions: ${totals.total_transactions}`, marginLeft, yPos)
        doc.text(`Weigh: ${totals.total_weigh}`, marginLeft + 100, yPos)
        doc.text(`Reweigh: ${totals.total_reweigh}`, marginLeft + 160, yPos)
        doc.text(`Total Weight: ${formatNumber(totals.total_weight)} lb`, marginLeft + 240, yPos)

        // Fila 2: Estados
        yPos += 12
        doc.fillColor(successColor).text(`Paid: ${totals.count_paid}`, marginLeft, yPos)
        doc.fillColor(warningColor).text(`Pending: ${totals.count_pending}`, marginLeft + 60, yPos)
        doc.fillColor(dangerColor).text(`Cancelled: ${totals.count_cancelled}`, marginLeft + 130, yPos)

        // Fila 3: Montos
        yPos += 12
        doc.fillColor('#333333').font('Helvetica-Bold')
        doc.text(`Subtotal: ${formatCurrency(totals.total_subtotal)}`, marginLeft, yPos)
        doc.text(`Tax: ${formatCurrency(totals.total_tax)}`, marginLeft + 110, yPos)
        doc.text(`Total: ${formatCurrency(totals.total_amount)}`, marginLeft + 200, yPos)
        doc.fillColor(successColor).text(`Paid: ${formatCurrency(totals.total_paid)}`, marginLeft + 310, yPos)
        doc.fillColor(dangerColor).text(`Pending: ${formatCurrency(totals.total_pending)}`, marginLeft + 410, yPos)

        return yPos + 25 // Retorna posición Y para la tabla
      }

      // ========== HEADER SIMPLIFICADO (páginas siguientes) ==========
      const drawSimpleHeader = () => {
        doc.fontSize(10).fillColor(primaryColor).font('Helvetica-Bold')
           .text(`${settings.companyName} - Customer Statement`, marginLeft, 25)
        doc.fontSize(9).fillColor('#333333').font('Helvetica')
           .text(`${customer.account_name} (${customer.account_number})`, marginLeft, 40)
        doc.fontSize(8).fillColor(textGray)
           .text(`Page ${currentPage} of ${totalPages}`, pageWidth - marginRight - 60, 30, { width: 60, align: 'right' })

        doc.moveTo(marginLeft, 55).lineTo(pageWidth - marginRight, 55).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        return 65 // Retorna posición Y para la tabla
      }

      // ========== FOOTER ==========
      const drawFooter = () => {
        doc.fontSize(7).fillColor(textGray).font('Helvetica')
        doc.text(settings.companyAddress || '', marginLeft, footerY)
        doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - marginRight - 60, footerY, { width: 60, align: 'right' })
      }

      // ========== TABLA DE TRANSACCIONES ==========
      const tableLeft = marginLeft
      const colWidths = [60, 45, 70, 45, 50, 50, 50, 55, 55] // Total: 480 (para portrait)
      const tableWidth = colWidths.reduce((a, b) => a + b, 0)
      const headers = ['Ticket #', 'Type', 'Date', 'Weight', 'Subtotal', 'Tax', 'Total', 'Paid', 'Status']

      const drawTableHeader = (y) => {
        doc.rect(tableLeft, y, tableWidth, tableHeaderHeight).fill(headerBg)
        doc.fontSize(7).fillColor('#FFFFFF').font('Helvetica-Bold')
        let xPos = tableLeft + 2
        headers.forEach((header, i) => {
          const align = i >= 3 ? 'right' : 'left'
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

      // ========== RENDER PRIMERA PÁGINA ==========
      let yPos = drawMainHeader()
      yPos = drawTableHeader(yPos)

      // Dibujar filas
      while (rowIndex < transactions.length) {
        const row = transactions[rowIndex]
        
        // Verificar si necesitamos nueva página
        const maxRows = currentPage === 1 ? rowsFirstPage : rowsPerPage
        const rowsDrawn = currentPage === 1 ? rowIndex : rowIndex - rowsFirstPage - (currentPage - 2) * rowsPerPage

        if (yPos + rowHeight > pageHeight - footerHeight) {
          drawFooter()
          doc.addPage()
          currentPage++
          yPos = drawSimpleHeader()
          yPos = drawTableHeader(yPos)
        }

        // Fondo alternado
        if (rowIndex % 2 === 0) {
          doc.rect(tableLeft, yPos, tableWidth, rowHeight).fill(altRowBg)
        }

        // Datos
        const statusColor = getStatusColor(row.payment_status_code, row.sale_status_code)
        const statusLabel = getStatusLabel(row.payment_status_code, row.sale_status_code)

        const rowData = [
          row.ticket_number || '-',
          row.product_type || '-',
          formatDateTime(row.sale_date),
          formatNumber(row.gross_weight),
          formatCurrency(row.subtotal),
          formatCurrency(row.tax_amount),
          formatCurrency(row.total_amount),
          formatCurrency(row.amount_paid),
          statusLabel
        ]

        doc.fontSize(6).font('Helvetica')
        let xPos = tableLeft + 2
        rowData.forEach((cell, i) => {
          if (i === 8) {
            doc.fillColor(statusColor).font('Helvetica-Bold')
          } else if (i === 1) {
            const typeColor = cell === 'Weigh' ? '#17a2b8' : '#6f42c1'
            doc.fillColor(typeColor).font('Helvetica-Bold')
          } else {
            doc.fillColor('#333333').font('Helvetica')
          }
          const align = i >= 3 ? 'right' : 'left'
          doc.text(String(cell), xPos, yPos + 4, { width: colWidths[i] - 4, align })
          xPos += colWidths[i]
        })

        yPos += rowHeight
        rowIndex++
      }

      // Borde de tabla
      const tableStartY = currentPage === 1 ? headerAreaHeight : 65
      doc.rect(tableLeft, tableStartY, tableWidth, yPos - tableStartY)
         .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

      drawFooter()
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Generar Excel
 */
export const generateExcel = async (filters = {}) => {
  const { customer, transactions, totals } = await getData(filters)
  const settings = await getReportSettings()

  if (!customer) {
    throw new Error('Customer not found')
  }

  const formatDate = (date) => date ? new Date(date).toLocaleString('en-US') : '-'

  const workbook = new ExcelJS.Workbook()
  workbook.creator = settings.companyName
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Statement', {
    pageSetup: { paperSize: 9, orientation: 'portrait' }
  })

  // ========== HEADER ==========
  worksheet.mergeCells('A1:I1')
  worksheet.getCell('A1').value = settings.companyName
  worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: '2E75B6' } }
  worksheet.getCell('A1').alignment = { horizontal: 'center' }

  worksheet.mergeCells('A2:I2')
  worksheet.getCell('A2').value = 'Customer Statement'
  worksheet.getCell('A2').font = { size: 12, bold: true }
  worksheet.getCell('A2').alignment = { horizontal: 'center' }

  const dateRange = [
    filters.date_from ? `From: ${filters.date_from}` : '',
    filters.date_to ? `To: ${filters.date_to}` : ''
  ].filter(Boolean).join(' - ') || 'All time'

  worksheet.mergeCells('A3:I3')
  worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString('en-US')} | ${dateRange}`
  worksheet.getCell('A3').font = { size: 9, italic: true, color: { argb: '666666' } }
  worksheet.getCell('A3').alignment = { horizontal: 'center' }

  worksheet.addRow([])

  // ========== CUSTOMER INFO ==========
  worksheet.mergeCells('A5:I5')
  const custHeader = worksheet.getCell('A5')
  custHeader.value = 'Customer Information'
  custHeader.font = { bold: true, color: { argb: 'FFFFFF' } }
  custHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } }

  worksheet.getCell('A6').value = 'Account #:'
  worksheet.getCell('B6').value = customer.account_number
  worksheet.getCell('B6').font = { bold: true }
  worksheet.getCell('E6').value = 'Credit Type:'
  worksheet.getCell('F6').value = customer.has_credit ? customer.credit_type : 'No Credit'

  worksheet.getCell('A7').value = 'Name:'
  worksheet.getCell('B7').value = customer.account_name
  worksheet.getCell('B7').font = { bold: true }
  worksheet.getCell('E7').value = 'Credit Limit:'
  worksheet.getCell('F7').value = customer.has_credit ? parseFloat(customer.credit_limit) : 0
  worksheet.getCell('F7').numFmt = '"$"#,##0.00'

  worksheet.getCell('A8').value = 'Address:'
  worksheet.getCell('B8').value = customer.account_address || '-'
  worksheet.getCell('E8').value = 'Current Balance:'
  worksheet.getCell('F8').value = customer.has_credit ? parseFloat(customer.current_balance) : 0
  worksheet.getCell('F8').numFmt = '"$"#,##0.00'

  worksheet.getCell('A9').value = 'City/State:'
  worksheet.getCell('B9').value = `${customer.city || '-'}, ${customer.account_state || '-'}`
  worksheet.getCell('E9').value = 'Available Credit:'
  worksheet.getCell('F9').value = customer.has_credit ? parseFloat(customer.available_credit) : 0
  worksheet.getCell('F9').numFmt = '"$"#,##0.00'

  worksheet.getCell('A10').value = 'Phone:'
  worksheet.getCell('B10').value = customer.phone_number || '-'
  worksheet.getCell('A11').value = 'Tax ID:'
  worksheet.getCell('B11').value = customer.tax_id || '-'

  worksheet.addRow([])

  // ========== SUMMARY ==========
  worksheet.mergeCells('A13:I13')
  const summHeader = worksheet.getCell('A13')
  summHeader.value = 'Statement Summary'
  summHeader.font = { bold: true }
  summHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } }

  worksheet.getCell('A14').value = `Total Transactions: ${totals.total_transactions}`
  worksheet.getCell('C14').value = `Weigh: ${totals.total_weigh}`
  worksheet.getCell('D14').value = `Reweigh: ${totals.total_reweigh}`
  worksheet.getCell('F14').value = 'Total Weight:'
  worksheet.getCell('G14').value = totals.total_weight
  worksheet.getCell('G14').numFmt = '#,##0.00'

  worksheet.getCell('A15').value = `Paid: ${totals.count_paid}`
  worksheet.getCell('A15').font = { color: { argb: '28A745' } }
  worksheet.getCell('B15').value = `Pending: ${totals.count_pending}`
  worksheet.getCell('B15').font = { color: { argb: 'FFC107' } }
  worksheet.getCell('C15').value = `Cancelled: ${totals.count_cancelled}`
  worksheet.getCell('C15').font = { color: { argb: 'DC3545' } }

  worksheet.getCell('A16').value = 'Subtotal:'
  worksheet.getCell('B16').value = totals.total_subtotal
  worksheet.getCell('B16').numFmt = '"$"#,##0.00'
  worksheet.getCell('C16').value = 'Tax:'
  worksheet.getCell('D16').value = totals.total_tax
  worksheet.getCell('D16').numFmt = '"$"#,##0.00'
  worksheet.getCell('E16').value = 'Total:'
  worksheet.getCell('E16').font = { bold: true }
  worksheet.getCell('F16').value = totals.total_amount
  worksheet.getCell('F16').numFmt = '"$"#,##0.00'
  worksheet.getCell('F16').font = { bold: true }
  worksheet.getCell('G16').value = 'Paid:'
  worksheet.getCell('H16').value = totals.total_paid
  worksheet.getCell('H16').numFmt = '"$"#,##0.00'
  worksheet.getCell('H16').font = { color: { argb: '28A745' } }

  worksheet.addRow([])

  // ========== TABLA DE TRANSACCIONES ==========
  const tableStartRow = 18

  // Column widths
  const colWidths = [14, 10, 18, 12, 12, 12, 12, 12, 12]
  colWidths.forEach((w, i) => worksheet.getColumn(i + 1).width = w)

  // Header
  const headers = ['Ticket #', 'Type', 'Date', 'Weight', 'Subtotal', 'Tax', 'Total', 'Paid', 'Status']
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

  // Data rows
  let currentRow = tableStartRow + 1
  transactions.forEach((row, index) => {
    const statusLabel = row.sale_status_code === 'CANCELLED' ? 'Cancelled' :
                        row.payment_status_code === 'RECEIVED' ? 'Paid' :
                        row.payment_status_code === 'PENDING' ? 'Pending' : '-'

    const statusColor = row.sale_status_code === 'CANCELLED' ? 'DC3545' :
                        row.payment_status_code === 'RECEIVED' ? '28A745' :
                        row.payment_status_code === 'PENDING' ? 'FFC107' : '666666'

    const rowData = [
      row.ticket_number || '-',
      row.product_type || '-',
      formatDate(row.sale_date),
      parseFloat(row.gross_weight) || 0,
      parseFloat(row.subtotal) || 0,
      parseFloat(row.tax_amount) || 0,
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

      // Currency format
      if (colIndex >= 4 && colIndex <= 7) {
        cell.numFmt = '"$"#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }

      // Weight format
      if (colIndex === 3) {
        cell.numFmt = '#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }

      // Type color
      if (colIndex === 1) {
        const typeColor = value === 'Weigh' ? '17A2B8' : '6F42C1'
        cell.font = { bold: true, color: { argb: typeColor } }
      }

      // Status color
      if (colIndex === 8) {
        cell.font = { bold: true, color: { argb: statusColor } }
        cell.alignment = { horizontal: 'center' }
      }
    })

    currentRow++
  })

  return await workbook.xlsx.writeBuffer()
}

export default { getData, getFilterOptions, getCustomerInfo, generatePdf, generateExcel }