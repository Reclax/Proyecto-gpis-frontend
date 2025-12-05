import { Navigate, useLocation } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { normalizeRole, ROLES } from '../../config/roles';

// allowedRoles: lista de roles que pueden entrar. Si se define, solo esos entran.
// denyRoles: lista de roles que se rechazan (se mantiene compatibilidad con uso existente).
function ProtectedRoute({ children, denyRoles = [], allowedRoles = null }) {
  const location = useLocation();
  const isAuthenticated = authAPI.isAuthenticated();

  if (!isAuthenticated) {
    // Guardar la ruta actual para redirigir después del login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  try {
    const user = authAPI.getUserData();
    let role = null;
    if (user) {
      if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
        const r = user.roles[0];
        role = typeof r === 'string' ? normalizeRole(r) : normalizeRole(r?.roleName || r?.role || r?.name || '');
      } else {
        role = normalizeRole(user.role || null);
      }
    }

    // Bloqueo por denyRoles (comportamiento existente)
    if (role && Array.isArray(denyRoles) && denyRoles.length > 0 && denyRoles.includes(role)) {
      return <Navigate to="/" replace />;
    }

    // Si hay lista de roles permitidos y el usuario no pertenece
    if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      if (!role || !allowedRoles.includes(role)) {
        return <Navigate to="/" replace />;
      }
    }
  } catch {
    // Error determinando rol -> denegar si la ruta exige roles específicos
    if (allowedRoles) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;