import { query } from '../../config/database.js'

/**
 * Servicio base para reportes
 * Obtiene configuración de empresa para encabezados
 */

export const getReportSettings = async () => {
  const settings = await query(`
    SELECT \`key\`, value 
    FROM settings 
    WHERE \`key\` LIKE 'reports.%' AND is_active = 1
  `)
  
  const config = {}
  settings.forEach(s => {
    const key = s.key.replace('reports.', '')
    config[key] = s.value
  })
  
  return {
    companyName: config.company_name || 'Company Name',
    companyLogo: config.company_logo || null,
    companyAddress: config.company_address || '',
    companyPhone: config.company_phone || ''
  }
}

export default { getReportSettings }