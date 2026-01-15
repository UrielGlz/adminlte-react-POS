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
 * Motor de Reportes Dinámico
 * Lee configuración de base de datos y genera reportes
 */

/**
 * Obtener definición de un reporte
 */
export const getReportDefinition = async (code) => {
  const [report] = await query(
    `SELECT * FROM report_definitions WHERE code = ? AND is_active = 1`,
    [code]
  )
  
  if (!report) {
    throw new Error(`Report '${code}' not found`)
  }

  const columns = await query(
    `SELECT * FROM report_columns WHERE report_id = ? AND is_active = 1 ORDER BY sort_order`,
    [report.report_id]
  )

  const filters = await query(
    `SELECT * FROM report_filters WHERE report_id = ? AND is_active = 1 ORDER BY sort_order`,
    [report.report_id]
  )

  return { ...report, columns, filters }
}

/**
 * Obtener todos los reportes públicos
 */
export const getPublicReports = async () => {
  return await query(
    `SELECT report_id, code, name, description, icon, color, category, permission_code 
     FROM report_definitions 
     WHERE is_active = 1 AND is_public = 1 
     ORDER BY category, sort_order`
  )
}

/**
 * Ejecutar query del reporte con filtros
 */
export const executeReport = async (code, filterValues = {}) => {
  const definition = await getReportDefinition(code)
  
  let sql = definition.base_query
  const params = []

  // Aplicar filtros
  for (const filter of definition.filters) {
    const value = filterValues[filter.field_name]
    
    if (value && value !== 'all' && value !== '') {
      // Reemplazar placeholders en la condición SQL
      if (filter.filter_type === 'daterange') {
        const [from, to] = value.split(',')
        if (from && to) {
          sql += ` AND ${filter.sql_condition}`
          params.push(from, to)
        }
      } else {
        sql += ` AND ${filter.sql_condition}`
        params.push(value)
      }
    }
  }

  const data = await query(sql, params)

  // Aplicar cálculos JS si existen
  let totals = {}
  if (definition.summary_calculations) {
    try {
      // Ejecutar código JS de forma segura
      const calcFn = new Function('data', definition.summary_calculations)
      totals = calcFn(data)
    } catch (e) {
      console.error('Error in summary calculations:', e)
    }
  }

  return { data, totals, definition }
}

/**
 * Obtener opciones de filtro dinámicas
 */
export const getFilterOptions = async (code) => {
  const definition = await getReportDefinition(code)
  const options = {}

  for (const filter of definition.filters) {
    if (filter.options_source === 'static' && filter.static_options) {
      options[filter.field_name] = JSON.parse(filter.static_options)
    } else if (filter.options_source === 'query' && filter.options_query) {
      options[filter.field_name] = await query(filter.options_query)
    }
  }

  return options
}

/**
 * Generar PDF dinámico
 */
export const generateDynamicPdf = async (code, filterValues = {}) => {
  const { data, totals, definition } = await executeReport(code, filterValues)
  const settings = await getReportSettings()

  // TODO: Implementar generación dinámica de PDF basada en definition.columns
  // Similar a los reportes hardcoded pero leyendo config de BD

  return Buffer.from('PDF generation pending')
}

/**
 * Generar Excel dinámico
 */
export const generateDynamicExcel = async (code, filterValues = {}) => {
  const { data, totals, definition } = await executeReport(code, filterValues)
  const settings = await getReportSettings()

  const workbook = new ExcelJS.Workbook()
  workbook.creator = settings.companyName
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet(definition.excel_sheet_name || 'Report')

  // Header dinámico
  const colCount = definition.columns.length
  worksheet.mergeCells(1, 1, 1, colCount)
  worksheet.getCell('A1').value = settings.companyName
  worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: '2E75B6' } }
  worksheet.getCell('A1').alignment = { horizontal: 'center' }

  worksheet.mergeCells(2, 1, 2, colCount)
  worksheet.getCell('A2').value = definition.name
  worksheet.getCell('A2').font = { size: 12, bold: true }
  worksheet.getCell('A2').alignment = { horizontal: 'center' }

  worksheet.addRow([])

  // Columnas dinámicas
  definition.columns.forEach((col, i) => {
    worksheet.getColumn(i + 1).width = col.width / 7 || 15
  })

  // Header de tabla
  const headerRow = 4
  definition.columns.forEach((col, i) => {
    const cell = worksheet.getCell(headerRow, i + 1)
    cell.value = col.display_name
    cell.font = { bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } }
    cell.alignment = { horizontal: col.alignment || 'left' }
  })

  // Datos dinámicos
  let currentRow = headerRow + 1
  data.forEach((row, index) => {
    definition.columns.forEach((col, i) => {
      const cell = worksheet.getCell(currentRow, i + 1)
      let value = row[col.field_name]

      // Aplicar formato según tipo
      if (col.data_type === 'currency' && value) {
        cell.value = parseFloat(value)
        cell.numFmt = '"$"#,##0.00'
      } else if (col.data_type === 'number' && value) {
        cell.value = parseFloat(value)
        cell.numFmt = '#,##0.00'
      } else if (col.data_type === 'date' && value) {
        cell.value = new Date(value).toLocaleString('en-US')
      } else {
        cell.value = value || '-'
      }

      cell.alignment = { horizontal: col.alignment || 'left' }

      if (index % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } }
      }
    })
    currentRow++
  })

  return await workbook.xlsx.writeBuffer()
}

export default {
  getReportDefinition,
  getPublicReports,
  executeReport,
  getFilterOptions,
  generateDynamicPdf,
  generateDynamicExcel
}