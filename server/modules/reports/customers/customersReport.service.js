import { query } from '../../../config/database.js'
import { getReportSettings } from '../reports.service.js'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// Para obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Customers Report Service
 */

/**
 * Obtener la ruta del logo
 */
const getLogoPath = (logoFilename) => {
  if (!logoFilename) return null

  // Ruta donde están los logos en el servidor
  const logoPath = path.join(__dirname, '../../../assets/images', logoFilename)

  // Verificar si existe
  if (fs.existsSync(logoPath)) {
    return logoPath
  }

  // Logo por defecto si no existe el configurado
  const defaultLogo = path.join(__dirname, '../../../assets/images/default-logo.png')
  if (fs.existsSync(defaultLogo)) {
    return defaultLogo
  }

  return null
}

/**
 * Obtener datos del reporte
 */
export const getData = async (filters = {}) => {
  const { status = 'all', has_credit = 'all' } = filters
  const params = []

  let sql = `
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
      c.is_active,
      c.created_at,
      c.updated_at,
      cc.credit_type,
      cc.credit_limit,
      cc.current_balance,
      cc.available_credit,
      cc.is_suspended
    FROM customers c
    LEFT JOIN customer_credit cc ON c.id_customer = cc.customer_id
    WHERE 1=1
  `

  if (status === 'active') {
    sql += ` AND c.is_active = 1`
  } else if (status === 'inactive') {
    sql += ` AND c.is_active = 0`
  }

  if (has_credit === 'yes') {
    sql += ` AND c.has_credit = 1`
  } else if (has_credit === 'no') {
    sql += ` AND c.has_credit = 0`
  }

  sql += ` ORDER BY c.account_name ASC`

  const data = await query(sql, params)

  const totals = {
    total: data.length,
    active: data.filter(d => d.is_active === 1).length,
    inactive: data.filter(d => d.is_active === 0).length,
    withCredit: data.filter(d => d.has_credit === 1).length,
    withoutCredit: data.filter(d => d.has_credit === 0).length,
    totalCreditLimit: data.reduce((sum, d) => sum + (parseFloat(d.credit_limit) || 0), 0),
    totalBalance: data.reduce((sum, d) => sum + (parseFloat(d.current_balance) || 0), 0)
  }

  return { data, totals }
}

/**
 * Generar PDF usando PDFKit
 */
export const generatePdf = async (filters = {}) => {
  const { data, totals } = await getData(filters)
  const settings = await getReportSettings()

  const formatCurrency = (val) => {
    if (!val) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
  }

  const logoPath = getLogoPath(settings.companyLogo)

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 40, bottom: 40, left: 40, right: 40 }
      })

      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers)
        resolve(pdfData)
      })
      doc.on('error', reject)

      // Colores
      const primaryColor = '#2E75B6'
      const headerBg = '#4472C4'
      const altRowBg = '#F2F2F2'
      const textGray = '#666666'
      const successColor = '#28a745'
      const mutedColor = '#6c757d'

      // Dimensiones
      // const pageWidth = 792
      // const pageHeight = 612
      // const marginLeft = 40
      // const marginRight = 40

      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const marginLeft = doc.page.margins.left
      const marginRight = doc.page.margins.right


      const contentWidth = pageWidth - marginLeft - marginRight
      //const footerY = pageHeight - 35
      const footerY = pageHeight - doc.page.margins.bottom - 12



      // Contar páginas necesarias
      const rowHeight = 16
      const headerAreaHeight = 85
      const tableHeaderHeight = 16
      const summaryHeight = 60
      const footerHeight = 40
      const availableForRows = pageHeight - headerAreaHeight - tableHeaderHeight - summaryHeight - footerHeight
      const rowsPerPage = Math.floor(availableForRows / rowHeight)
      const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage))

      let currentPage = 1
      let rowIndex = 0

      // ========== FUNCIÓN HEADER ==========
      const drawHeader = () => {
        const headerTop = 20
        const colWidth = contentWidth / 3
        const col1X = marginLeft
        const col2X = marginLeft + colWidth
        const col3X = marginLeft + colWidth * 2

        if (logoPath) {
          try {
            doc.image(logoPath, col1X, headerTop, { fit: [80, 45] })
          } catch (e) { /* ignore */ }
        }

        doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold')
          .text(settings.companyName, col2X, headerTop + 5, { width: colWidth, align: 'center' })

        doc.fontSize(11).fillColor('#333333').font('Helvetica-Bold')
          .text('Customers Report', col2X, headerTop + 25, { width: colWidth, align: 'center' })

        doc.fontSize(8).fillColor(textGray).font('Helvetica')
          .text(`Generated: ${new Date().toLocaleString('en-US')}`, col3X, headerTop + 10, { width: colWidth - marginRight, align: 'right' })
          .text(`Filters: Status: ${filters.status || 'All'} | Credit: ${filters.has_credit || 'All'}`, col3X, headerTop + 22, { width: colWidth - marginRight, align: 'right' })

        doc.moveTo(marginLeft, 75).lineTo(pageWidth - marginRight, 75).strokeColor('#CCCCCC').lineWidth(0.5).stroke()
      }

      // ========== FUNCIÓN FOOTER ==========
      // const drawFooter = () => {
      //   doc.fontSize(8).fillColor(textGray).font('Helvetica')
      //   doc.text(settings.companyAddress || '', marginLeft, footerY, { continued: false })
      //   doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - marginRight - 80, footerY, { width: 80, align: 'right' })
      // }
      const drawFooter = () => {
        doc.fontSize(8).fillColor(textGray).font('Helvetica')

        doc.text(settings.companyAddress || '', marginLeft, footerY, { lineBreak: false })
        doc.text(
          `Page ${currentPage} of ${totalPages}`,
          pageWidth - marginRight - 80,
          footerY,
          { width: 80, align: 'right', lineBreak: false }
        )
      }

      // ========== TABLA CONFIG ==========
      const tableLeft = marginLeft
      const colWidths = [55, 150, 60, 75, 65, 55, 70, 70, 50]
      const tableWidth = colWidths.reduce((a, b) => a + b, 0)
      const headers = ['Account #', 'Name', 'State', 'Phone', 'Tax ID', 'Credit', 'Limit', 'Balance', 'Status']

      const drawTableHeader = (y) => {
        doc.rect(tableLeft, y, tableWidth, rowHeight).fill(headerBg)
        doc.fontSize(8).fillColor('#FFFFFF').font('Helvetica-Bold')
        let xPos = tableLeft + 3
        headers.forEach((header, i) => {
          doc.text(header, xPos, y + 4, { width: colWidths[i] - 6, align: 'left' })
          xPos += colWidths[i]
        })
        return y + rowHeight
      }

      // ========== DIBUJAR PÁGINA 1 ==========
      drawHeader()
      let yPos = drawTableHeader(headerAreaHeight)

      // Dibujar filas
      while (rowIndex < data.length) {
        const row = data[rowIndex]

        // Verificar si necesitamos nueva página (dejar espacio para summary en última página)
        const isLastPage = currentPage === totalPages
        const spaceNeeded = isLastPage ? summaryHeight + footerHeight : footerHeight

        if (yPos + rowHeight > pageHeight - spaceNeeded) {
          // Dibujar footer antes de cambiar página
          drawFooter()

          // Nueva página
          doc.addPage()
          currentPage++
          drawHeader()
          yPos = drawTableHeader(headerAreaHeight)
        }

        // Fondo alternado
        if (rowIndex % 2 === 0) {
          doc.rect(tableLeft, yPos, tableWidth, rowHeight).fill(altRowBg)
        }

        // Datos
        const rowData = [
          row.account_number || '-',
          (row.account_name || '-').substring(0, 25),
          (row.account_state || '-').substring(0, 12),
          row.phone_number || '-',
          row.tax_id || '-',
          row.has_credit ? (row.credit_type || 'Yes') : 'No',
          row.has_credit ? formatCurrency(row.credit_limit) : '-',
          row.has_credit ? formatCurrency(row.current_balance) : '-',
          row.is_active ? 'Active' : 'Inactive'
        ]

        doc.fontSize(7).font('Helvetica')
        let xPos = tableLeft + 3
        rowData.forEach((cell, i) => {
          if (i === 8) {
            doc.fillColor(cell === 'Active' ? successColor : mutedColor).font('Helvetica-Bold')
          } else {
            doc.fillColor('#000000').font('Helvetica')
          }
          const align = (i === 6 || i === 7) ? 'right' : 'left'
          doc.text(String(cell), xPos, yPos + 4, { width: colWidths[i] - 6, align })
          xPos += colWidths[i]
        })

        yPos += rowHeight
        rowIndex++
      }

      // Borde de tabla
      const tableEndY = yPos
      doc.rect(tableLeft, headerAreaHeight, tableWidth, tableEndY - headerAreaHeight)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

      // ========== SUMMARY ==========
      yPos += 10
      doc.rect(tableLeft, yPos, 300, 18).fill('#E7E6E6')
      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold')
        .text('Summary', tableLeft, yPos + 4, { width: 300, align: 'center' })

      yPos += 22
      doc.fontSize(8).font('Helvetica').fillColor('#000000')
      doc.text(`Total: ${totals.total}`, tableLeft, yPos)
      doc.text(`Active: ${totals.active}`, tableLeft + 70, yPos)
      doc.text(`Inactive: ${totals.inactive}`, tableLeft + 140, yPos)
      doc.text(`With Credit: ${totals.withCredit}`, tableLeft + 220, yPos)

      yPos += 14
      doc.text(`Total Credit Limit: ${formatCurrency(totals.totalCreditLimit)}`, tableLeft, yPos)
      doc.text(`Total Balance: ${formatCurrency(totals.totalBalance)}`, tableLeft + 160, yPos)

      // Footer de última página
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

  const workbook = new ExcelJS.Workbook()
  workbook.creator = settings.companyName
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Customers', {
    pageSetup: { paperSize: 9, orientation: 'landscape' }
  })

  // Encabezado de empresa (solo columnas A-I)
  worksheet.mergeCells('A1:I1')
  worksheet.getCell('A1').value = settings.companyName
  worksheet.getCell('A1').font = { size: 18, bold: true, color: { argb: '2E75B6' } }
  worksheet.getCell('A1').alignment = { horizontal: 'center' }

  worksheet.mergeCells('A2:I2')
  worksheet.getCell('A2').value = 'Customers Report'
  worksheet.getCell('A2').font = { size: 14, bold: true }
  worksheet.getCell('A2').alignment = { horizontal: 'center' }

  worksheet.mergeCells('A3:I3')
  worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString('en-US')} | Filters: Status: ${filters.status || 'All'}, Credit: ${filters.has_credit || 'All'}`
  worksheet.getCell('A3').font = { size: 10, italic: true, color: { argb: '666666' } }
  worksheet.getCell('A3').alignment = { horizontal: 'center' }

  worksheet.addRow([])

  worksheet.getColumn(1).width = 15
  worksheet.getColumn(2).width = 35
  worksheet.getColumn(3).width = 15
  worksheet.getColumn(4).width = 15
  worksheet.getColumn(5).width = 15
  worksheet.getColumn(6).width = 12
  worksheet.getColumn(7).width = 15
  worksheet.getColumn(8).width = 15
  worksheet.getColumn(9).width = 12

  const headerRowNum = 5
  const headers = ['Account #', 'Name', 'State', 'Phone', 'Tax ID', 'Credit', 'Limit', 'Balance', 'Status']

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRowNum, index + 1)
    cell.value = header
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
  worksheet.getRow(headerRowNum).height = 20

  let currentRow = headerRowNum + 1
  data.forEach((row, index) => {
    const rowData = [
      row.account_number || '-',
      row.account_name || '-',
      row.account_state || '-',
      row.phone_number || '-',
      row.tax_id || '-',
      row.has_credit ? (row.credit_type || 'Yes') : 'No',
      row.has_credit ? parseFloat(row.credit_limit) || 0 : null,
      row.has_credit ? parseFloat(row.current_balance) || 0 : null,
      row.is_active ? 'Active' : 'Inactive'
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

      if ((colIndex === 6 || colIndex === 7) && value !== null) {
        cell.numFmt = '"$"#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }

      if (colIndex === 8) {
        cell.font = {
          color: { argb: value === 'Active' ? '28A745' : '6C757D' },
          bold: true
        }
        cell.alignment = { horizontal: 'center' }
      }
    })

    currentRow++
  })

  currentRow++

  worksheet.mergeCells(`A${currentRow}:D${currentRow}`)
  const summaryHeaderCell = worksheet.getCell(`A${currentRow}`)
  summaryHeaderCell.value = 'Summary'
  summaryHeaderCell.font = { bold: true }
  summaryHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } }
  summaryHeaderCell.alignment = { horizontal: 'center' }
  summaryHeaderCell.border = {
    top: { style: 'thin', color: { argb: 'CCCCCC' } },
    left: { style: 'thin', color: { argb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
    right: { style: 'thin', color: { argb: 'CCCCCC' } }
  }
  for (let col = 2; col <= 4; col++) {
    worksheet.getCell(currentRow, col).border = {
      top: { style: 'thin', color: { argb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
      right: col === 4 ? { style: 'thin', color: { argb: 'CCCCCC' } } : undefined
    }
  }
  currentRow++

  const summaryData = [
    `Total: ${totals.total}`,
    `Active: ${totals.active}`,
    `Inactive: ${totals.inactive}`,
    `With Credit: ${totals.withCredit}`
  ]

  summaryData.forEach((value, index) => {
    const cell = worksheet.getCell(currentRow, index + 1)
    cell.value = value
    cell.font = { bold: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'CCCCCC' } },
      left: { style: 'thin', color: { argb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
      right: { style: 'thin', color: { argb: 'CCCCCC' } }
    }
  })
  currentRow++

  worksheet.getCell(currentRow, 1).value = ''
  worksheet.getCell(currentRow, 2).value = ''

  const limitCell = worksheet.getCell(currentRow, 3)
  limitCell.value = totals.totalCreditLimit
  limitCell.numFmt = '"Total Limit: $"#,##0.00'
  limitCell.font = { bold: true }
  limitCell.border = {
    left: { style: 'thin', color: { argb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'CCCCCC' } }
  }

  const balanceCell = worksheet.getCell(currentRow, 4)
  balanceCell.value = totals.totalBalance
  balanceCell.numFmt = '"Total Balance: $"#,##0.00'
  balanceCell.font = { bold: true }
  balanceCell.border = {
    bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
    right: { style: 'thin', color: { argb: 'CCCCCC' } }
  }

  return await workbook.xlsx.writeBuffer()
}

export default { getData, generatePdf, generateExcel }
