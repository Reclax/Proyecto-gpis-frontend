import { Navigate, useLocation } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { normalizeRole } from '../../config/roles';

function ProtectedRoute({ children, denyRoles = [] }) {
  const location = useLocation();
  const isAuthenticated = authAPI.isAuthenticated();

  if (!isAuthenticated) {
    // Guardar la ruta actual para redirigir después del login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si se pasaron roles a denegar, comprobar el rol del usuario autenticado
  if (Array.isArray(denyRoles) && denyRoles.length > 0) {
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

      if (role && denyRoles.includes(role)) {
        // Rol denegado para esta ruta -> redirigir a inicio
        return <Navigate to="/" replace />;
      }
    } catch {
      // Si hay error al determinar rol, permitir acceso por defecto
    }
  }

  return children;
}

export default ProtectedRoute;