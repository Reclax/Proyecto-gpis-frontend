import { authAPI } from '../services/api';
import { PERMISOS_POR_ROL, ROLES, obtenerPermisos, normalizeRole } from '../config/roles';

/**
 * Obtiene el rol actual del usuario autenticado
 */
export const getCurrentUserRole = () => {
  if (!authAPI.isAuthenticated()) return null;

  const user = authAPI.getUserData();
  if (user?.roles && Array.isArray(user.roles)) {
    return user.roles[0];
  }

  try {
    const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
  return payload.roles?.[0];
    }
  } catch (err) {
    // Error decoding token
  }

  return user?.role || null;
};

/**
 * Verifica si el usuario tiene acceso al panel de admin
 */
export const canAccessAdminPanel = () => {
  const role = getCurrentUserRole();
  const r = normalizeRole(role);
  return r === ROLES.ADMIN || r === ROLES.MODERADOR;
};

/**
 * Verifica si el usuario tiene un permiso específico
 */
export const hasPermission = (permiso) => {
  const role = getCurrentUserRole();
  if (!role) return false;

  const permisos = obtenerPermisos(role);
  return permisos?.[permiso] === true;
};

/**
 * Verifica si es Admin
 */
export const isAdmin = () => {
  const role = getCurrentUserRole();
  return normalizeRole(role) === ROLES.ADMIN;
};

/**
 * Verifica si es Moderador
 */
export const isModerator = () => {
  const role = getCurrentUserRole();
  return normalizeRole(role) === ROLES.MODERADOR;
};

/**
 * Verifica si es Usuario regular
 */
export const isRegularUser = () => {
  const role = getCurrentUserRole();
  return normalizeRole(role) === ROLES.USUARIO;
};

/**
 * Obtiene las páginas de admin disponibles según el rol
 */
export const getAvailableAdminPages = () => {
  const allPages = [
    { label: 'Dashboard', path: '/admin', icon: 'FiBarChart2', available: true },
    { label: 'Gestionar Usuarios', path: '/admin/usuarios', permission: 'gestionar_usuarios' },
    { label: 'Gestionar Incidencias', path: '/admin/incidencias', permission: 'gestionar_incidencias' },
    { label: 'Gestionar Productos', path: '/admin/productos', permission: 'gestionar_productos_admin' },
    { label: 'Registrar Moderadores', path: '/admin/moderadores', permission: 'registrar_moderadores' }
  ];

  return allPages.filter(page => {
    if (page.available === true) return true;
    return hasPermission(page.permission);
  });
};

/**
 * Hook para proteger rutas de admin
 * Retorna { isAllowed, userRole, redirectPath }
 */
export const checkAdminAccess = (requiredPermission = null) => {
  const role = getCurrentUserRole();

  if (!authAPI.isAuthenticated() || !role) {
    return {
      isAllowed: false,
      userRole: null,
      redirectPath: '/login'
    };
  }

  if (!canAccessAdminPanel()) {
    return {
      isAllowed: false,
      userRole: role,
      redirectPath: '/'
    };
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return {
      isAllowed: false,
      userRole: role,
      redirectPath: '/admin'
    };
  }

  return {
    isAllowed: true,
    userRole: role,
    redirectPath: null
  };
};

