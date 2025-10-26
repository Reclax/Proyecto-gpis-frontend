import { Navigate, useLocation } from 'react-router-dom';
import { authAPI } from '../../services/api';

function ProtectedRoute({ children }) {
  const location = useLocation();
  const isAuthenticated = authAPI.isAuthenticated();

  if (!isAuthenticated) {
    // Guardar la ruta actual para redirigir después del login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;