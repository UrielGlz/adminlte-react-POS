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
 * Missed Transactions Report Service
 *
 * Muestra TODAS las capturas de báscula (scale_session_axles),
 * agrupadas por uuid_weight (una fila por uuid),
 * diferenciando si fueron usadas (matched en sale_driver_info) o no (missed).
 *
 * Estrategia de agrupación:
 * - Se usa MIN(id) como id representativo del grupo
 * - Se toma MAX(captured_local) como fecha (en caso de duplicados, la más reciente)
 * - eje1, eje2, eje3, peso_total, weight_lb se toman con MAX() ya que para el mismo
 *   uuid_weight deben ser idénticos; MAX() es determinista y seguro
 * - operator_id se toma con MAX() (mismo criterio)
 * - is_matched: EXISTS en sale_driver_info.match_key
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
 *
 * Retorna: { data, totals }
 * - data: array con una fila por uuid_weight
 * - totals: conteos y sumas para KPIs
 */
export const getData = async (filters = {}) => {
  const { date_from = null, date_to = null } = filters
  const params = []

  let sql = `
    SELECT
      MIN(ssa.id) as id,
      ssa.uuid_weight,
      MAX(ssa.captured_local) as captured_local,
      MAX(ssa.weight_lb) as weight_lb,
      MAX(ssa.eje1) as eje1,
      MAX(ssa.eje2) as eje2,
      MAX(ssa.eje3) as eje3,
      MAX(ssa.peso_total) as peso_total,
      MAX(ssa.operator_id) as operator_id,
      MAX(u.full_name) as operator_name,
      MAX(vr.label) as missed_reason,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM sale_driver_info sdi
          WHERE sdi.match_key = ssa.uuid_weight
        ) THEN 1
        ELSE 0
      END as is_matched
    FROM scale_session_axles ssa
    LEFT JOIN users u ON ssa.operator_id = u.user_id
    LEFT JOIN void_reasons vr ON ssa.missed_reason_id = vr.void_reason_id
    WHERE 1=1
  `

  if (date_from) {
    sql += ` AND DATE(ssa.captured_local) >= ?`
    params.push(date_from)
  }
  if (date_to) {
    sql += ` AND DATE(ssa.captured_local) <= ?`
    params.push(date_to)
  }

  sql += `
    GROUP BY ssa.uuid_weight
    ORDER BY MAX(ssa.captured_local) DESC
  `

  const allData = await query(sql, params)

  const total_captures = allData.length
  const matched_count = allData.filter(d => d.is_matched === 1).length
  const unmatched_count = allData.filter(d => d.is_matched === 0).length

  const totals = {
    total_captures,
    matched_count,
    matched_percent: total_captures ? ((matched_count / total_captures) * 100).toFixed(1) : '0.0',
    unmatched_count,
    unmatched_percent: total_captures ? ((unmatched_count / total_captures) * 100).toFixed(1) : '0.0',
    total_missed_weight: allData.filter(d => d.is_matched === 0).reduce((sum, d) => sum + (parseFloat(d.weight_lb) || 0), 0),
  }

  // Solo retornamos las Missed
  const data = allData.filter(d => d.is_matched === 0)

  return { data, totals }
}

/**
 * Obtener opciones para filtros (por ahora solo fechas, placeholder)
 */
export const getFilterOptions = async () => {
  return {}
}

/**
 * Generar PDF
 *
 * Patrón robusto:
 * - bufferPages: true para footers con conteo real
 * - Detección dinámica de última página
 * - Summary al final sin sobreposición
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

  const formatDateTime = _formatDateTime

  const formatInt = (val) => {
    if (val === null || val === undefined) return '0'
    return String(Math.round(Number(val) || 0))
  }

  const logoPath = getLogoPath(settings.companyLogo)

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        bufferPages: true
      })

      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Colores
      const primaryColor = '#6f42c1'
      const headerBg = '#5a32a3'
      const altRowBg = '#F2F2F2'
      const textGray = '#666666'
      const successColor = '#28a745'
      const dangerColor = '#dc3545'

      // Dimensiones
      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const marginLeft = doc.page.margins.left
      const marginRight = doc.page.margins.right
      const contentWidth = pageWidth - marginLeft - marginRight
      const footerY = pageHeight - doc.page.margins.bottom - 12
      const rowHeight = 12
      const headerAreaHeight = 100

      // Summary block dimensions
      const summaryBoxWidth = 500
      const summaryHeaderHeight = 16
      const summaryBodyHeight = 16
      const summaryBlockHeight = summaryHeaderHeight + summaryBodyHeight
      const bottomGapFromFooter = 8
      const totalBottomBlocksHeight = bottomGapFromFooter + summaryBlockHeight
      const summaryAreaTop = footerY - totalBottomBlocksHeight
      const normalPageLimit = footerY - 5

      // Filter text
      const filterText = [
        filters.date_from ? `From: ${filters.date_from}` : '',
        filters.date_to ? `To: ${filters.date_to}` : ''
      ].filter(Boolean).join(' | ') || 'All records'

      const rightColW = 190
      const rightX = pageWidth - marginRight - rightColW

      // ========== HEADER ==========
      const drawMainHeader = () => {
        const headerTop = 15

        if (logoPath) {
          try {
            doc.image(logoPath, marginLeft, headerTop, { fit: [50, 30] })
          } catch (e) { /* ignore */ }
        }

        doc.fontSize(13).fillColor(primaryColor).font('Helvetica-Bold')
          .text(settings.companyName, marginLeft + 60, headerTop + 3, { width: contentWidth - 180, align: 'center' })

        doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold')
          .text('Missed Transactions Report', marginLeft + 60, headerTop + 20, { width: contentWidth - 180, align: 'center' })

        doc.fontSize(7).fillColor(textGray).font('Helvetica')
          .text(`Generated: ${formatGeneratedTimestamp()}`, rightX, headerTop + 5, { width: rightColW, align: 'right' })
          .text(`Filters: ${filterText}`, rightX, headerTop + 15, { width: rightColW, align: 'right' })

        doc.moveTo(marginLeft, 48).lineTo(pageWidth - marginRight, 48).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        // Summary cards inline
        let yPos = 55
        doc.fontSize(7).font('Helvetica-Bold')

        doc.fillColor('#333333').text(`Total Captures: ${totals.total_captures}`, marginLeft, yPos)
        doc.fillColor(successColor).text(`Completed: ${totals.matched_count} (${totals.matched_percent}%)`, marginLeft + 130, yPos)
        doc.fillColor(dangerColor).text(`Missed: ${totals.unmatched_count} (${totals.unmatched_percent}%)`, marginLeft + 270, yPos)

        doc.moveTo(marginLeft, 70).lineTo(pageWidth - marginRight, 70).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        return 78
      }

      const drawSimpleHeader = () => {
        doc.fontSize(10).fillColor(primaryColor).font('Helvetica-Bold')
          .text(`${settings.companyName} - Missed Transactions Report`, marginLeft, 20)

        doc.moveTo(marginLeft, 35).lineTo(pageWidth - marginRight, 35).strokeColor('#CCCCCC').lineWidth(0.5).stroke()

        return 45
      }

      // ========== TABLE ==========
      const tableLeft = marginLeft
      // #, ID, UUID, Date/Time, Weight lb, Eje1, Eje2, Eje3, Total, Operator, Status, Reason
      const colWidths = [25, 35, 110, 70, 50, 45, 45, 45, 50, 75, 50, 70]
      const tableWidth = colWidths.reduce((a, b) => a + b, 0)
      const headers = ['#', 'ID', 'UUID', 'Date/Time', 'Weight', 'Axle 1', 'Axle 2', 'Axle 3', 'Total', 'Operator', 'Status', 'Reason']
      const tableHeaderHeight = 14

      const drawTableHeader = (y) => {
        doc.rect(tableLeft, y, tableWidth, tableHeaderHeight).fill(headerBg)
        doc.fontSize(6).fillColor('#FFFFFF').font('Helvetica-Bold')
        let xPos = tableLeft + 2
        headers.forEach((header, i) => {
          const align = (i >= 4 && i <= 8) ? 'right' : (i === 10 ? 'center' : 'left')
          doc.text(header, xPos, y + 4, { width: colWidths[i] - 4, align })
          xPos += colWidths[i]
        })
        return y + tableHeaderHeight
      }

      // ========== RENDER ==========
      let yPos = drawMainHeader()
      let tableTopY = yPos
      yPos = drawTableHeader(yPos)
      let rowIndex = 0

      while (rowIndex < data.length) {
        const remainingRows = data.length - rowIndex
        const yAfterAllRemaining = yPos + (remainingRows * rowHeight)
        const fitsWithSummary = yAfterAllRemaining <= summaryAreaTop
        const pageLimit = fitsWithSummary ? summaryAreaTop : normalPageLimit

        if (yPos + rowHeight > pageLimit) {
          doc.rect(tableLeft, tableTopY, tableWidth, yPos - tableTopY)
            .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

          doc.addPage()
          yPos = drawSimpleHeader()
          tableTopY = yPos
          yPos = drawTableHeader(yPos)
          continue
        }

        if (rowIndex % 2 === 0) {
          doc.rect(tableLeft, yPos, tableWidth, rowHeight).fill(altRowBg)
        }

        const row = data[rowIndex]
        const statusLabel = row.is_matched ? 'Completed' : 'Missed'
        const statusColor = row.is_matched ? successColor : dangerColor

        const rowData = [
          String(rowIndex + 1),
          String(row.id || '-'),
          (row.uuid_weight || '-').substring(0, 24),
          formatDateTime(row.captured_local),
          formatNumber(row.weight_lb),
          formatInt(row.eje1),
          formatInt(row.eje2),
          formatInt(row.eje3),
          formatInt(row.peso_total),
          (row.operator_name || '-').substring(0, 14),
          statusLabel,
          row.missed_reason || '-'
        ]

        doc.fontSize(5.5).font('Helvetica')
        let xPos = tableLeft + 2
        rowData.forEach((cell, i) => {
          if (i === 10) {
            doc.fillColor(statusColor).font('Helvetica-Bold')
          } else {
            doc.fillColor('#333333').font('Helvetica')
          }
          const align = (i >= 4 && i <= 8) ? 'right' : (i === 10 ? 'center' : 'left')
          doc.text(String(cell), xPos, yPos + 3, { width: colWidths[i] - 4, align, lineBreak: false })
          xPos += colWidths[i]
        })

        yPos += rowHeight
        rowIndex++
      }

      // Borde final de tabla
      doc.rect(tableLeft, tableTopY, tableWidth, yPos - tableTopY)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

      // Si la tabla invadió la zona del summary → nueva página
      if (yPos > summaryAreaTop) {
        doc.addPage()
        drawSimpleHeader()
      }

      // ========== SUMMARY al fondo ==========
      const summaryTop = footerY - bottomGapFromFooter - summaryBlockHeight

      doc.rect(tableLeft, summaryTop, summaryBoxWidth, summaryHeaderHeight).fill('#E7E6E6')
      doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold')
        .text('Summary', tableLeft, summaryTop + 4, { width: summaryBoxWidth, align: 'center' })

      doc.fontSize(7).fillColor('#000000').font('Helvetica')
      doc.text(`Total Captures: ${totals.total_captures}`, tableLeft + 6, summaryTop + summaryHeaderHeight + 3)
      doc.fillColor(successColor).font('Helvetica-Bold')
        .text(`Completed: ${totals.matched_count} (${totals.matched_percent}%)`, tableLeft + 130, summaryTop + summaryHeaderHeight + 3)
      doc.fillColor(dangerColor)
        .text(`Missed: ${totals.unmatched_count} (${totals.unmatched_percent}%)`, tableLeft + 290, summaryTop + summaryHeaderHeight + 3)

      doc.rect(tableLeft, summaryTop, summaryBoxWidth, summaryBlockHeight)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke()

      // ========== FOOTERS con conteo real ==========
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
 */
export const generateExcel = async (filters = {}) => {
  const { data, totals } = await getData(filters)
  const settings = await getReportSettings()

  const formatDate = _formatDateTime

  const workbook = new ExcelJS.Workbook()
  workbook.creator = settings.companyName
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Missed Transactions', {
    pageSetup: { paperSize: 9, orientation: 'landscape' }
  })

  // ========== HEADER (A..K = 11 columnas) ==========
  worksheet.mergeCells('A1:L1')
  worksheet.getCell('A1').value = settings.companyName
  worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: '6F42C1' } }
  worksheet.getCell('A1').alignment = { horizontal: 'center' }

  worksheet.mergeCells('A2:L2')
  worksheet.getCell('A2').value = 'Missed Transactions Report'
  worksheet.getCell('A2').font = { size: 12, bold: true }
  worksheet.getCell('A2').alignment = { horizontal: 'center' }

  const filterText = [
    filters.date_from ? `From: ${filters.date_from}` : '',
    filters.date_to ? `To: ${filters.date_to}` : ''
  ].filter(Boolean).join(' | ') || 'All records'

  worksheet.mergeCells('A3:L3')
  worksheet.getCell('A3').value = `Generated: ${formatGeneratedTimestamp()} | ${filterText}`
  worksheet.getCell('A3').font = { size: 9, italic: true, color: { argb: '666666' } }
  worksheet.getCell('A3').alignment = { horizontal: 'center' }

  worksheet.addRow([])

  // ========== SUMMARY ==========
  worksheet.mergeCells('A5:L5')
  const summHeader = worksheet.getCell('A5')
  summHeader.value = 'Summary'
  summHeader.font = { bold: true, color: { argb: 'FFFFFF' } }
  summHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '5A32A3' } }

  worksheet.getCell('A6').value = 'Total Captures:'
  worksheet.getCell('B6').value = totals.total_captures
  worksheet.getCell('B6').font = { bold: true }
  worksheet.getCell('C6').value = 'Completed:'
  worksheet.getCell('D6').value = `${totals.matched_count} (${totals.matched_percent}%)`
  worksheet.getCell('D6').font = { color: { argb: '28A745' }, bold: true }
  worksheet.getCell('E6').value = 'Missed:'
  worksheet.getCell('F6').value = `${totals.unmatched_count} (${totals.unmatched_percent}%)`
  worksheet.getCell('F6').font = { color: { argb: 'DC3545' }, bold: true }

  worksheet.addRow([])

  // ========== TABLE ==========
  const tableStartRow = 8

  const colWidths = [8, 10, 32, 20, 12, 10, 10, 10, 12, 18, 12, 20]
  colWidths.forEach((w, i) => worksheet.getColumn(i + 1).width = w)

  const headers = ['#', 'ID', 'UUID', 'Date/Time', 'Weight', 'Axle 1', 'Axle 2', 'Axle 3', 'Total', 'Operator', 'Status', 'Reason']
  headers.forEach((h, i) => {
    const cell = worksheet.getCell(tableStartRow, i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '5A32A3' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'CCCCCC' } },
      left: { style: 'thin', color: { argb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
      right: { style: 'thin', color: { argb: 'CCCCCC' } }
    }
  })

  let currentRow = tableStartRow + 1
  data.forEach((row, index) => {
    const statusLabel = row.is_matched ? 'Completed' : 'Missed'
    const statusColor = row.is_matched ? '28A745' : 'DC3545'

    const rowData = [
      index + 1,
      row.id || '-',
      row.uuid_weight || '-',
      formatDate(row.captured_local),
      parseFloat(row.weight_lb) || 0,
      Math.round(Number(row.eje1) || 0),
      Math.round(Number(row.eje2) || 0),
      Math.round(Number(row.eje3) || 0),
      Math.round(Number(row.peso_total) || 0),
      row.operator_name || '-',
      statusLabel,
      row.missed_reason || '-'
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

      // Weight number format
      if (colIndex === 4) {
        cell.numFmt = '#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }

      // Integer columns (eje1, eje2, eje3, total)
      if (colIndex >= 5 && colIndex <= 8) {
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: 'right' }
      }

      // Status color
      if (colIndex === 10) {
        cell.font = { bold: true, color: { argb: statusColor } }
        cell.alignment = { horizontal: 'center' }
      }
    })

    currentRow++
  })

  return await workbook.xlsx.writeBuffer()
}

export default { getData, getFilterOptions, generatePdf, generateExcel }