// Configuración de roles y permisos del sistema
// Archivo: src/config/roles.js

export const ROLES = {
  USUARIO: "Usuario",
  MODERADOR: "Moderador",
  // El backend devuelve "Administrador" en la base de datos.
  // Aceptamos también alias como 'Admin' para compatibilidad.
  ADMIN: "Administrador",
};

export const PERMISOS_POR_ROL = {
  [ROLES.USUARIO]: {
    ver_productos: true,
    comprar_productos: true,
    vender_productos: true,
    publicar_productos: true,
    editar_productos: true,
    eliminar_productos: true,
    reportar_productos: true,
    chat_con_otros_usuarios: true,
    guardar_favoritos: true,
    ver_perfil: true,
    editar_perfil: true,
    ver_notificaciones: true,
    apelar_incidencias: true,
    gestionar_usuarios: false,
    gestionar_incidencias: false,
    gestionar_productos_admin: false,
    registrar_moderadores: false,
    acceso_admin_panel: false,
  },
  [ROLES.MODERADOR]: {
    ver_productos: true,
    reportar_productos: true,
    chat_con_otros_usuarios: true,
    ver_perfil: true,
    editar_perfil: true,
    ver_notificaciones: true,
    gestionar_incidencias: true,
    revisar_reportes: true,
    aprobar_rechazar_productos: true,
    suspender_activar_usuarios: true,
    ver_apelaciones: true,
    tomar_incidencias: true, // ⭐ Puede autoasignarse
    asignar_incidencias: false, // ⭐ NO puede asignar a otros
    reasignar_incidencias: false, // ⭐ NO puede reasignar
    resolver_incidencias: true,
    gestionar_usuarios: true,
    gestionar_productos_admin: true,
    registrar_moderadores: false,
    acceso_admin_panel: true,
  },
  [ROLES.ADMIN]: {
    ver_productos: true,
    ver_perfil: true,
    editar_perfil: true,
    ver_notificaciones: true,
    gestionar_incidencias: true,
    revisar_reportes: true,
    aprobar_rechazar_productos: true,
    suspender_activar_usuarios: true,
    ver_apelaciones: true,
    tomar_incidencias: true, // ⭐ Puede autoasignarse
    asignar_incidencias: true, // ⭐ Puede asignar a Moderadores
    reasignar_incidencias: true, // ⭐ Puede reasignar
    resolver_incidencias: true,
    gestionar_usuarios: true,
    gestionar_productos_admin: true,
    registrar_moderadores: true,
    acceso_admin_panel: true,
    configurar_sistema: true,
    ver_reportes_estadisticas: true,
    gestionar_categorias: true,
    gestionar_palabras_prohibidas: true,
  },
};

// Estados de productos
export const ESTADOS_PRODUCTO = {
  ACTIVO: "activo",
  PENDIENTE: "pendiente",
  SUSPENDIDO: "suspendido",
  ELIMINADO: "eliminado",
};

// Estados de incidencias
export const ESTADOS_INCIDENCIA = {
  PENDIENTE: "pendiente",
  EN_REVISION: "en_revision",
  SUSPENDIDO: "suspendido",
  RESUELTO: "resuelto",
};

// Tipos de incidencias
export const TIPOS_INCIDENCIA = {
  DETECCION_AUTOMATICA: "deteccion_automatica",
  REPORTE_USUARIO: "reporte_usuario",
};

// Tipos de reportes
export const TIPOS_REPORTE = {
  DESCRIPCION_INCORRECTA: "descripcion_incorrecta",
  POSIBLE_ESTAFA: "posible_estafa",
  CONTENIDO_INAPROPIADO: "contenido_inapropiado",
  PRODUCTO_DANADO: "producto_danado",
  OTRO: "otro",
};

// Palabras prohibidas (para detección automática)
export const PALABRAS_PROHIBIDAS = [
  "arma",
  "pistola",
  "revólver",
  "rifle",
  "escopeta",
  "droga",
  "cocaína",
  "marihuana",
  "heroína",
  "explosivo",
  "bomba",
  "dinamita",
  "falso",
  "imitación",
  "réplica no auténtica",
];

// Función para verificar si un texto contiene palabras prohibidas
export const contienePalabrasProhibidas = (texto) => {
  const textoLower = texto.toLowerCase();
  return PALABRAS_PROHIBIDAS.some((palabra) =>
    textoLower.includes(palabra.toLowerCase())
  );
};

// Función para obtener permisos de un rol
export const obtenerPermisos = (rol) => {
  const r = normalizeRole(rol);
  return PERMISOS_POR_ROL[r] || {};
};

// Función para verificar si un usuario tiene un permiso específico
export const tienePermiso = (rol, permiso) => {
  const permisos = obtenerPermisos(rol);
  return permisos?.[permiso] === true;
};

// Estados de usuario
export const ESTADOS_USUARIO = {
  ACTIVO: true,
  SUSPENDIDO: false,
};

// ⭐ NUEVA CONFIGURACIÓN: Límites de incidencias por moderador
export const LIMITES_INCIDENCIAS = {
  MAX_INCIDENCIAS_ACTIVAS_POR_MODERADOR: 5, // Máximo 5 incidencias en revisión
  TIEMPO_MAXIMO_RESOLUCION_DIAS: 7, // 7 días para resolver
  ADVERTENCIA_LIMITE_ACTIVAS: 4, // Alerta cuando llega a 4
};

// ⭐ NUEVA FUNCIÓN: Obtener estadísticas de moderador
export const obtenerEstadisticasModerador = (moderadorId, incidencias) => {
  const incidenciasDelMod = incidencias.filter(
    (inc) => inc.moderador_id === moderadorId && inc.estado === "en_revision"
  );

  return {
    incidenciasActivas: incidenciasDelMod.length,
    puedeTomar:
      incidenciasDelMod.length <
      LIMITES_INCIDENCIAS.MAX_INCIDENCIAS_ACTIVAS_POR_MODERADOR,
    advertencia:
      incidenciasDelMod.length >=
      LIMITES_INCIDENCIAS.ADVERTENCIA_LIMITE_ACTIVAS,
    capacidadDisponible:
      LIMITES_INCIDENCIAS.MAX_INCIDENCIAS_ACTIVAS_POR_MODERADOR -
      incidenciasDelMod.length,
  };
};

// ⭐ NUEVA FUNCIÓN: Verificar si puede tomar incidencias
export const puedeTomarIncidencia = (rol, estadisticasModerador) => {
  const r = normalizeRole(rol);
  // Tanto Admin como Moderador respetan el límite de incidencias activas
  if (r === ROLES.ADMIN || r === ROLES.MODERADOR)
    return estadisticasModerador.puedeTomar;
  return false;
};

// ⭐ NUEVA FUNCIÓN: Obtener mensaje de validación
export const obtenerMensajeValidacion = (estadisticasModerador) => {
  if (!estadisticasModerador.puedeTomar) {
    return `Has alcanzado el límite máximo de ${LIMITES_INCIDENCIAS.MAX_INCIDENCIAS_ACTIVAS_POR_MODERADOR} incidencias activas. Resuelve algunas antes de tomar nuevas.`;
  }

  if (estadisticasModerador.advertencia) {
    return `⚠️ Tienes ${estadisticasModerador.incidenciasActivas} incidencias activas. Solo ${estadisticasModerador.capacidadDisponible} disponible(s).`;
  }

  return null;
};

// Normaliza distintas variantes/alias del rol que puedan venir del backend
export const normalizeRole = (rol) => {
  if (!rol) return rol;

  if (typeof rol === "object") {
    const candidate =
      rol.roleName ||
      rol.role_name ||
      rol.role ||
      rol.name ||
      rol.value ||
      rol.code ||
      rol.roleId ||
      rol.role_id ||
      rol.id;
    if (candidate) {
      return normalizeRole(candidate);
    }
    return rol;
  }

  if (typeof rol === "number") {
    if (rol === 1) return ROLES.ADMIN;
    if (rol === 2) return ROLES.USUARIO;
    if (rol === 3) return ROLES.MODERADOR;
    return rol;
  }

  if (typeof rol !== "string") return rol;

  const raw = rol.trim();
  if (!raw) return raw;

  if (/^\d+$/.test(raw)) {
    return normalizeRole(parseInt(raw, 10));
  }

  // El backend puede enviar formatos como "ROLE_ADMIN" o "ROLE-ADMINISTRADOR"
  const normalizedKey = raw.replace(/^ROLE[_\-\s]?/i, "").toLowerCase();

  // Mapa de alias comunes -> nombre canonical usado en PERMISOS_POR_ROL
  const aliases = {
    admin: ROLES.ADMIN,
    administrador: ROLES.ADMIN,
    administrator: ROLES.ADMIN,
    moderador: ROLES.MODERADOR,
    moderator: ROLES.MODERADOR,
    moderadora: ROLES.MODERADOR,
    usuario: ROLES.USUARIO,
    user: ROLES.USUARIO,
    cliente: ROLES.USUARIO,
    customer: ROLES.USUARIO,
  };

  if (aliases[normalizedKey]) {
    return aliases[normalizedKey];
  }

  // Mantener compatibilidad con valores escritos exactamente igual que en el backend
  if (raw in aliases) {
    return aliases[raw];
  }

  return raw;
};

export default {
  ROLES,
  PERMISOS_POR_ROL,
  ESTADOS_PRODUCTO,
  ESTADOS_INCIDENCIA,
  TIPOS_INCIDENCIA,
  TIPOS_REPORTE,
  PALABRAS_PROHIBIDAS,
  contienePalabrasProhibidas,
  obtenerPermisos,
  tienePermiso,
  ESTADOS_USUARIO,
  LIMITES_INCIDENCIAS,
  obtenerEstadisticasModerador,
  puedeTomarIncidencia,
  obtenerMensajeValidacion,
};
