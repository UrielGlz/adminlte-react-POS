-- ================================
-- AdminLTE React - Database Schema
-- ================================

-- Crear base de datos (si no existe)
CREATE DATABASE IF NOT EXISTS adminlte_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE adminlte_db;

-- ================================
-- TABLA: users
-- ================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) DEFAULT NULL,
  role ENUM('admin', 'editor', 'user') DEFAULT 'user',
  status ENUM('active', 'inactive') DEFAULT 'active',
  avatar VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================
-- DATOS DE EJEMPLO
-- ================================
INSERT INTO users (name, email, password, role, status) VALUES
('Admin Usuario', 'admin@example.com', '$2a$10$example', 'admin', 'active'),
('Juan Pérez', 'juan@example.com', '$2a$10$example', 'user', 'active'),
('María García', 'maria@example.com', '$2a$10$example', 'editor', 'active'),
('Carlos López', 'carlos@example.com', '$2a$10$example', 'user', 'inactive'),
('Ana Martínez', 'ana@example.com', '$2a$10$example', 'user', 'active');

-- Verificar
SELECT * FROM users;
