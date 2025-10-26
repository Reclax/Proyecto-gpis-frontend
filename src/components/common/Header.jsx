import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authAPI, API_BASE_URL } from '../../services/api';
import logo from '../../assets/Logo de Shop&Buy.png';
import { FiSearch, FiUser, FiPackage, FiBell, FiHeart, FiMessageSquare, FiLogOut } from 'react-icons/fi';
import NotificationIcon from './NotificationIcon';
import useNotifications from '../../hooks/useNotifications';
import { useWebSocket } from '../../hooks/useWebSocket';

function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  
  // Hook para notificaciones
  const { unreadCount } = useNotifications();
  
  // Hook para WebSocket
  const { connect: connectWS } = useWebSocket();

  useEffect(() => {
    // Verificar si hay sesión activa
    const checkAuth = () => {
      if (authAPI.isAuthenticated()) {
        setIsLoggedIn(true);
        const user = authAPI.getUserData();
        setUserData(user);
      } else {
        setIsLoggedIn(false);
        setUserData(null);
      }
    };

    checkAuth();
    
    // Revisar cada 30 segundos si sigue autenticado
    const interval = setInterval(checkAuth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Escuchar cambios en los datos del usuario
    const handleUserDataUpdate = (event) => {
      if (authAPI.isAuthenticated()) {
        setUserData(event.detail);
      }
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdate);
    
    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate);
    };
  }, []);

  // Conectar WebSocket cuando el usuario esté logueado (para notificaciones en tiempo real)
  useEffect(() => {
    if (isLoggedIn && userData) {
      const initWebSocket = async () => {
        try {
          await connectWS();
        } catch {
          // No se pudo conectar WebSocket en Header, las notificaciones pueden no ser en tiempo real
        }
      };

      initWebSocket();
    }
  }, [isLoggedIn, userData, connectWS]);

  useEffect(() => {
    // Cerrar dropdown al hacer clic fuera
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.user-dropdown')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown]);

  const handleLogout = () => {
    authAPI.logout();
    setIsLoggedIn(false);
    setUserData(null);
    setShowDropdown(false);
    window.location.href = '/';
  };

  // Función para obtener avatar URL
  const getAvatarUrl = (user) => {
    if (!user) return null;
    
    // Cache buster basado en el timestamp del usuario para evitar regeneración constante
    const cacheBuster = user.updatedAt ? `?v=${new Date(user.updatedAt).getTime()}` : `?v=${Date.now()}`;
    
    // Si es una URL de datos base64, usarla directamente
    if (user.avatarUrl?.startsWith('data:')) {
      return user.avatarUrl;
    }
    
    // Si ya es una URL completa del servidor, usarla
    if (user.avatarUrl?.startsWith(API_BASE_URL)) {
      return user.avatarUrl.includes('?') ? user.avatarUrl : `${user.avatarUrl}${cacheBuster}`;
    }
    
    // Si es una ruta del servidor que empieza con /, construir URL completa
    if (user.avatarUrl?.startsWith('/')) {
      return `${API_BASE_URL}${user.avatarUrl}${cacheBuster}`;
    }
    
    // Si tenemos DNI, construir ruta por defecto
    if (user.dni) {
      return `${API_BASE_URL}/uploads/users/${user.dni}/${user.dni}.jpg${cacheBuster}`;
    }
    
    // Fallback: imagen por defecto del servidor
    return `${API_BASE_URL}/uploads/common/user-common.png${cacheBuster}`;
  };

  // Función para obtener rol del usuario
  const getUserRole = (user) => {
    if (!user) return 'Usuario';
    
    // Si viene en el token decodificado
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles[0] || 'Usuario';
    }
    
    // Si no hay roles, intentar decodificar el token actual
    if (authAPI.isAuthenticated()) {
      try {
        const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.roles?.[0] || 'Usuario';
        }
      } catch {
        // Error decodificando token para rol
      }
    }
    
    // Fallback
    return user.role || 'Usuario';
  };

  // Función para obtener nombre del usuario
  const getUserName = (user) => {
    if (!user) return 'Usuario';
    
    // Si tiene nombre y apellido
    if (user.name) {
      return `${user.name} ${user.lastname || ''}`.trim();
    }
    
    // Si no hay nombre, intentar decodificar el token
    if (authAPI.isAuthenticated()) {
      try {
        const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.email) {
            return payload.email.split('@')[0]; // Usar parte antes del @
          }
        }
      } catch {
        // Error decodificando token para nombre
      }
    }
    
    // Fallback usando email si está disponible
    if (user.email) {
      return user.email.split('@')[0];
    }
    
    return 'Usuario';
  };

  // Función para manejar la búsqueda
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Navegar a la página de productos con el término de búsqueda como query param
      navigate(`/productos?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      // Si no hay término de búsqueda, ir a productos sin filtro
      navigate('/productos');
    }
  };

  return (
    <header className="sticky top-0 z-50 shadow-lg">
      {/* Barra principal con buscador integrado */}
      <div style={{ backgroundColor: '#CF5C36' }}>
        <div className="sb-container py-4">
          <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6">
            {/* Logo y marca */}
            <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
              <div className="relative">
                <img
                  src={logo}
                  alt="Shop&Buy logo"
                  className="h-12 w-12 rounded-xl shadow-md bg-white p-1 group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="text-white">
                <h1 className="font-black text-xl tracking-tight">Shop&Buy</h1>
                <p className="text-xs opacity-90 -mt-1">Compra • Vende • Descubre</p>
              </div>
            </Link>

            {/* Buscador integrado - Ahora en el centro */}
            <form onSubmit={handleSearch} className="flex-1 max-w-3xl w-full">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="¿Qué estás buscando? iPhone, sofá, bicicleta..."
                  className="w-full pl-12 pr-28 py-3 rounded-xl border-2 border-white/30 focus:border-white focus:ring-2 focus:ring-white/50 focus:outline-none text-gray-700 bg-white/95 backdrop-blur-sm placeholder:text-gray-500"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-semibold shadow-md"
                >
                  Buscar
                </button>
              </div>
            </form>

            {/* Navegación y botones de acción */}
            <div className="flex items-center gap-3 lg:gap-6 flex-shrink-0">
              {/* Navegación desktop */}
              <nav className="hidden xl:flex items-center gap-4">
                <Link to="/productos" className="text-white hover:text-yellow-200 font-medium transition-colors text-sm whitespace-nowrap">
                  Explorar
                </Link>
                <Link to="/categorias" className="text-white hover:text-yellow-200 font-medium transition-colors text-sm whitespace-nowrap">
                  Categorías
                </Link>
              </nav>

              {/* Icono de notificaciones */}
              {isLoggedIn && userData && <NotificationIcon />}

              {/* Botones de acción o perfil de usuario */}
              {isLoggedIn && userData ? (
                <div className="relative user-dropdown">
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {/* Avatar circular */}
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-white/20 border-2 border-white/30">
                      {getAvatarUrl(userData) ? (
                        <img
                          src={getAvatarUrl(userData)}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-sm">
                          👤
                        </div>
                      )}
                    </div>

                    {/* Info del usuario */}
                    <div className="text-left text-white hidden lg:block">
                      <p className="font-semibold text-sm leading-tight">
                        {getUserName(userData)}
                      </p>
                      <p className="text-xs opacity-75 leading-tight">
                        {getUserRole(userData)}
                      </p>
                    </div>

                    {/* Flecha */}
                    <div className="text-white/70 hidden lg:block">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </button>

                  {/* Dropdown menu */}
                  {showDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden">
                      {/* Header del dropdown */}
                      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
                        <p className="font-bold text-gray-900">{getUserName(userData)}</p>
                        <p className="text-xs text-gray-600">{getUserRole(userData)}</p>
                      </div>

                      {/* Opciones del menú */}
                      <div className="py-2">
                        <Link
                          to="/mi-perfil"
                          className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 transition-colors group"
                          onClick={() => setShowDropdown(false)}
                        >
                          <FiUser className="w-5 h-5 text-gray-400 group-hover:text-orange-600" />
                          <span className="font-medium">Mi Perfil</span>
                        </Link>
                        <Link
                          to="/mis-productos"
                          className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 transition-colors group"
                          onClick={() => setShowDropdown(false)}
                        >
                          <FiPackage className="w-5 h-5 text-gray-400 group-hover:text-orange-600" />
                          <span className="font-medium">Mis Productos</span>
                        </Link>
                       
                        <Link
                          to="/favoritos"
                          className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 transition-colors group"
                          onClick={() => setShowDropdown(false)}
                        >
                          <FiHeart className="w-5 h-5 text-gray-400 group-hover:text-orange-600" />
                          <span className="font-medium">Favoritos</span>
                        </Link>
                        <Link
                          to="/chat"
                          className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 transition-colors group"
                          onClick={() => setShowDropdown(false)}
                        >
                          <FiMessageSquare className="w-5 h-5 text-gray-400 group-hover:text-orange-600" />
                          <span className="font-medium">Mis Mensajes</span>
                        </Link>
                      </div>

                      {/* Footer del dropdown */}
                      <div className="border-t border-gray-100 mt-2">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 transition-colors group"
                        >
                          <FiLogOut className="w-5 h-5 text-red-400 group-hover:text-red-600" />
                          <span className="font-medium">Cerrar sesión</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="hidden sm:block px-4 py-2 text-white border border-white/30 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/register"
                    className="px-5 py-2 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-md text-sm"
                    style={{ color: '#CF5C36' }}
                  >
                    Registrarse
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
