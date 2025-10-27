import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FiUsers, FiAlertTriangle, FiShield, FiPackage, FiBarChart2, FiSettings } from 'react-icons/fi';
import { MdVerified, MdBlock } from 'react-icons/md';
import usePageTitle from '../hooks/usePageTitle';
import { checkAdminAccess, hasPermission } from '../utils/rolePermissions';

// Datos demo
const statsData = {
  totalUsuarios: 1250,
  usuariosActivos: 1180,
  usuariosSuspendidos: 70,
  totalProductos: 3420,
  productosActivos: 3100,
  productosSuspendidos: 245,
  productosReportados: 75,
  incidenciasPendientes: 28,
  incidenciasEnRevision: 12,
  moderadoresActivos: 5,
  productosEliminados: 75,
  ingresosMes: '$45,320.00',
  tasaConversion: '3.24%'
};

// Actividades recientes
const actividadesRecientes = [
  { id: 1, tipo: 'producto_reportado', descripcion: 'Producto "iPhone 15 Pro" reportado como posible estafa', hora: 'Hace 2 horas' },
  { id: 2, tipo: 'usuario_suspendido', descripcion: 'Usuario "carlos_ramirez" ha sido suspendido', hora: 'Hace 4 horas' },
  { id: 3, tipo: 'incidencia_resuelta', descripcion: 'Incidencia #45 resuelta - Producto aprobado', hora: 'Hace 6 horas' },
  { id: 4, tipo: 'apelacion_recibida', descripcion: 'Nueva apelación de vendedor sobre incidencia #44', hora: 'Hace 8 horas' },
  { id: 5, tipo: 'moderador_asignado', descripcion: 'Laura Moderadora asignada a 3 nuevas incidencias', hora: 'Hace 10 horas' }
];

function AdminDashboardPage() {
  usePageTitle('Panel de Administración');
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState('Admin');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar acceso al panel de admin
    const access = checkAdminAccess();

    if (!access.isAllowed) {
      // Redirigir si no tiene acceso
      navigate(access.redirectPath || '/');
      return;
    }

    setUserRole(access.userRole);
    setIsAuthorized(true);
    setLoading(false);
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const StatCard = ({ icon: Icon, title, value, subtitle, color, onClick }) => (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <h3 className="text-3xl font-bold mb-1" style={{ color }}>{value}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon className="text-2xl" style={{ color }} />
        </div>
      </div>
    </div>
  );

  const QuickActionCard = ({ icon: Icon, title, description, color, onClick }) => (
    <button
      onClick={onClick}
      className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all text-left w-full group hover:border-gray-300"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: `${color}15` }}>
          <Icon className="text-2xl" style={{ color }} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </button>
  );

  const ActivityItem = ({ activity }) => {
    const getActivityIcon = () => {
      switch (activity.tipo) {
        case 'producto_reportado':
          return <FiAlertTriangle className="text-red-500" />;
        case 'usuario_suspendido':
          return <MdBlock className="text-red-600" />;
        case 'incidencia_resuelta':
          return <MdVerified className="text-green-500" />;
        case 'apelacion_recibida':
          return <FiAlertTriangle className="text-orange-500" />;
        case 'moderador_asignado':
          return <FiShield className="text-purple-500" />;
        default:
          return <FiPackage className="text-blue-500" />;
      }
    };

    return (
      <div className="flex items-start gap-4 py-4 border-b border-gray-200 last:border-b-0">
        <div className="flex-shrink-0 mt-1">{getActivityIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900">{activity.descripcion}</p>
          <p className="text-xs text-gray-500 mt-1">{activity.hora}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="sb-container max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                <FiShield className="text-orange-500" />
                Panel de Administración
              </h1>
              <p className="text-gray-600 mt-2">Gestiona usuarios, productos e incidencias de la plataforma</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg">
              <MdVerified className="text-lg" />
              <span className="font-semibold">{userRole}</span>
            </div>
          </div>
        </div>

        {/* Grid principal - 2 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna 1: Estadísticas */}
          <div className="lg:col-span-2">
            {/* Estadísticas principales */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Estadísticas Generales</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {hasPermission('gestionar_usuarios') && (
                  <StatCard
                    icon={FiUsers}
                    title="Total Usuarios"
                    value={statsData.totalUsuarios.toLocaleString()}
                    subtitle={`${statsData.usuariosActivos} activos`}
                    color="#3B82F6"
                    onClick={() => navigate('/admin/usuarios')}
                  />
                )}
                {hasPermission('gestionar_productos_admin') && (
                  <StatCard
                    icon={FiPackage}
                    title="Total Productos"
                    value={statsData.totalProductos.toLocaleString()}
                    subtitle={`${statsData.productosActivos} activos`}
                    color="#10B981"
                    onClick={() => navigate('/admin/productos')}
                  />
                )}
                {hasPermission('gestionar_incidencias') && (
                  <StatCard
                    icon={FiAlertTriangle}
                    title="Incidencias Pendientes"
                    value={statsData.incidenciasPendientes}
                    subtitle={`${statsData.incidenciasEnRevision} en revisión`}
                    color="#EF4444"
                    onClick={() => navigate('/admin/incidencias')}
                  />
                )}
                {userRole === 'Admin' && (
                  <StatCard
                    icon={FiShield}
                    title="Moderadores Activos"
                    value={statsData.moderadoresActivos}
                    subtitle="En plataforma"
                    color="#8B5CF6"
                  />
                )}
              </div>
            </div>

            {/* Alertas críticas */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Alertas Críticas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <MdBlock className="text-2xl text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-red-900">Usuarios Suspendidos</h3>
                      <p className="text-sm text-red-700">Requieren revisión</p>
                    </div>
                  </div>
                  <p className="text-3xl font-black text-red-600 mb-4">{statsData.usuariosSuspendidos}</p>
                  <button
                    onClick={() => navigate('/admin/usuarios')}
                    className="text-sm text-red-700 font-semibold hover:text-red-800 underline"
                  >
                    Ver detalles →
                  </button>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <FiAlertTriangle className="text-2xl text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-orange-900">Productos Reportados</h3>
                      <p className="text-sm text-orange-700">Pendientes de revisión</p>
                    </div>
                  </div>
                  <p className="text-3xl font-black text-orange-600 mb-4">{statsData.productosReportados}</p>
                  <button
                    onClick={() => navigate('/admin/incidencias')}
                    className="text-sm text-orange-700 font-semibold hover:text-orange-800 underline"
                  >
                    Revisar ahora →
                  </button>
                </div>
              </div>
            </div>

            {/* Acciones rápidas */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Acciones Rápidas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <QuickActionCard
                  icon={FiUsers}
                  title="Gestionar Usuarios"
                  description="Ver, activar o suspender cuentas"
                  color="#3B82F6"
                  onClick={() => navigate('/admin/usuarios')}
                />
                <QuickActionCard
                  icon={FiAlertTriangle}
                  title="Revisar Incidencias"
                  description="Gestionar reportes y productos"
                  color="#F59E0B"
                  onClick={() => navigate('/admin/incidencias')}
                />
                <QuickActionCard
                  icon={FiShield}
                  title="Registrar Moderador"
                  description="Dar de alta nuevos moderadores"
                  color="#8B5CF6"
                  onClick={() => navigate('/admin/moderadores')}
                />
                <QuickActionCard
                  icon={FiPackage}
                  title="Gestionar Productos"
                  description="Ver y administrar todos los productos"
                  color="#10B981"
                  onClick={() => navigate('/admin/productos')}
                />
                <QuickActionCard
                  icon={FiBarChart2}
                  title="Reportes y Estadísticas"
                  description="Ver análisis detallado de la plataforma"
                  color="#06B6D4"
                  onClick={() => alert('Módulo en desarrollo')}
                />
                <QuickActionCard
                  icon={FiSettings}
                  title="Configuración"
                  description="Ajustes generales del sistema"
                  color="#6366F1"
                  onClick={() => alert('Módulo en desarrollo')}
                />
              </div>
            </div>
          </div>

          {/* Columna 2: Actividades recientes */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Actividad Reciente</h2>
              <div className="space-y-0">
                {actividadesRecientes.map(activity => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
              <button className="mt-6 w-full py-2 text-center text-orange-600 font-semibold hover:text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-50 transition">
                Ver todas las actividades
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
