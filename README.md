# AdminLTE v4 + React + Express

Full stack starter con AdminLTE v4, React (Vite) y Express/Node.

## 📁 Estructura

```
adminlte-fullstack/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── layouts/        # Layout principal AdminLTE
│   │   ├── pages/          # Páginas/vistas
│   │   ├── services/       # API calls (axios)
│   │   └── assets/         # CSS, imágenes
│   └── index.html
│
├── server/                 # Backend Express
│   ├── routes/             # Endpoints API
│   ├── controllers/        # Lógica de negocio
│   ├── middleware/         # Auth, validación
│   └── config/             # DB, env
│
└── package.json            # Scripts principales
```

## 🚀 Instalación

```bash
# 1. Instalar todas las dependencias
npm run install:all

# 2. Configurar variables de entorno
cd server
cp .env.example .env
# Editar .env con tus credenciales

# 3. Iniciar desarrollo (cliente + servidor)
cd ..
npm run dev
```

## 📌 URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/api/health

## 🔌 API Endpoints

### Stats
- `GET /api/stats` - Estadísticas del dashboard
- `GET /api/stats/sales` - Datos de ventas para gráficas

### Users
- `GET /api/users` - Listar usuarios
- `GET /api/users/:id` - Obtener usuario
- `POST /api/users` - Crear usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario

## 🗄️ Conexión a MySQL

El proyecto incluye configuración para MySQL. Para activarla:

1. Edita `server/.env` con tus credenciales
2. Importa `pool` o `query` de `config/database.js`
3. Reemplaza los datos en memoria de las rutas

Ejemplo:
```javascript
import { query } from '../config/database.js'

router.get('/', async (req, res) => {
  const users = await query('SELECT * FROM users')
  res.json(users)
})
```

## 🎨 Personalización AdminLTE

### Cambiar tema/colores
Edita las clases en `AdminLayout.jsx`:
- Sidebar: `bg-body-secondary`, `data-bs-theme="dark"`
- Body: `bg-body-tertiary`

### Agregar nuevas páginas
1. Crea componente en `client/src/pages/`
2. Agrega ruta en `App.jsx`
3. Agrega link en `Sidebar.jsx`

## 📦 Build para producción

```bash
# Build del cliente
npm run build

# Los archivos quedan en client/dist/
# Servir con Express o Nginx
```

## 🔐 Autenticación (próximos pasos)

Para agregar login:
1. Instalar `jsonwebtoken` y `bcryptjs`
2. Crear middleware de auth
3. Agregar rutas `/api/auth/login` y `/api/auth/register`
4. Proteger rutas con el middleware

---

Creado con ❤️ para INFYRA
