import * as UsersModel from './users.model.js'
import bcrypt from 'bcryptjs'
import { NotFoundError, ConflictError } from '../../utils/errors.js'
import logger from '../../utils/logger.js'

/**
 * Users Service
 * Lógica de negocio para usuarios
 */

/**
 * Obtener todos los usuarios con paginación
 */
export const getAllUsers = async (options) => {
  const users = await UsersModel.findAll(options)
  const total = await UsersModel.count(options)

  // Remover password_hash de la respuesta
  const sanitizedUsers = users.map(user => {
    const { password_hash, password_algo, ...userWithoutPassword } = user
    return userWithoutPassword
  })

  return {
    users: sanitizedUsers,
    total,
  }
}

/**
 * Obtener un usuario por ID
 */
export const getUserById = async (id) => {
  const user = await UsersModel.findById(id)

  if (!user) {
    throw new NotFoundError(`User with ID ${id} not found`)
  }

  // Remover password
  const { password_hash, password_algo, ...userWithoutPassword } = user
  return userWithoutPassword
}

/**
 * Crear nuevo usuario
 */
export const createUser = async (data) => {
  // unicidad
  if (data.username) {
    const existingUsername = await UsersModel.findByUsername(data.username)
    if (existingUsername) throw new ConflictError('Username already exists')
  }
  if (data.email) {
    const existingEmail = await UsersModel.findByEmail(data.email)
    if (existingEmail) throw new ConflictError('Email already registered')
  }

  // ✅ generar hash (bcrypt)
  const password_hash = await bcrypt.hash(data.password, 12)

  // ✅ preparar payload para BD (NO guardar password plano)
  const toCreate = {
    ...data,
    password_hash,
    password_algo: 'bcrypt',
    must_change_pw: 1, // opcional: forzar cambio al primer login
  }
  delete toCreate.password

  const newUser = await UsersModel.create(toCreate)

  logger.info(`User created: ${newUser.username}`, { userId: newUser.user_id })
  return newUser // ya viene sin hash en tu model.create()
}


/**
 * Actualizar usuario
 */
export const updateUser = async (id, data) => {
  // Verificar que existe
  const existingUser = await UsersModel.findById(id)
  if (!existingUser) {
    throw new NotFoundError(`User with ID ${id} not found`)
  }

  // Si cambia username, verificar que no exista
  if (data.username && data.username !== existingUser.username) {
    const usernameExists = await UsersModel.findByUsername(data.username)
    if (usernameExists) {
      throw new ConflictError('Username already in use')
    }
  }

  // Si cambia email, verificar que no exista
  if (data.email && data.email !== existingUser.email) {
    const emailExists = await UsersModel.findByEmail(data.email)
    if (emailExists) {
      throw new ConflictError('Email already in use')
    }
  }
  if (data.password && data.password.length >= 6) {
    data.password_hash = await bcrypt.hash(data.password, 12)
    data.password_algo = 'bcrypt'
    data.must_change_pw = 1
    delete data.password
  }


  const updatedUser = await UsersModel.update(id, data)

  // Remover password
  const { password_hash, password_algo, ...userWithoutPassword } = updatedUser

  logger.info(`User updated: ${updatedUser.username}`, { userId: id })

  return userWithoutPassword
}

/**
 * Eliminar usuario
 */
export const deleteUser = async (id) => {
  const user = await UsersModel.findById(id)
  if (!user) {
    throw new NotFoundError(`User with ID ${id} not found`)
  }

  const deleted = await UsersModel.remove(id)

  if (deleted) {
    logger.info(`User deleted: ${user.username}`, { userId: id })
  }

  return deleted
}

/**
 * Obtener estadísticas
 */
export const getUserStats = async () => {
  return await UsersModel.getStats()
}

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
}