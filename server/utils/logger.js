import config from '../config/index.js'

// Colores ANSI para terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

// Niveles de log
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

const currentLevel = levels[config.logLevel] ?? levels.info

/**
 * Formatear timestamp
 */
const getTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

/**
 * Formatear datos adicionales
 */
const formatData = (data) => {
  if (!data) return ''
  if (typeof data === 'string') return data
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

/**
 * Logger principal
 */
const logger = {
  error: (message, data) => {
    if (currentLevel >= levels.error) {
      console.error(
        `${colors.gray}${getTimestamp()}${colors.reset} ${colors.red}[ERROR]${colors.reset} ${message}`,
        data ? `\n${formatData(data)}` : ''
      )
    }
  },

  warn: (message, data) => {
    if (currentLevel >= levels.warn) {
      console.warn(
        `${colors.gray}${getTimestamp()}${colors.reset} ${colors.yellow}[WARN]${colors.reset} ${message}`,
        data ? `\n${formatData(data)}` : ''
      )
    }
  },

  info: (message, data) => {
    if (currentLevel >= levels.info) {
      console.log(
        `${colors.gray}${getTimestamp()}${colors.reset} ${colors.green}[INFO]${colors.reset} ${message}`,
        data ? `\n${formatData(data)}` : ''
      )
    }
  },

  debug: (message, data) => {
    if (currentLevel >= levels.debug) {
      console.log(
        `${colors.gray}${getTimestamp()}${colors.reset} ${colors.cyan}[DEBUG]${colors.reset} ${message}`,
        data ? `\n${formatData(data)}` : ''
      )
    }
  },

  // Log de requests HTTP
  request: (req) => {
    if (currentLevel >= levels.info) {
      console.log(
        `${colors.gray}${getTimestamp()}${colors.reset} ${colors.blue}[HTTP]${colors.reset} ${req.method} ${req.originalUrl}`
      )
    }
  },

  // Log de queries SQL (solo en debug)
  sql: (sql, params) => {
    if (currentLevel >= levels.debug) {
      console.log(
        `${colors.gray}${getTimestamp()}${colors.reset} ${colors.magenta}[SQL]${colors.reset} ${sql}`,
        params?.length ? `\nParams: ${JSON.stringify(params)}` : ''
      )
    }
  },
}

export default logger
