import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiHeart,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiPackage,
  FiSearch,
  FiUser,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import logo from "../../assets/Logo de Shop&Buy.png";
import { normalizeRole, obtenerPermisos, ROLES } from "../../config/roles";
import useNotifications from "../../hooks/useNotifications";
import { useWebSocket } from "../../hooks/useWebSocket";
import { API_BASE_URL, authAPI } from "../../services/api";
import NotificationIcon from "./NotificationIcon";

function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useNotifications();
  const { connect: connectWS } = useWebSocket();

  useEffect(() => {
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
    const interval = setInterval(checkAuth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleUserDataUpdate = (event) => {
      if (authAPI.isAuthenticated()) {
        setUserData(event.detail);
      }
    };

    window.addEventListener("userDataUpdated", handleUserDataUpdate);
    return () =>
      window.removeEventListener("userDataUpdated", handleUserDataUpdate);
  }, []);

  useEffect(() => {
    if (isLoggedIn && userData) {
      const initWebSocket = async () => {
        try {
          await connectWS();
        } catch {
          // Error connecting WebSocket
        }
      };
      initWebSocket();
    }
  }, [isLoggedIn, userData, connectWS]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest(".user-dropdown")) {
        setShowDropdown(false);
      }
      if (showMobileMenu && !event.target.closest(".mobile-menu-container")) {
        setShowMobileMenu(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showDropdown, showMobileMenu]);

  const handleLogout = () => {
    authAPI.logout();
    setIsLoggedIn(false);
    setUserData(null);
    setShowDropdown(false);
    setShowMobileMenu(false);
    window.location.href = "/";
  };

  const getAvatarUrl = (user) => {
    if (!user) return null;
    const cacheBuster = user.updatedAt
      ? `?v=${new Date(user.updatedAt).getTime()}`
      : `?v=${Date.now()}`;

    if (user.avatarUrl?.startsWith("data:")) return user.avatarUrl;
    if (user.avatarUrl?.startsWith(API_BASE_URL)) {
      return user.avatarUrl.includes("?")
        ? user.avatarUrl
        : `${user.avatarUrl}${cacheBuster}`;
    }
    if (user.avatarUrl?.startsWith("/")) {
      return `${API_BASE_URL}${user.avatarUrl}${cacheBuster}`;
    }
    if (user.dni) {
      return `${API_BASE_URL}/uploads/users/${user.dni}/${user.dni}.jpg${cacheBuster}`;
    }
    return `${API_BASE_URL}/uploads/common/user-common.png${cacheBuster}`;
  };

  const getUserRole = (user) => {
    if (!user) return ROLES.USUARIO;

    const resolveRoleValue = (value) => normalizeRole(value) || null;

    const pickFromCollection = (collection) => {
      if (!Array.isArray(collection) || collection.length === 0) return null;

      for (const entry of collection) {
        const normalized = resolveRoleValue(entry);
        if (normalized) return normalized;

        if (entry?.role) {
          const nested = resolveRoleValue(entry.role);
          if (nested) return nested;
        }

        if (entry?.Role) {
          const nested = resolveRoleValue(entry.Role);
          if (nested) return nested;
        }
      }

      return null;
    };

    const roleFromRoles = pickFromCollection(user.roles);
    if (roleFromRoles) return roleFromRoles;

    const roleFromUpperRoles = pickFromCollection(user.Roles);
    if (roleFromUpperRoles) return roleFromUpperRoles;

    const roleFromUserRoles = pickFromCollection(
      user.user_roles || user.UserRoles
    );
    if (roleFromUserRoles) return roleFromUserRoles;

    const roleFromAuthorities = pickFromCollection(
      user.authorities || user.Authorities
    );
    if (roleFromAuthorities) return roleFromAuthorities;

    if (user.role) {
      return resolveRoleValue(user.role);
    }

    if (user.Role) {
      return resolveRoleValue(user.Role);
    }

    if (user.roleId || user.role_id) {
      const resolved = resolveRoleValue(user.roleId || user.role_id);
      if (resolved) return resolved;
    }

    if (authAPI.isAuthenticated()) {
      try {
        const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.roles?.length) {
            const resolved = resolveRoleValue(payload.roles[0]);
            if (resolved) return resolved;
          }
          if (payload.authorities?.length) {
            const resolved = resolveRoleValue(payload.authorities[0]);
            if (resolved) return resolved;
          }
        }
      } catch {
        // Error decoding token
      }
    }

    return ROLES.USUARIO;
  };

  const getUserName = (user) => {
    if (!user) return "Usuario";
    if (user.name) return `${user.name} ${user.lastname || ""}`.trim();

    if (authAPI.isAuthenticated()) {
      try {
        const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.email) return payload.email.split("@")[0];
        }
      } catch {
        // Error decoding token
      }
    }

    if (user.email) return user.email.split("@")[0];
    return "Usuario";
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/productos?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate("/productos");
    }
  };

  const getMenuOptions = (role) => {
    const r = normalizeRole(role);
    if (r === ROLES.USUARIO) {
      return [
        { label: "Mi Perfil", to: "/mi-perfil", icon: FiUser },
        { label: "Mis Productos", to: "/mis-productos", icon: FiPackage },
        { label: "Favoritos", to: "/favoritos", icon: FiHeart },
        { label: "Mis Mensajes", to: "/chat", icon: FiMessageSquare },
      ];
    }

    if (r === ROLES.MODERADOR || r === ROLES.ADMIN) {
      const permisos = obtenerPermisos(r) || {};
      const adminLinks = [
        {
          label: "Gestionar Incidencias",
          to: "/admin/incidencias",
          icon: FiAlertTriangle,
          section: "moderacion",
          permission: "gestionar_incidencias",
        },
        {
          label: "Gestionar Usuarios",
          to: "/admin/usuarios",
          icon: FiUsers,
          section: "moderacion",
          permission: "gestionar_usuarios",
        },
        {
          label: "Gestionar Productos",
          to: "/admin/productos",
          icon: FiPackage,
          section: "moderacion",
          permission: "gestionar_productos_admin",
        },
        {
          label: "Revisar Apelaciones",
          to: "/admin/incidencias?tab=apelaciones",
          icon: FiAlertTriangle,
          section: "moderacion",
          permission: "ver_apelaciones",
        },
        {
          label: "Registrar Moderadores",
          to: "/admin/moderadores",
          icon: FiUserCheck,
          section: "admin",
          permission: "registrar_moderadores",
        },
      ];

      const filtered = adminLinks.filter(
        (link) => !link.permission || permisos[link.permission]
      );

      if (permisos.acceso_admin_panel) {
        filtered.push({
          label: "Panel de Admin",
          to: "/admin",
          icon: FiBarChart2,
          isAdmin: true,
        });
      }

      return filtered;
    }

    return [];
  };

  const rawUserRole = userData ? getUserRole(userData) : ROLES.USUARIO;
  const userRole = normalizeRole(rawUserRole);
  const menuOptions = getMenuOptions(userRole);

  return (
    <header className="sticky top-0 z-50 shadow-lg">
      <div style={{ backgroundColor: "#CF5C36" }}>
        <div className="sb-container py-4">
          <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6">
            {/* Logo and Brand */}
            <Link
              to="/"
              className="flex items-center gap-3 group flex-shrink-0"
            >
              <div className="relative">
                <img
                  src={logo}
                  alt="Shop&Buy logo"
                  className="h-12 w-12 rounded-xl shadow-md bg-white p-1 group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="text-white">
                <h1 className="font-black text-xl tracking-tight">Shop&Buy</h1>
                <p className="text-xs opacity-90 -mt-1">
                  Compra • Vende • Descubre
                </p>
              </div>
            </Link>

            {/* Search Bar - Desktop */}
            <form
              onSubmit={handleSearch}
              className="flex-1 max-w-3xl w-full hidden sm:block"
            >
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

            {/* Navigation and Actions */}
            <div className="flex items-center gap-3 lg:gap-6 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
              {/* Desktop Navigation */}
              <nav className="hidden xl:flex items-center gap-4">
                <Link
                  to="/productos"
                  className="text-white hover:text-yellow-200 font-medium transition-colors text-sm whitespace-nowrap"
                >
                  Explorar
                </Link>
                <Link
                  to="/categorias"
                  className="text-white hover:text-yellow-200 font-medium transition-colors text-sm whitespace-nowrap"
                >
                  Categorías
                </Link>
              </nav>

              {/* Notifications */}
              {isLoggedIn && userData && <NotificationIcon />}

              {/* User Menu or Auth Buttons */}
              {isLoggedIn && userData ? (
                <>
                  {/* Desktop Dropdown */}
                  <div className="relative user-dropdown hidden lg:block">
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
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

                      <div className="text-left text-white">
                        <p className="font-semibold text-sm leading-tight">
                          {getUserName(userData)}
                        </p>
                        <p className="text-xs opacity-75 leading-tight">
                          {userRole}
                        </p>
                      </div>

                      <div className="text-white/70">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </button>

                    {/* Desktop Dropdown Menu */}
                    {showDropdown && (
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
                          <p className="font-bold text-gray-900">
                            {getUserName(userData)}
                          </p>
                          <p className="text-xs text-gray-600">{userRole}</p>
                        </div>

                        <div className="py-2">
                          {menuOptions.map((option, index) => {
                            const Icon = option.icon;
                            const prevOption =
                              index > 0 ? menuOptions[index - 1] : null;
                            const showSectionDivider =
                              prevOption &&
                              option.section &&
                              prevOption.section !== option.section;

                            return (
                              <div
                                key={option.key || option.to || option.label}
                              >
                                {showSectionDivider && (
                                  <div className="border-t border-gray-100 my-1"></div>
                                )}
                                <Link
                                  to={option.to}
                                  className={`flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors group ${
                                    option.isAdmin
                                      ? "border-t border-gray-100 text-orange-600 font-semibold"
                                      : "text-gray-700"
                                  }`}
                                  onClick={() => setShowDropdown(false)}
                                >
                                  <Icon
                                    className={`w-5 h-5 ${
                                      option.isAdmin
                                        ? "text-orange-600"
                                        : "text-gray-400 group-hover:text-orange-600"
                                    }`}
                                  />
                                  <span className="font-medium">
                                    {option.label}
                                  </span>
                                </Link>
                              </div>
                            );
                          })}
                        </div>

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

                  {/* Mobile Hamburger Menu */}
                  <div className="relative mobile-menu-container lg:hidden">
                    <button
                      onClick={() => setShowMobileMenu(!showMobileMenu)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                      aria-label="Menú"
                    >
                      {showMobileMenu ? (
                        <FiX className="w-6 h-6" />
                      ) : (
                        <FiMenu className="w-6 h-6" />
                      )}
                    </button>

                    {/* Mobile Menu Dropdown */}
                    {showMobileMenu && (
                      <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden">
                        <div className="px-4 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-orange-100 border-2 border-orange-200 flex-shrink-0">
                              {getAvatarUrl(userData) ? (
                                <img
                                  src={getAvatarUrl(userData)}
                                  alt="Avatar"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-orange-600 text-lg font-bold">
                                  {getUserName(userData)
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">
                                {getUserName(userData)}
                              </p>
                              <p className="text-xs text-gray-600">
                                {userRole}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="py-2">
                          {menuOptions.map((option, index) => {
                            const Icon = option.icon;
                            const prevOption =
                              index > 0 ? menuOptions[index - 1] : null;
                            const showSectionDivider =
                              prevOption &&
                              option.section &&
                              prevOption.section !== option.section;

                            return (
                              <div
                                key={option.key || option.to || option.label}
                              >
                                {showSectionDivider && (
                                  <div className="border-t border-gray-100 my-1"></div>
                                )}
                                <Link
                                  to={option.to}
                                  className={`flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors group ${
                                    option.isAdmin
                                      ? "border-t border-gray-100 text-orange-600 font-semibold"
                                      : "text-gray-700"
                                  }`}
                                  onClick={() => setShowMobileMenu(false)}
                                >
                                  <Icon
                                    className={`w-5 h-5 flex-shrink-0 ${
                                      option.isAdmin
                                        ? "text-orange-600"
                                        : "text-gray-400 group-hover:text-orange-600"
                                    }`}
                                  />
                                  <span className="font-medium">
                                    {option.label}
                                  </span>
                                </Link>
                              </div>
                            );
                          })}
                        </div>

                        <div className="border-t border-gray-100 mt-2">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 transition-colors group"
                          >
                            <FiLogOut className="w-5 h-5 text-red-400 group-hover:text-red-600 flex-shrink-0" />
                            <span className="font-medium">Cerrar sesión</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
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
                    style={{ color: "#CF5C36" }}
                  >
                    Registrarse
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Search Bar */}
          {isLoggedIn && (
            <form
              onSubmit={handleSearch}
              className="block sm:hidden mt-4 w-full"
            >
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="¿Qué buscas?"
                  className="w-full pl-12 pr-24 py-3 rounded-xl border-2 border-white/30 focus:border-white focus:ring-2 focus:ring-white/50 focus:outline-none text-gray-700 bg-white/95 backdrop-blur-sm placeholder:text-gray-500"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs font-semibold"
                >
                  Buscar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
