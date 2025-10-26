import { Link } from 'react-router-dom';
import { authAPI } from '../../services/api';

/**
 * Componente para enlaces que requieren autenticación.
 * Si el usuario no está autenticado, redirige al login con la URL de destino.
 * Si está autenticado, navega normalmente.
 */
function AuthLink({ to, children, className, onClick, ...props }) {
  const handleClick = (e) => {
    if (!authAPI.isAuthenticated()) {
      e.preventDefault();
      // Redirigir al login guardando la página de destino
      window.location.href = `/login?redirect=${encodeURIComponent(to)}`;
    }
    if (onClick) onClick(e);
  };

  return (
    <Link to={to} className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}

export default AuthLink;