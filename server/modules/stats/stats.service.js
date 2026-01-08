import { query } from '../../config/database.js'

/**
 * Stats Service
 * Estadísticas generales del dashboard
 */

export const getDashboardStats = async () => {
  // Obtener stats de usuarios
  const userStats = await query(`
    SELECT 
      COUNT(*) as totalUsers,
      SUM(CASE WHEN is_active = '1' THEN 1 ELSE 0 END) as activeUsers
    FROM users
  `)
  
  // Aquí puedes agregar más queries para otras tablas
  // const orderStats = await query('SELECT COUNT(*) as total FROM orders')
  
  return {
    users: userStats[0]?.totalUsers || 0,
    activeUsers: userStats[0]?.activeUsers || 0,
    orders: Math.floor(Math.random() * 200) + 100, // Placeholder
    sales: Math.floor(Math.random() * 50000) + 10000, // Placeholder
    visitors: Math.floor(Math.random() * 1000) + 500, // Placeholder
  }
}

export default { getDashboardStats }
