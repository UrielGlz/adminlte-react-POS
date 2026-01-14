import { query } from '../../config/database.js'

/**
 * Obtener resumen general del día
 */
export const getTodaySummary = async () => {
    const TZ = 'America/Matamoros' // Reynosa
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date()) // => 'YYYY-MM-DD'


    const result = await query(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(CASE WHEN sale_status_id = 2 THEN total ELSE 0 END) as total_sales,
      SUM(CASE WHEN sale_status_id = 2 THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN sale_status_id = 3 THEN 1 ELSE 0 END) as cancelled_count,
      SUM(CASE WHEN is_reweigh = 1 AND sale_status_id = 2 THEN 1 ELSE 0 END) as reweigh_count,
      SUM(CASE WHEN is_reweigh = 0 AND sale_status_id = 2 THEN 1 ELSE 0 END) as weigh_count,
      AVG(CASE WHEN sale_status_id = 2 THEN total ELSE NULL END) as avg_ticket
    FROM sales
    WHERE DATE(created_at) = ?
  `, [today])

    return result[0]
}

/**
 * Obtener resumen del mes actual
 */
export const getMonthSummary = async () => {
    const result = await query(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(CASE WHEN sale_status_id = 2 THEN total ELSE 0 END) as total_sales,
      SUM(CASE WHEN sale_status_id = 2 THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN sale_status_id = 3 THEN 1 ELSE 0 END) as cancelled_count
    FROM sales
    WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) 
      AND YEAR(created_at) = YEAR(CURRENT_DATE())
  `)

    return result[0]
}

/**
 * Ventas por categoría (WEIGH vs REWEIGH)
 */
export const getSalesByCategory = async (dateFrom, dateTo) => {
    let dateFilter = ''
    const params = []

    if (dateFrom && dateTo) {
        dateFilter = 'AND DATE(s.created_at) BETWEEN ? AND ?'
        params.push(dateFrom, dateTo)
    } else {
        dateFilter = 'AND MONTH(s.created_at) = MONTH(CURRENT_DATE()) AND YEAR(s.created_at) = YEAR(CURRENT_DATE())'
    }

    const result = await query(`
    SELECT 
      p.code as category,
      p.name as category_name,
      COUNT(*) as quantity,
      SUM(sl.line_total) as total_amount
    FROM sale_lines sl
    INNER JOIN sales s ON sl.sale_uid = s.sale_uid
    INNER JOIN products p ON sl.product_id = p.product_id
    WHERE s.sale_status_id = 2 ${dateFilter}
    GROUP BY p.product_id, p.code, p.name
    ORDER BY total_amount DESC
  `, params)

    return result
}

/**
 * Ventas por hora del día (para gráfica)
 */
export const getSalesByHour = async (date = null) => {
    //const targetDate = date || new Date().toISOString().split('T')[0]

    const TZ = 'America/Matamoros' // Reynosa
    const targetDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date()) // => 'YYYY-MM-DD'

    const result = await query(`
    SELECT 
      HOUR(created_at) as hour,
      COUNT(*) as transactions,
      SUM(CASE WHEN sale_status_id = 2 THEN total ELSE 0 END) as total_sales
    FROM sales
    WHERE DATE(created_at) = ?
    GROUP BY HOUR(created_at)
    ORDER BY hour
  `, [targetDate])

    // Llenar horas vacías
    const hourlyData = []
    for (let i = 0; i < 24; i++) {
        const found = result.find(r => r.hour === i)
        hourlyData.push({
            hour: `${i.toString().padStart(2, '0')}:00`,
            transactions: found ? found.transactions : 0,
            total_sales: found ? parseFloat(found.total_sales) : 0
        })
    }

    return hourlyData
}

/**
 * Tendencia de ventas (últimos N días)
 */
export const getSalesTrend = async (days = 7) => {
    const result = await query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as transactions,
      SUM(CASE WHEN sale_status_id = 2 THEN total ELSE 0 END) as total_sales,
      SUM(CASE WHEN sale_status_id = 2 THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN sale_status_id = 3 THEN 1 ELSE 0 END) as cancelled
    FROM sales
    WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [days])

    return result.map(r => ({
        ...r,
        date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total_sales: parseFloat(r.total_sales)
    }))
}

/**
 * Ventas por método de pago
 */
export const getSalesByPaymentMethod = async (dateFrom, dateTo) => {
    let dateFilter = ''
    const params = []

    if (dateFrom && dateTo) {
        dateFilter = 'AND DATE(p.received_at) BETWEEN ? AND ?'
        params.push(dateFrom, dateTo)
    } else {
        dateFilter = 'AND MONTH(p.received_at) = MONTH(CURRENT_DATE()) AND YEAR(p.received_at) = YEAR(CURRENT_DATE())'
    }

    const result = await query(`
    SELECT 
      pm.code,
      pm.name as method_name,
      COUNT(*) as quantity,
      SUM(p.amount) as total_amount
    FROM payments p
    INNER JOIN payment_methods pm ON p.method_id = pm.method_id
    WHERE p.payment_status_id = 6 ${dateFilter}
    GROUP BY pm.method_id, pm.code, pm.name
    ORDER BY total_amount DESC
  `, params)

    return result.map(r => ({
        ...r,
        total_amount: parseFloat(r.total_amount)
    }))
}

/**
 * Top clientes por volumen de ventas
 */
export const getTopCustomers = async (limit = 5, dateFrom, dateTo) => {
    let dateFilter = ''
    const params = []

    if (dateFrom && dateTo) {
        dateFilter = 'AND DATE(s.created_at) BETWEEN ? AND ?'
        params.push(dateFrom, dateTo)
    } else {
        dateFilter = 'AND MONTH(s.created_at) = MONTH(CURRENT_DATE()) AND YEAR(s.created_at) = YEAR(CURRENT_DATE())'
    }

    params.push(limit)

    const result = await query(`
    SELECT 
      d.account_number,
      d.account_name,
      COUNT(*) as transaction_count,
      SUM(s.total) as total_spent
    FROM sales s
    INNER JOIN sale_driver_info d ON s.sale_uid = d.sale_uid
    WHERE s.sale_status_id = 2 
      AND d.account_number IS NOT NULL
      ${dateFilter}
    GROUP BY d.account_number, d.account_name
    ORDER BY total_spent DESC
    LIMIT ?
  `, params)

    return result.map(r => ({
        ...r,
        total_spent: parseFloat(r.total_spent)
    }))
}

/**
 * Resumen de créditos de clientes
 */
export const getCreditSummary = async () => {
    const result = await query(`
    SELECT 
      COUNT(*) as total_customers_with_credit,
      SUM(credit_limit) as total_credit_limit,
      SUM(current_balance) as total_balance_due,
      SUM(available_credit) as total_available,
      SUM(CASE WHEN is_suspended = 1 THEN 1 ELSE 0 END) as suspended_accounts
    FROM customer_credit
  `)

    return {
        ...result[0],
        total_credit_limit: parseFloat(result[0].total_credit_limit || 0),
        total_balance_due: parseFloat(result[0].total_balance_due || 0),
        total_available: parseFloat(result[0].total_available || 0)
    }
}

/**
 * Clientes con mayor uso de crédito
 */
export const getTopCreditUsage = async (limit = 5) => {
    const result = await query(`
    SELECT 
      c.account_number,
      c.account_name,
      cc.credit_type,
      cc.credit_limit,
      cc.current_balance,
      cc.available_credit,
      ROUND((cc.current_balance / cc.credit_limit) * 100, 1) as usage_percent
    FROM customers c
    INNER JOIN customer_credit cc ON c.id_customer = cc.customer_id
    WHERE cc.credit_limit > 0
    ORDER BY cc.current_balance DESC
    LIMIT ?
  `, [limit])

    return result.map(r => ({
        ...r,
        credit_limit: parseFloat(r.credit_limit),
        current_balance: parseFloat(r.current_balance),
        available_credit: parseFloat(r.available_credit),
        usage_percent: parseFloat(r.usage_percent || 0)
    }))
}

/**
 * Tickets por día (últimos N días)
 */
export const getTicketsTrend = async (days = 7) => {
    const result = await query(`
    SELECT 
      DATE(printed_at) as date,
      COUNT(*) as total_tickets,
      SUM(reprint_count) as reprints
    FROM tickets
    WHERE DATE(printed_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)
    GROUP BY DATE(printed_at)
    ORDER BY date
  `, [days])

    return result.map(r => ({
        ...r,
        date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }))
}

/**
 * Estadísticas de operadores
 */
export const getOperatorStats = async (dateFrom, dateTo) => {
    let dateFilter = ''
    const params = []

    if (dateFrom && dateTo) {
        dateFilter = 'AND DATE(s.created_at) BETWEEN ? AND ?'
        params.push(dateFrom, dateTo)
    } else {
        dateFilter = 'AND DATE(s.created_at) = CURRENT_DATE()'
    }

    const result = await query(`
    SELECT 
      u.user_id,
      u.full_name as operator_name,
      COUNT(*) as transaction_count,
      SUM(CASE WHEN s.sale_status_id = 2 THEN s.total ELSE 0 END) as total_sales
    FROM sales s
    INNER JOIN users u ON s.operator_id = u.user_id
    WHERE 1=1 ${dateFilter}
    GROUP BY u.user_id, u.full_name
    ORDER BY transaction_count DESC
  `, params)

    return result.map(r => ({
        ...r,
        total_sales: parseFloat(r.total_sales)
    }))
}

/**
 * Comparativa vs período anterior
 */
export const getComparison = async () => {
    // Esta semana vs semana pasada
    const result = await query(`
    SELECT 
      SUM(CASE WHEN YEARWEEK(created_at) = YEARWEEK(CURRENT_DATE()) AND sale_status_id = 2 THEN total ELSE 0 END) as this_week,
      SUM(CASE WHEN YEARWEEK(created_at) = YEARWEEK(DATE_SUB(CURRENT_DATE(), INTERVAL 1 WEEK)) AND sale_status_id = 2 THEN total ELSE 0 END) as last_week,
      SUM(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE()) AND sale_status_id = 2 THEN total ELSE 0 END) as this_month,
      SUM(CASE WHEN MONTH(created_at) = MONTH(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) AND YEAR(created_at) = YEAR(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) AND sale_status_id = 2 THEN total ELSE 0 END) as last_month
    FROM sales
  `)

    const data = result[0]
    const thisWeek = parseFloat(data.this_week || 0)
    const lastWeek = parseFloat(data.last_week || 0)
    const thisMonth = parseFloat(data.this_month || 0)
    const lastMonth = parseFloat(data.last_month || 0)

    return {
        this_week: thisWeek,
        last_week: lastWeek,
        week_change: lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100).toFixed(1) : 0,
        this_month: thisMonth,
        last_month: lastMonth,
        month_change: lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100).toFixed(1) : 0
    }
}

/**
 * Dashboard completo (para una sola llamada)
 */
export const getFullDashboard = async (role = 'OPERATOR') => {
    const [
        todaySummary,
        monthSummary,
        salesByCategory,
        salesByHour,
        salesTrend,
        comparison
    ] = await Promise.all([
        getTodaySummary(),
        getMonthSummary(),
        getSalesByCategory(),
        getSalesByHour(),
        getSalesTrend(7),
        getComparison()
    ])

    const dashboard = {
        today: todaySummary,
        month: monthSummary,
        salesByCategory,
        salesByHour,
        salesTrend,
        comparison
    }

    // Datos adicionales para ADMIN y ACCOUNTING
    if (role === 'SUPERADMIN' || role === 'ADMINISTRATOR' || role === 'ACCOUNTING') {
        const [
            paymentMethods,
            topCustomers,
            creditSummary,
            topCreditUsage,
            operatorStats
        ] = await Promise.all([
            getSalesByPaymentMethod(),
            getTopCustomers(5),
            getCreditSummary(),
            getTopCreditUsage(5),
            getOperatorStats()
        ])

        dashboard.paymentMethods = paymentMethods
        dashboard.topCustomers = topCustomers
        dashboard.creditSummary = creditSummary
        dashboard.topCreditUsage = topCreditUsage
        dashboard.operatorStats = operatorStats
    }

    return dashboard
}

export default {
    getTodaySummary,
    getMonthSummary,
    getSalesByCategory,
    getSalesByHour,
    getSalesTrend,
    getSalesByPaymentMethod,
    getTopCustomers,
    getCreditSummary,
    getTopCreditUsage,
    getTicketsTrend,
    getOperatorStats,
    getComparison,
    getFullDashboard
}