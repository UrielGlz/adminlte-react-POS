import { query } from '../../../config/database.js'

/**
 * POS Settings Service
 * Manages settings filtered by module prefix (scale, reweigh, tickets, sync, etc.)
 */

/**
 * Obtener todos los prefijos/módulos disponibles
 */
export const getModules = async () => {
  const results = await query(`
    SELECT DISTINCT 
      SUBSTRING_INDEX(\`key\`, '.', 1) as module,
      COUNT(*) as count
    FROM settings 
    WHERE is_active = 1
    GROUP BY module
    ORDER BY module
  `)

  return results.map(r => ({
    value: r.module,
    label: formatModuleLabel(r.module),
    count: r.count
  }))
}

/**
 * Formatear nombre del módulo para mostrar
 */
const formatModuleLabel = (module) => {
  const labels = {
    'scale': 'Scale Configuration',
    'reweigh': 'Reweigh Settings',
    'tickets': 'Ticket Settings',
    'sync': 'Synchronization',
    'terminal': 'Terminal',
    'alerts': 'Alerts & Notifications',
    'currency': 'Currency',
    'reports': 'Reports'
  }
  return labels[module] || module.charAt(0).toUpperCase() + module.slice(1)
}

/**
 * Obtener settings por módulo/prefijo
 */
export const getByModule = async (module) => {
  const sql = `
    SELECT 
      setting_id,
      site_id,
      \`key\`,
      value,
      json_value,
      is_active,
      created_at,
      updated_at
    FROM settings
    WHERE \`key\` LIKE ?
    AND is_active = 1
    ORDER BY \`key\`
  `

  const results = await query(sql, [`${module}.%`])

  // Agregar metadata para el frontend
  return results.map(setting => ({
    ...setting,
    module: module,
    setting_name: setting.key.replace(`${module}.`, ''),
    display_name: formatSettingName(setting.key),
    input_type: getInputType(setting.key, setting.value),
    description: getSettingDescription(setting.key),
    unit: getSettingUnit(setting.key)
  }))
}

/**
 * Formatear nombre del setting para mostrar
 */
const formatSettingName = (key) => {
  const name = key.split('.').pop()
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Determinar tipo de input según el setting
 */
const getInputType = (key, value) => {
  // Booleanos
  if (['auto_capture', 'enable_qr', 'auto_print', 'landscape', 'enable_sync_notifications', 'show_sync_status'].some(k => key.includes(k))) {
    return 'switch'
  }

  // Números enteros
  if (['minutes', 'seconds', 'threshold', 'size', 'attempts', 'delay', 'version', 'max_reweighs', 'terms_days'].some(k => key.includes(k))) {
    return 'number'
  }

  // Números decimales
  if (['percent', 'tolerance', 'margin', 'price', 'limit'].some(k => key.includes(k))) {
    return 'decimal'
  }

  // Select para opciones conocidas
  if (key.includes('match_by')) return 'select:plates,license,phone'
  if (key.includes('price_mode')) return 'select:fixed,discount_percent,free'
  if (key.includes('queue_status')) return 'select:FREE,BUSY,ERROR'

  // Textarea para JSON
  if (key.includes('json') || (value && value.startsWith('{'))) {
    return 'json'
  }

  // Default: texto
  return 'text'
}

/**
 * Obtener descripción del setting
 */
const getSettingDescription = (key) => {
  const descriptions = {
    // Scale
    'scale.stable_threshold_seconds': 'Time in seconds the weight must remain stable before capture',
    'scale.weight_tolerance_lb': 'Weight variation tolerance in pounds (± value)',
    'scale.auto_capture': 'Automatically capture weight when stable',

    // Reweigh
    'reweigh.window_minutes': 'Time window in minutes to allow reweigh (e.g., 120 = 2 hours)',
    'reweigh.match_by': 'Field used to match original ticket for reweigh',
    'reweigh.price_mode': 'How to calculate reweigh price',
    'reweigh.discount_percent': 'Discount percentage for reweigh (if price_mode = discount_percent)',
    'reweigh.max_reweighs': 'Maximum number of reweighs allowed per original ticket',

    // Tickets
    'tickets.prefix': 'Prefix for ticket numbers (e.g., TK-)',
    'tickets.enable_qr': 'Enable QR code on printed tickets',
    'tickets.qr_version': 'QR code version/format',
    'tickets.auto_print': 'Automatically print ticket after transaction',
    'tickets.printer_name': 'System printer name for tickets',
    'tickets.receipt_printer_name': 'System printer name for receipts',
    'tickets.landscape': 'Print tickets in landscape orientation',
    'tickets.margin_inches': 'Print margin in inches',

    // Sync
    'sync.queue_status': 'Current sync queue status',
    'sync.push_timer_minutes': 'Interval in minutes between sync attempts',
    'sync.batch_size': 'Number of records per sync batch',
    'sync.max_attempts': 'Maximum retry attempts for failed syncs',
    'sync.retry_delay_seconds': 'Delay in seconds between retry attempts',

    // Terminal
    'terminal.heartbeat_interval_seconds': 'Heartbeat interval in seconds',
    'terminal.site_id': 'Site ID for this terminal',

    // Alerts
    'alerts.sync_failure_threshold': 'Number of failures before alert',
    'alerts.enable_sync_notifications': 'Enable sync status notifications',
    'alerts.show_sync_status': 'Show sync status in UI',

    // Currency
    'currency.default': 'Default currency code (e.g., USD)',

    // Reports
    'reports.company_name': 'Company name shown on reports',
    'reports.company_logo': 'Logo filename for reports',
    'reports.company_address': 'Company address for reports',
    'reports.company_phone': 'Company phone for reports'
  }

  return descriptions[key] || ''
}

/**
 * Obtener unidad de medida del setting
 */
const getSettingUnit = (key) => {
  if (key.includes('minutes')) return 'min'
  if (key.includes('seconds')) return 'sec'
  if (key.includes('percent')) return '%'
  if (key.includes('tolerance_lb')) return 'lb'
  if (key.includes('margin_inches')) return 'in'
  return ''
}

/**
 * Actualizar un setting
 */
export const update = async (settingId, value) => {
  const sql = `
    UPDATE settings 
    SET value = ?, updated_at = NOW()
    WHERE setting_id = ?
  `

  const result = await query(sql, [value, settingId])
  return result.affectedRows > 0
}

/**
 * Actualizar múltiples settings
 */
export const updateBulk = async (settings) => {
  const results = []

  for (const setting of settings) {
    const success = await update(setting.setting_id, setting.value)
    results.push({
      setting_id: setting.setting_id,
      key: setting.key,
      success
    })
  }

  return results
}

/**
 * Obtener un setting por key
 */
export const getByKey = async (key) => {
  const [setting] = await query(`
    SELECT * FROM settings WHERE \`key\` = ? AND is_active = 1
  `, [key])

  return setting
}

/**
 * Crear nuevo setting
 */
export const create = async (data) => {
  const { site_id = 1, key, value, json_value = null } = data

  // Verificar que no exista
  const existing = await getByKey(key)
  if (existing) {
    throw new Error(`Setting with key "${key}" already exists`)
  }

  const sql = `
    INSERT INTO settings (site_id, \`key\`, value, json_value, is_active)
    VALUES (?, ?, ?, ?, 1)
  `

  const result = await query(sql, [site_id, key, value, json_value])
  return result.insertId
}

export default {
  getModules,
  getByModule,
  update,
  updateBulk,
  getByKey,
  create
}