import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiMoreVertical, FiCheck, FiX, FiUser, FiMail, FiPhone, FiMapPin, FiCalendar, FiStar } from 'react-icons/fi';
import { MdBlock, MdVerified } from 'react-icons/md';
import usePageTitle from '../hooks/usePageTitle';
import Modal from '../components/common/Modal';
import { checkAdminAccess } from '../utils/rolePermissions';
import api, { authAPI, API_BASE_URL } from '../services/api';

//

function GestionUsuariosPage() {
  usePageTitle('Gestión de Usuarios');
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterRol, setFilterRol] = useState('todos');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(null);
  const [modalData, setModalData] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

  useEffect(() => {
    const access = checkAdminAccess('gestionar_usuarios');

    if (!access.isAllowed) {
      navigate(access.redirectPath || '/');
      return;
    }

    setIsAuthorized(true);

    const loadUsers = async () => {
      try {
        setLoading(true);
        if (!authAPI.isAuthenticated()) {
          navigate('/login');
          return;
        }

        const { data } = await api.get('/users/');
        const mapped = (Array.isArray(data) ? data : []).map((user) => {
          const backendRole = user?.Roles?.[0]?.roleName || 'Usuario';
          const rol = backendRole === 'Administrador' ? 'Admin'
                    : backendRole === 'Moderador' ? 'Moderador'
                    : 'Usuario'; 
          return {
            id: user.id,
            cedula: user.dni || '',
            nombre: user.name || '',
            apellido: user.lastname || '',
            email: user.email || '',
            telefono: user.phone || 'No disponible',
            direccion: 'No disponible',
            genero: 'No especificado',
            estado: true,
            fecha_registro: user.createdAt || new Date().toISOString(),
            rating_promedio: user.rating ? parseFloat(user.rating) : null,
            total_productos: 0,
            total_ventas: 0,
            rol,
            avatarUrl: user.avatarUrl ? `${API_BASE_URL}${user.avatarUrl}` : null,
          };
        });
        setUsuarios(mapped);
      } catch (error) {
        console.error('Error al cargar usuarios:', error);
        if (error.response?.status === 401) {
          navigate('/login');
          return;
        }
        setModalData({
          isOpen: true,
          type: 'error',
          title: 'Error',
          message: 'No se pudieron cargar los usuarios. Intenta nuevamente.',
          confirmText: 'Entendido',
        });
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [navigate]);

  const usuariosFiltrados = usuarios.filter(user => {
    const matchSearch =
      user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.cedula.includes(searchTerm);

    const matchEstado =
      filterEstado === 'todos' ||
      (filterEstado === 'activos' && user.estado) ||
      (filterEstado === 'suspendidos' && !user.estado);

    const matchRol =
      filterRol === 'todos' || user.rol === filterRol;

    return matchSearch && matchEstado && matchRol;
  });

  const toggleUserStatus = (user) => {
    const action = user.estado ? 'suspender' : 'activar';
    setModalData({
      isOpen: true,
      type: 'confirm',
      title: `${action === 'suspender' ? 'Suspender' : 'Activar'} Usuario`,
      message: `¿Estás seguro de que deseas ${action} la cuenta de ${user.nombre} ${user.apellido}?${action === 'suspender' ? '\n\nEsta acción ocultará todos sus productos y reportes.' : ''}`,
      onConfirm: () => {
        setUsuarios(prev =>
          prev.map(u => u.id === user.id ? { ...u, estado: !u.estado } : u)
        );
        setModalData({
          isOpen: true,
          type: 'success',
          title: 'Éxito',
          message: `Usuario ${action === 'suspender' ? 'suspendido' : 'activado'} correctamente. El usuario ha sido notificado.`,
          confirmText: 'Entendido'
        });
        setShowDropdown(null);
      },
      confirmText: action === 'suspender' ? 'Suspender' : 'Activar',
      cancelText: 'Cancelar'
    });
  };

  const verDetalles = (user) => {
    setSelectedUser(user);
    setShowDropdown(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getRoleColor = (rol) => {
    switch(rol) {
      case 'Usuario': return 'bg-blue-100 text-blue-800';
      case 'Moderador': return 'bg-purple-100 text-purple-800';
      case 'Admin': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="sb-container max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
            <FiUser className="text-blue-500" />
            Gestión de Usuarios
          </h1>
          <p className="text-gray-600 mt-1">Administra y supervisa las cuentas de usuarios de la plataforma</p>
        </div>

        {/* Filtros y búsqueda */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Búsqueda */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nombre, email o cédula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Filtro por estado */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="suspendidos">Suspendidos</option>
              </select>
            </div>

            {/* Filtro por rol */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
              <select
                value={filterRol}
                onChange={(e) => setFilterRol(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="todos">Todos los roles</option>
                <option value="Usuario">Usuario</option>
                <option value="Moderador">Moderador</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{usuarios.length}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{usuarios.filter(u => u.estado).length}</p>
              <p className="text-sm text-gray-600">Activos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{usuarios.filter(u => !u.estado).length}</p>
              <p className="text-sm text-gray-600">Suspendidos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{usuarios.filter(u => u.rol === 'Moderador').length}</p>
              <p className="text-sm text-gray-600">Moderadores</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{usuarios.filter(u => u.rol === 'Usuario').length}</p>
              <p className="text-sm text-gray-600">Usuarios</p>
            </div>
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estadísticas</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {usuariosFiltrados.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {user.nombre[0]}{user.apellido[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.nombre} {user.apellido}</p>
                          <p className="text-sm text-gray-500">CI: {user.cedula}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 flex items-center gap-2">
                        <FiMail className="text-gray-400" /> {user.email}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <FiPhone className="text-gray-400" /> {user.telefono}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getRoleColor(user.rol)}`}>
                        {user.rol}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.rol !== 'Moderador' ? (
                        <div className="text-sm">
                          <p className="text-gray-900 font-semibold">{user.total_productos} productos</p>
                          <p className="text-gray-500">{user.total_ventas} ventas</p>
                          {user.rating_promedio && (
                            <div className="flex items-center gap-1 mt-1">
                              <FiStar className="text-yellow-500 fill-current" />
                              <span className="font-semibold">{user.rating_promedio}/5.0</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">-</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.estado ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          <FiCheck className="text-xs" />
                          Activo
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                            <MdBlock className="text-xs" />
                            Suspendido
                          </span>
                          {user.razon_suspension && (
                            <p className="text-xs text-gray-500 mt-1">{user.razon_suspension}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <button
                          onClick={() => setShowDropdown(showDropdown === user.id ? null : user.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <FiMoreVertical />
                        </button>

                        {showDropdown === user.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                            <button
                              onClick={() => verDetalles(user)}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm font-medium border-b border-gray-200"
                            >
                              <FiUser className="text-blue-500" />
                              Ver detalles
                            </button>
                            <button
                              onClick={() => toggleUserStatus(user)}
                              className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm font-medium ${
                                user.estado ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {user.estado ? <MdBlock /> : <FiCheck />}
                              {user.estado ? 'Suspender' : 'Activar'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {usuariosFiltrados.length === 0 && (
            <div className="text-center py-12">
              <FiUser className="mx-auto text-4xl text-gray-300 mb-3" />
              <p className="text-gray-500 font-semibold">No se encontraron usuarios</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalles */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FiUser /> Detalles de {selectedUser.nombre} {selectedUser.apellido}
              </h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-white hover:bg-orange-700 p-2 rounded-lg transition"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 space-y-6">
              {/* Información personal */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Información Personal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Nombres</p>
                    <p className="font-semibold text-gray-900">{selectedUser.nombre} {selectedUser.apellido}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Cédula</p>
                    <p className="font-semibold text-gray-900">{selectedUser.cedula}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Género</p>
                    <p className="font-semibold text-gray-900">{selectedUser.genero}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Rol</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getRoleColor(selectedUser.rol)}`}>
                      {selectedUser.rol}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Contacto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <FiMail /> Email
                    </p>
                    <p className="font-semibold text-gray-900">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <FiPhone /> Teléfono
                    </p>
                    <p className="font-semibold text-gray-900">{selectedUser.telefono}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <FiMapPin /> Dirección
                    </p>
                    <p className="font-semibold text-gray-900">{selectedUser.direccion}</p>
                  </div>
                </div>
              </div>

              {/* Registro y estado */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Registro y Estado</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <FiCalendar /> Fecha de Registro
                    </p>
                    <p className="font-semibold text-gray-900">{formatDate(selectedUser.fecha_registro)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Estado de Cuenta</p>
                    {selectedUser.estado ? (
                      <p className="font-semibold text-green-600">✓ Activo</p>
                    ) : (
                      <div>
                        <p className="font-semibold text-red-600">✗ Suspendido</p>
                        {selectedUser.razon_suspension && (
                          <p className="text-sm text-gray-600 mt-1">{selectedUser.razon_suspension}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Estadísticas de actividad (para usuarios regulares) */}
              {selectedUser.rol === 'Usuario' && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Estadísticas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-blue-600">{selectedUser.total_productos}</p>
                      <p className="text-sm text-blue-700 font-semibold">Productos Publicados</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-green-600">{selectedUser.total_ventas}</p>
                      <p className="text-sm text-green-700 font-semibold">Ventas Realizadas</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                        <FiStar className="fill-current" /> {selectedUser.rating_promedio || 'N/A'}
                      </p>
                      <p className="text-sm text-yellow-700 font-semibold">Calificación Promedio</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="border-t border-gray-200 pt-6 flex gap-3 justify-end">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    toggleUserStatus(selectedUser);
                    setSelectedUser(null);
                  }}
                  className={`px-4 py-2 text-white rounded-lg transition font-semibold ${
                    selectedUser.estado
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {selectedUser.estado ? 'Suspender' : 'Activar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalData.isOpen}
        type={modalData.type}
        title={modalData.title}
        message={modalData.message}
        onClose={() => setModalData({ ...modalData, isOpen: false })}
        onConfirm={modalData.onConfirm}
        confirmText={modalData.confirmText || 'Confirmar'}
        cancelText={modalData.cancelText}
        onCancel={() => setModalData({ ...modalData, isOpen: false })}
      />
    </div>
  );
}

export default GestionUsuariosPage;

