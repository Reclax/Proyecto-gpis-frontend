import { ROLES, normalizeRole, obtenerPermisos } from "../config/roles";
import { authAPI } from "../services/api";

/**
 * Obtiene el rol actual del usuario autenticado
 */
export const getCurrentUserRole = () => {
  if (!authAPI.isAuthenticated()) return null;

  const user = authAPI.getUserData();

  const resolveRole = (value) => {
    const normalized = normalizeRole(value);
    return normalized || null;
  };

  const pickFromCollection = (collection) => {
    if (!Array.isArray(collection) || collection.length === 0) return null;

    for (const entry of collection) {
      const resolved = resolveRole(entry);
      if (resolved) return resolved;

      if (entry?.role) {
        const nested = resolveRole(entry.role);
        if (nested) return nested;
      }

      if (entry?.Role) {
        const nested = resolveRole(entry.Role);
        if (nested) return nested;
      }
    }

    return null;
  };

  const roleFromRoles = pickFromCollection(user?.roles);
  if (roleFromRoles) return roleFromRoles;

  const roleFromUpperRoles = pickFromCollection(user?.Roles);
  if (roleFromUpperRoles) return roleFromUpperRoles;

  const roleFromUserRoles = pickFromCollection(
    user?.user_roles || user?.UserRoles
  );
  if (roleFromUserRoles) return roleFromUserRoles;

  const roleFromAuthorities = pickFromCollection(
    user?.authorities || user?.Authorities
  );
  if (roleFromAuthorities) return roleFromAuthorities;

  if (user?.role) {
    return resolveRole(user.role);
  }

  if (user?.Role) {
    return resolveRole(user.Role);
  }

  if (user?.roleId || user?.role_id) {
    return resolveRole(user.roleId || user.role_id);
  }

  try {
    const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.roles?.length) {
        return resolveRole(payload.roles[0]);
      }
      if (payload.authorities?.length) {
        return resolveRole(payload.authorities[0]);
      }
    }
  } catch {
    // Error decoding token
  }

  return null;
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
    {
      label: "Dashboard",
      path: "/admin",
      icon: "FiBarChart2",
      available: true,
    },
    {
      label: "Gestionar Usuarios",
      path: "/admin/usuarios",
      permission: "gestionar_usuarios",
    },
    {
      label: "Gestionar Incidencias",
      path: "/admin/incidencias",
      permission: "gestionar_incidencias",
    },
    {
      label: "Gestionar Productos",
      path: "/admin/productos",
      permission: "gestionar_productos_admin",
    },
    {
      label: "Registrar Moderadores",
      path: "/admin/moderadores",
      permission: "registrar_moderadores",
    },
  ];

  return allPages.filter((page) => {
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
      redirectPath: "/login",
    };
  }

  if (!canAccessAdminPanel()) {
    return {
      isAllowed: false,
      userRole: role,
      redirectPath: "/",
    };
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return {
      isAllowed: false,
      userRole: role,
      redirectPath: "/admin",
    };
  }

  return {
    isAllowed: true,
    userRole: role,
    redirectPath: null,
  };
};
