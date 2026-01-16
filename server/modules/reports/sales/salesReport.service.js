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
 * Sales Report Service
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
    product_id = 'all',
    customer_id = 'all',
    operator_id = 'all',
    payment_method_id = 'all',
    status_id = 'all'
  } = filters

  const params = []
  
  //Query corregida con DISTINCT para evitar duplicados
  let sql = `
    SELECT DISTINCT
      s.sale_id,
      t.ticket_number,
      s.created_at,
      p.name as product_type,
      c.account_name as customer_name,
      u.full_name as operator_name,
      (SELECT pm2.name 
       FROM payments pay2 
       JOIN payment_methods pm2 ON pay2.method_id = pm2.method_id 
       WHERE pay2.sale_uid = s.sale_uid 
       LIMIT 1) as payment_method,
      st.code as status_code,
      st.label as status_label,
      ssa.weight_lb as gross_weight,
      s.subtotal,
      s.tax_total as tax_amount,
      s.total as total_amount
    FROM sales s
    JOIN sale_lines sl ON s.sale_uid = sl.sale_uid
    JOIN products p ON sl.product_id = p.product_id
    JOIN tickets t ON t.sale_uid = s.sale_uid
    JOIN sale_driver_info sdi ON s.sale_uid = sdi.sale_uid
    JOIN scale_session_axles ssa ON sdi.match_key = ssa.uuid_weight
    LEFT JOIN customers c ON sdi.account_number = c.account_number
    LEFT JOIN users u ON s.operator_id = u.user_id
    LEFT JOIN status_catalogo st ON s.sale_status_id = st.status_id AND st.module = 'SALES'
    WHERE 1=1
  `

  // Filtro por rango de fechas
  if (date_from) {
    sql += ` AND DATE(s.created_at) >= ?`
    params.push(date_from)
  }
  if (date_to) {
    sql += ` AND DATE(s.created_at) <= ?`
    params.push(date_to)
  }

  // Filtro por producto (Weigh / Reweigh)
  if (product_id && product_id !== 'all') {
    sql += ` AND sl.product_id = ?`
    params.push(product_id)
  }

  // Filtro por cliente
  if (customer_id && customer_id !== 'all') {
    sql += ` AND c.id_customer = ?`
    params.push(customer_id)
  }

  // Filtro por operador
  if (operator_id && operator_id !== 'all') {
    sql += ` AND s.operator_id = ?`
    params.push(operator_id)
  }

  // Filtro por método de pago - subconsulta para evitar duplicados
  if (payment_method_id && payment_method_id !== 'all') {
    sql += ` AND EXISTS (SELECT 1 FROM payments pay WHERE pay.sale_uid = s.sale_uid AND pay.method_id = ?)`
    params.push(payment_method_id)
  }

  // Filtro por estado
  if (status_id && status_id !== 'all') {
    sql += ` AND s.sale_status_id = ?`
    params.push(status_id)
  }

  sql += ` ORDER BY s.created_at DESC, s.sale_id DESC`

  const data = await query(sql, params)

  // Calcular totales
  const totals = {
    total_transactions: data.length,
    total_weigh: data.filter(d => d.product_type === 'Weigh').length,
    total_reweigh: data.filter(d => d.product_type === 'Reweigh').length,
    total_gross_weight: data.reduce((sum, d) => sum + (parseFloat(d.gross_weight) || 0), 0),
    total_subtotal: data.reduce((sum, d) => sum + (parseFloat(d.subtotal) || 0), 0),
    total_tax: data.reduce((sum, d) => sum + (parseFloat(d.tax_amount) || 0), 0),
    total_amount: data.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0)
  }

  return { data, totals }
}

/**
 * Obtener opciones para filtros
 */
export const getFilterOptions = async () => {
  const [products, customers, users, paymentMethods, statuses] = await Promise.all([
    query(`SELECT product_id as value, name as label FROM products WHERE is_active = 1 ORDER BY name`),
    query(`SELECT id_customer as value, account_name as label FROM customers WHERE is_active = 1 ORDER BY account_name`),
    query(`SELECT user_id as value, full_name as label FROM users WHERE is_active = 1 ORDER BY full_name`),
    query(`SELECT method_id as value, name as label FROM payment_methods WHERE is_active = 1 ORDER BY name`),
    query(`SELECT status_id as value, label as label FROM status_catalogo WHERE is_active = 1 AND module = 'SALES' ORDER BY sort_order`)
  ])

  return {
    products,
    customers,
    users,
    paymentMethods,
    statuses
  }
}

/**
 * Generar PDF
 */
export const generatePdf = async (filters = {}) => {
  const { data, totals } = await getData(filters)
  const settings = await getReportSettings()

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
  }

  const formatNumber = (val) => {
    if (val === null || val === undefined) return '-'
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    })
  }

  const logoPath = getLogoPath(settings.companyLogo)

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'LETTER', 
        layout: 'landscape',
        margins: { top: 40, bottom: 40, left: 30, right: 30 }
      })

      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Colores y dimensiones
      const primaryColor = '#2E75B6'
      const headerBg = '#4472C4'
      const altRowBg = '#F2F2F2'
      const textGray = '#666666'
      // const pageWidth = 792
      // const pageHeight = 612
      // const marginLeft = 30
      // const marginRight = 30

      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const marginLeft = doc.page.margins.left
      const marginRight = doc.page.margins.right


      const contentWidth = pageWidth - marginLeft - marginRight
      //const footerY = pageHeight - 35
      const footerY = pageHeight - doc.page.margins.bottom - 12

      const rowHeight = 14

      // Calcular páginas
      const headerAreaHeight = 85
      const summaryHeight = 70
      const footerHeight = 40
      const availableForRows = pageHeight - headerAreaHeight - 16 - summaryHeight - footerHeight
      const rowsPerPage = Math.floor(availableForRows / rowHeight)
      const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage))

      let currentPage = 1
      let rowIndex = 0

      // Filtros para mostrar
      const filterText = [
        filters.date_from ? `From: ${filters.date_from}` : '',
        filters.date_to ? `To: ${filters.date_to}` : ''
      ].filter(Boolean).join(' | ') || 'All records'

      // ========== FUNCIONES ==========
      const drawHeader = () => {
        const headerTop = 15
        const colWidth = contentWidth / 3

        if (logoPath) {
          try {
            doc.image(logoPath, marginLeft, headerTop, { fit: [70, 40] })
          } catch (e) { /* ignore */ }
        }

        doc.fontSize(13).fillColor(primaryColor).font('Helvetica-Bold')
           .text(settings.companyName, marginLeft + colWidth, headerTop + 3, { width: colWidth, align: 'center' })
        
        doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold')
           .text('Sales Report', marginLeft + colWidth, headerTop + 22, { width: colWidth, align: 'center' })

        doc.fontSize(7).fillColor(textGray).font('Helvetica')
           .text(`Generated: ${new Date().toLocaleString('en-US')}`, marginLeft + colWidth * 2, headerTop + 8, { width: colWidth - marginRight, align: 'right' })
           .text(`Filters: ${filterText}`, marginLeft + colWidth * 2, headerTop + 18, { width: colWidth - marginRight, align: 'right' })

        doc.moveTo(marginLeft, 70).lineTo(pageWidth - marginRight, 70).strokeColor('#CCCCCC').lineWidth(0.5).stroke()
      }

      const drawFooter = () => {
        doc.fontSize(7).fillColor(textGray).font('Helvetica')
        doc.text(settings.companyAddress || '', marginLeft, footerY)
        doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - marginRight - 80, footerY, { width: 80, align: 'right', lineBreak: false })
      }

      // Tabla config
      const tableLeft = marginLeft
      const colWidths = [70, 55, 90, 95, 80, 60, 60, 50, 55, 55] // Total: ~670
      const tableWidth = colWidths.reduce((a, b) => a + b, 0)
      const headers = ['Ticket #', 'Type', 'Date', 'Customer', 'Operator', 'Payment', 'Weight', 'Subtotal', 'Tax', 'Total']

      const drawTableHeader = (y) => {
        doc.rect(tableLeft, y, tableWidth, 14).fill(headerBg)
        doc.fontSize(7).fillColor('#FFFFFF').font('Helvetica-Bold')
        let xPos = tableLeft + 2
        headers.forEach((header, i) => {
          doc.text(header, xPos, y + 4, { width: colWidths[i] - 4, align: i >= 6 ? 'right' : 'left' })
          xPos += colWidths[i]
        })
        return y + 14
      }

      // ========== RENDER ==========
      drawHeader()
      let yPos = drawTableHeader(headerAreaHeight)

      while (rowIndex < data.length) {
        const row = data[rowIndex]
        const isLastPage = currentPage === totalPages
        const spaceNeeded = isLastPage ? summaryHeight + footerHeight : footerHeight

        if (yPos + rowHeight > pageHeight - spaceNeeded) {
          drawFooter()
          doc.addPage()
          currentPage++
          drawHeader()
          yPos = drawTableHeader(headerAreaHeight)
        }

        if (rowIndex % 2 === 0) {
          doc.rect(tableLeft, yPos, tableWidth, rowHeight).fill(altRowBg)
        }

        // Datos de la fila
        const rowData = [
          row.ticket_number || '-',
          row.product_type || '-',
          formatDate(row.created_at),
          (row.customer_name || 'Walk-in').substring(0, 16),
          (row.operator_name || '-').substring(0, 12),
          (row.payment_method || '-').substring(0, 10),
          formatNumber(row.gross_weight),
          formatCurrency(row.subtotal),
          formatCurrency(row.tax_amount),
          formatCurrency(row.total_amount)
        ]

        doc.fontSize(6).font('Helvetica')
        let xPos = tableLeft + 2
        rowData.forEach((cell, i) => {
          // Color por tipo de producto
          if (i === 1) {
            const typeColor = cell === 'Weigh' ? '#17a2b8' : '#6f42c1'
            doc.fillColor(typeColor).font('Helvetica-Bold')
          } else {
            doc.fillColor('#000000').font('Helvetica')
          }
          const align = i >= 6 ? 'right' : 'left'
          doc.text(String(cell), xPos, yPos + 4, { width: colWidths[i] - 4, align })
          xPos += colWidths[i]
        })

        yPos += rowHeight
        rowIndex++
      }

      // Borde tabla
      doc.rect(tableLeft, headerAreaHeight, tableWidth, yPos - headerAreaHeight)
         .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

      // ========== SUMMARY ==========
      yPos += 8
      doc.rect(tableLeft, yPos, 420, 16).fill('#E7E6E6')
      doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold')
         .text('Summary', tableLeft, yPos + 4, { width: 420, align: 'center' })

      yPos += 20
      doc.fontSize(7).font('Helvetica').fillColor('#000000')
      doc.text(`Total Transactions: ${totals.total_transactions}`, tableLeft, yPos)
      doc.text(`Weigh: ${totals.total_weigh}`, tableLeft + 110, yPos)
      doc.text(`Reweigh: ${totals.total_reweigh}`, tableLeft + 170, yPos)
      doc.text(`Total Weight: ${formatNumber(totals.total_gross_weight)} lb`, tableLeft + 250, yPos)

      yPos += 12
      doc.font('Helvetica-Bold')
      doc.text(`Subtotal: ${formatCurrency(totals.total_subtotal)}`, tableLeft, yPos)
      doc.text(`Tax: ${formatCurrency(totals.total_tax)}`, tableLeft + 120, yPos)
      doc.text(`TOTAL: ${formatCurrency(totals.total_amount)}`, tableLeft + 240, yPos)

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
  const { data, totals } = await getData(filters)
  const settings = await getReportSettings()

  const formatDate = (date) => date ? new Date(date).toLocaleString('en-US') : '-'

  const workbook = new ExcelJS.Workbook()
  workbook.creator = settings.companyName
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Sales', {
    pageSetup: { paperSize: 9, orientation: 'landscape' }
  })

  // Header
  const totalCols = 10
  worksheet.mergeCells('A1:J1')
  worksheet.getCell('A1').value = settings.companyName
  worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: '2E75B6' } }
  worksheet.getCell('A1').alignment = { horizontal: 'center' }

  worksheet.mergeCells('A2:J2')
  worksheet.getCell('A2').value = 'Sales Report'
  worksheet.getCell('A2').font = { size: 12, bold: true }
  worksheet.getCell('A2').alignment = { horizontal: 'center' }

  const filterText = [
    filters.date_from ? `From: ${filters.date_from}` : '',
    filters.date_to ? `To: ${filters.date_to}` : ''
  ].filter(Boolean).join(' | ') || 'All records'

  worksheet.mergeCells('A3:J3')
  worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString('en-US')} | ${filterText}`
  worksheet.getCell('A3').font = { size: 9, italic: true, color: { argb: '666666' } }
  worksheet.getCell('A3').alignment = { horizontal: 'center' }

  worksheet.addRow([])

  // Column widths
  const colWidths = [14, 10, 20, 22, 18, 14, 12, 12, 12, 12]
  colWidths.forEach((w, i) => worksheet.getColumn(i + 1).width = w)

  // Table header
  const headerRow = 5
  const headers = ['Ticket #', 'Type', 'Date', 'Customer', 'Operator', 'Payment', 'Weight', 'Subtotal', 'Tax', 'Total']
  
  headers.forEach((h, i) => {
    const cell = worksheet.getCell(headerRow, i + 1)
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
  let currentRow = headerRow + 1
  data.forEach((row, index) => {
    const rowData = [
      row.ticket_number || '-',
      row.product_type || '-',
      formatDate(row.created_at),
      row.customer_name || 'Walk-in',
      row.operator_name || '-',
      row.payment_method || '-',
      parseFloat(row.gross_weight) || 0,
      parseFloat(row.subtotal) || 0,
      parseFloat(row.tax_amount) || 0,
      parseFloat(row.total_amount) || 0
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

      // Currency format para subtotal, tax, total
      if (colIndex >= 7 && colIndex <= 9) {
        cell.numFmt = '"$"#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }

      // Number format for weight
      if (colIndex === 6) {
        cell.numFmt = '#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }

      // Type color (Weigh = cyan, Reweigh = purple)
      if (colIndex === 1) {
        const typeColor = value === 'Weigh' ? '17A2B8' : '6F42C1'
        cell.font = { bold: true, color: { argb: typeColor } }
      }
    })

    currentRow++
  })

  // Summary
  currentRow++
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const summaryHeader = worksheet.getCell(`A${currentRow}`)
  summaryHeader.value = 'Summary'
  summaryHeader.font = { bold: true }
  summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } }
  summaryHeader.alignment = { horizontal: 'center' }

  currentRow++
  worksheet.getCell(currentRow, 1).value = `Total: ${totals.total_transactions}`
  worksheet.getCell(currentRow, 1).font = { bold: true }
  worksheet.getCell(currentRow, 2).value = `Weigh: ${totals.total_weigh}`
  worksheet.getCell(currentRow, 3).value = `Reweigh: ${totals.total_reweigh}`
  worksheet.getCell(currentRow, 4).value = 'Total Weight:'
  worksheet.getCell(currentRow, 5).value = totals.total_gross_weight
  worksheet.getCell(currentRow, 5).numFmt = '#,##0.00'

  currentRow++
  worksheet.getCell(currentRow, 1).value = 'Subtotal:'
  worksheet.getCell(currentRow, 2).value = totals.total_subtotal
  worksheet.getCell(currentRow, 2).numFmt = '"$"#,##0.00'
  worksheet.getCell(currentRow, 3).value = 'Tax:'
  worksheet.getCell(currentRow, 4).value = totals.total_tax
  worksheet.getCell(currentRow, 4).numFmt = '"$"#,##0.00'
  worksheet.getCell(currentRow, 5).value = 'TOTAL:'
  worksheet.getCell(currentRow, 5).font = { bold: true }
  worksheet.getCell(currentRow, 6).value = totals.total_amount
  worksheet.getCell(currentRow, 6).numFmt = '"$"#,##0.00'
  worksheet.getCell(currentRow, 6).font = { bold: true }

  return await workbook.xlsx.writeBuffer()
}

export default { getData, getFilterOptions, generatePdf, generateExcel }