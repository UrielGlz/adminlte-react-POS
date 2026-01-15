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
 * Obtener datos del reporte
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
    SELECT 
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
      pm.name as payment_method,
      pm.code as payment_method_code,
      pay.amount as payment_amount,
      pay.received_at as payment_date,
      pay_st.code as payment_status_code,
      pay_st.label as payment_status_label,
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
    LEFT JOIN payments pay ON s.sale_uid = pay.sale_uid
    LEFT JOIN payment_methods pm ON pay.method_id = pm.method_id
    LEFT JOIN status_catalogo pay_st ON pay.payment_status_id = pay_st.status_id AND pay_st.module = 'PAYMENTS'
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
    sql += ` AND pm.method_id = ?`
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

  sql += ` ORDER BY s.created_at DESC, t.ticket_id DESC`

  const transactions = await query(sql, params)

  // Calcular totales
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
    // Por estado
    count_completed: transactions.filter(t => t.sale_status_code === 'COMPLETED').length,
    count_open: transactions.filter(t => t.sale_status_code === 'OPEN').length,
    count_cancelled: transactions.filter(t => t.sale_status_code === 'CANCELLED').length,
    // Por método de pago
    by_payment_method: {}
  }

  // Agrupar por método de pago
  transactions.forEach(t => {
    const method = t.payment_method || 'Unknown'
    if (!totals.by_payment_method[method]) {
      totals.by_payment_method[method] = { count: 0, amount: 0 }
    }
    totals.by_payment_method[method].count++
    totals.by_payment_method[method].amount += parseFloat(t.total_amount) || 0
  })

  return { transactions, totals }
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
 */
export const generatePdf = async (filters = {}) => {
  const { transactions, totals } = await getData(filters)
  const settings = await getReportSettings()

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
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const logoPath = getLogoPath(settings.companyLogo)

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 30, right: 30 }
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
      // const pageWidth = 792
      // const pageHeight = 612
      // const marginLeft = 30
      // const marginRight = 30
      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const marginLeft = doc.page.margins.left
      const marginRight = doc.page.margins.right

      const contentWidth = pageWidth - marginLeft - marginRight
      //const footerY = pageHeight - 25
      const footerY = pageHeight - doc.page.margins.bottom - 12

      const rowHeight = 12

      // Paginación
      const headerAreaHeight = 130
      const tableHeaderHeight = 14
      const footerHeight = 30
      const availableForRows = pageHeight - 70 - tableHeaderHeight - footerHeight
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
      const rightColW = 190;
      const rightX = pageWidth - marginRight - rightColW;

      // ========== HEADER PRINCIPAL ==========
      const drawMainHeader = () => {
        const headerTop = 15

        // Logo
        if (logoPath) {
          try {
            doc.image(logoPath, marginLeft, headerTop, { fit: [50, 30] })
          } catch (e) { /* ignore */ }
        }

        // Título
        doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold')
          .text(settings.companyName, marginLeft + 60, headerTop + 3, { width: contentWidth - 180, align: 'center' })

        doc.fontSize(11).fillColor('#333333').font('Helvetica-Bold')
          .text('Cash Sales Report', marginLeft + 60, headerTop + 20, { width: contentWidth - 180, align: 'center' })

        // doc.fontSize(8).fillColor(textGray).font('Helvetica')
        //   .text(`Generated: ${new Date().toLocaleString('en-US')}`, pageWidth - marginRight - 100, headerTop + 5, { width: 100, align: 'right' })
        //   .text(dateRange, pageWidth - marginRight - 100, headerTop + 15, { width: 100, align: 'right' })

        doc.fontSize(8).fillColor(textGray).font('Helvetica')
  .text(`Generated: ${new Date().toLocaleString('en-US')}`, rightX, headerTop + 5, { width: rightColW, align: 'right', ellipsis: true })
  .text(dateRange, rightX, headerTop + 15, { width: rightColW, align: 'right', ellipsis: true });

        // Línea
        doc.moveTo(marginLeft, 50).lineTo(pageWidth - marginRight, 50).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        // ========== RESUMEN ==========
        let yPos = 55

        // Cards de resumen
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
        doc.text(`Subtotal: ${formatCurrency(totals.total_subtotal)}`, marginLeft + 120, yPos)
        doc.text(`Tax: ${formatCurrency(totals.total_tax)}`, marginLeft + 220, yPos)
        doc.font('Helvetica-Bold').text(`Total: ${formatCurrency(totals.total_amount)}`, marginLeft + 300, yPos)
        doc.fillColor(successColor).text(`Paid: ${formatCurrency(totals.total_paid)}`, marginLeft + 400, yPos)
        doc.fillColor(dangerColor).text(`Pending: ${formatCurrency(totals.total_pending)}`, marginLeft + 500, yPos)

        // Por método de pago
        yPos += 12
        doc.fontSize(6).fillColor(textGray).font('Helvetica')
        let methodX = marginLeft
        Object.entries(totals.by_payment_method).forEach(([method, data]) => {
          doc.text(`${method}: ${data.count} (${formatCurrency(data.amount)})`, methodX, yPos)
          methodX += 130
        })

        return yPos + 18
      }

      // ========== HEADER SIMPLE (páginas siguientes) ==========
      const drawSimpleHeader = () => {
        doc.fontSize(10).fillColor(primaryColor).font('Helvetica-Bold')
          .text(`${settings.companyName} - Cash Sales Report`, marginLeft, 20)
        doc.fontSize(8).fillColor(textGray).font('Helvetica')
          .text(`Page ${currentPage} of ${totalPages}`, pageWidth - marginRight - 60, 20, { width: 60, align: 'right' })

        doc.moveTo(marginLeft, 35).lineTo(pageWidth - marginRight, 35).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        return 45
      }

      // ========== FOOTER ==========
      const drawFooter = () => {
        doc.fontSize(6).fillColor(textGray).font('Helvetica')
        doc.text(settings.companyAddress || '', marginLeft, footerY)
        doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - marginRight - 80, footerY, { width: 80, align: 'right' })
      }

      // ========== TABLA ==========
      const tableLeft = marginLeft
      const colWidths = [55, 50, 70, 80, 55, 45, 50, 50, 50, 50, 55, 55] // Total ~715
      const tableWidth = colWidths.reduce((a, b) => a + b, 0)
      const headers = ['Ticket #', 'Type', 'Date', 'Driver', 'Plates', 'Weight', 'Subtotal', 'Tax', 'Total', 'Paid', 'Method', 'Status']

      const drawTableHeader = (y) => {
        doc.rect(tableLeft, y, tableWidth, tableHeaderHeight).fill(headerBg)
        doc.fontSize(6).fillColor('#FFFFFF').font('Helvetica-Bold')
        let xPos = tableLeft + 2
        headers.forEach((header, i) => {
          const align = i >= 5 ? 'right' : 'left'
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
      const tableTopY = yPos;          // <-- real

      yPos = drawTableHeader(yPos);


      const footerGap = 8;                 // espacio entre tabla y footer
      const bottomLimit = footerY - footerGap;


      while (rowIndex < transactions.length) {
        const row = transactions[rowIndex]

        // if (yPos + rowHeight > pageHeight - footerHeight) {
        //   drawFooter()
        //   doc.addPage()
        //   currentPage++
        //   yPos = drawSimpleHeader()
        //   yPos = drawTableHeader(yPos)
        // }
        if (yPos + rowHeight > bottomLimit) {
          drawFooter();
          doc.addPage();
          currentPage++;
          yPos = drawSimpleHeader();
          yPos = drawTableHeader(yPos);
          continue;
        }

        // Fondo alternado
        if (rowIndex % 2 === 0) {
          doc.rect(tableLeft, yPos, tableWidth, rowHeight).fill(altRowBg)
        }

        const driverName = [row.driver_first_name, row.driver_last_name].filter(Boolean).join(' ') || '-'
        const statusColor = getStatusColor(row.sale_status_code)

        const rowData = [
          row.ticket_number || '-',
          row.product_type || '-',
          formatDateTime(row.sale_date),
          driverName.length > 15 ? driverName.substring(0, 15) + '...' : driverName,
          row.vehicle_plates || '-',
          formatNumber(row.gross_weight),
          formatCurrency(row.subtotal),
          formatCurrency(row.tax_amount),
          formatCurrency(row.total_amount),
          formatCurrency(row.amount_paid),
          row.payment_method || '-',
          row.sale_status_label || '-'
        ]

        doc.fontSize(5.5).font('Helvetica')
        let xPos = tableLeft + 2
        rowData.forEach((cell, i) => {
          if (i === 11) {
            doc.fillColor(statusColor).font('Helvetica-Bold')
          } else if (i === 1) {
            const typeColor = cell === 'Weigh' ? '#17a2b8' : '#6f42c1'
            doc.fillColor(typeColor).font('Helvetica-Bold')
          } else {
            doc.fillColor('#333333').font('Helvetica')
          }
          const align = i >= 5 ? 'right' : 'left'
          doc.text(String(cell), xPos, yPos + 3, { width: colWidths[i] - 4, align })
          xPos += colWidths[i]
        })

        yPos += rowHeight
        rowIndex++
      }

      // Borde tabla
      doc.rect(tableLeft, tableTopY, tableWidth, yPos - tableTopY)
  .strokeColor('#CCCCCC').lineWidth(0.5).stroke();

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
  const { transactions, totals } = await getData(filters)
  const settings = await getReportSettings()

  const formatDate = (date) => date ? new Date(date).toLocaleString('en-US') : '-'

  const workbook = new ExcelJS.Workbook()
  workbook.creator = settings.companyName
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Cash Sales', {
    pageSetup: { paperSize: 9, orientation: 'landscape' }
  })

  // ========== HEADER ==========
  worksheet.mergeCells('A1:L1')
  worksheet.getCell('A1').value = settings.companyName
  worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: '17A2B8' } }
  worksheet.getCell('A1').alignment = { horizontal: 'center' }

  worksheet.mergeCells('A2:L2')
  worksheet.getCell('A2').value = 'Cash Sales Report'
  worksheet.getCell('A2').font = { size: 12, bold: true }
  worksheet.getCell('A2').alignment = { horizontal: 'center' }




  const fmtShort = (v) => v ? String(v).slice(0, 10) : ''; // YYYY-MM-DD si viene ISO o date string

 const dateRange = [
  filters.date_from ? `From: ${fmtShort(filters.date_from)}` : '',
  filters.date_to   ? `To: ${fmtShort(filters.date_to)}`     : ''
].filter(Boolean).join(' | ') || 'All time';


  worksheet.mergeCells('A3:L3')
  worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString('en-US')} | ${dateRange}`
  worksheet.getCell('A3').font = { size: 9, italic: true, color: { argb: '666666' } }
  worksheet.getCell('A3').alignment = { horizontal: 'center' }

  worksheet.addRow([])

  // ========== SUMMARY ==========
  worksheet.mergeCells('A5:L5')
  const summHeader = worksheet.getCell('A5')
  summHeader.value = 'Summary'
  summHeader.font = { bold: true, color: { argb: 'FFFFFF' } }
  summHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '138496' } }

  worksheet.getCell('A6').value = 'Total Transactions:'
  worksheet.getCell('B6').value = totals.total_transactions
  worksheet.getCell('C6').value = 'Weigh:'
  worksheet.getCell('D6').value = totals.total_weigh
  worksheet.getCell('E6').value = 'Reweigh:'
  worksheet.getCell('F6').value = totals.total_reweigh

  worksheet.getCell('A7').value = 'Completed:'
  worksheet.getCell('B7').value = totals.count_completed
  worksheet.getCell('B7').font = { color: { argb: '28A745' } }
  worksheet.getCell('C7').value = 'Pending:'
  worksheet.getCell('D7').value = totals.count_open
  worksheet.getCell('D7').font = { color: { argb: 'FFC107' } }
  worksheet.getCell('E7').value = 'Cancelled:'
  worksheet.getCell('F7').value = totals.count_cancelled
  worksheet.getCell('F7').font = { color: { argb: 'DC3545' } }

  worksheet.getCell('A8').value = 'Total Weight:'
  worksheet.getCell('B8').value = totals.total_weight
  worksheet.getCell('B8').numFmt = '#,##0.00'
  worksheet.getCell('C8').value = 'Subtotal:'
  worksheet.getCell('D8').value = totals.total_subtotal
  worksheet.getCell('D8').numFmt = '"$"#,##0.00'
  worksheet.getCell('E8').value = 'Tax:'
  worksheet.getCell('F8').value = totals.total_tax
  worksheet.getCell('F8').numFmt = '"$"#,##0.00'
  worksheet.getCell('G8').value = 'Total:'
  worksheet.getCell('G8').font = { bold: true }
  worksheet.getCell('H8').value = totals.total_amount
  worksheet.getCell('H8').numFmt = '"$"#,##0.00'
  worksheet.getCell('H8').font = { bold: true }
  worksheet.getCell('I8').value = 'Paid:'
  worksheet.getCell('J8').value = totals.total_paid
  worksheet.getCell('J8').numFmt = '"$"#,##0.00'
  worksheet.getCell('J8').font = { color: { argb: '28A745' } }
  worksheet.getCell('K8').value = 'Pending:'
  worksheet.getCell('L8').value = totals.total_pending
  worksheet.getCell('L8').numFmt = '"$"#,##0.00'
  worksheet.getCell('L8').font = { color: { argb: 'DC3545' } }

  worksheet.addRow([])

  // ========== TABLE ==========
  const tableStartRow = 10

  const colWidths = [14, 10, 18, 18, 12, 12, 12, 10, 12, 12, 14, 12]
  colWidths.forEach((w, i) => worksheet.getColumn(i + 1).width = w)

  const headers = ['Ticket #', 'Type', 'Date', 'Driver', 'Plates', 'Weight', 'Subtotal', 'Tax', 'Total', 'Paid', 'Method', 'Status']
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
      row.vehicle_plates || '-',
      parseFloat(row.gross_weight) || 0,
      parseFloat(row.subtotal) || 0,
      parseFloat(row.tax_amount) || 0,
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

      // Formatos
      if (colIndex >= 6 && colIndex <= 9) {
        cell.numFmt = '"$"#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }
      if (colIndex === 5) {
        cell.numFmt = '#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }
      if (colIndex === 1) {
        const typeColor = value === 'Weigh' ? '17A2B8' : '6F42C1'
        cell.font = { bold: true, color: { argb: typeColor } }
      }
      if (colIndex === 11) {
        cell.font = { bold: true, color: { argb: statusColor } }
        cell.alignment = { horizontal: 'center' }
      }
    })

    currentRow++
  })

  return await workbook.xlsx.writeBuffer()
}

export default { getData, getFilterOptions, generatePdf, generateExcel }