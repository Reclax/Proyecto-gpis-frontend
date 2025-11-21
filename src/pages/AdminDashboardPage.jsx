import { useEffect, useState } from "react";
import { FiAlertTriangle, FiPackage, FiShield, FiUsers } from "react-icons/fi";
import { MdBlock, MdVerified } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { normalizeRole, ROLES } from "../config/roles";
import usePageTitle from "../hooks/usePageTitle";
import api, { incidenceAPI, productAPI, reportAPI } from "../services/api";
import { checkAdminAccess, hasPermission } from "../utils/rolePermissions";

const safeArray = (value) => (Array.isArray(value) ? value : []);

const formatRelativeTime = (dateValue) => {
  if (!dateValue) return "Sin fecha";
  const targetDate = new Date(dateValue);
  if (Number.isNaN(targetDate.getTime())) return "Sin fecha";

  const diffMs = Date.now() - targetDate.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Hace unos segundos";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
};

const buildActivityFeed = (incidences, reports) => {
  const reportActivities = safeArray(reports).map((report) => ({
    id: `report-${report.id}`,
    tipo: "producto_reportado",
    descripcion: `Nuevo reporte sobre el producto ID ${
      report.productId || "desconocido"
    }`,
    fecha: report.dateReport || report.createdAt,
  }));

  const incidenceActivities = safeArray(incidences).map((inc) => ({
    id: `incidence-${inc.id}`,
    tipo:
      inc.estado === "resuelto"
        ? "incidencia_resuelta"
        : inc.estado === "suspendido"
        ? "usuario_suspendido"
        : "moderador_asignado",
    descripcion: `Incidencia ${inc.codigo || inc.id} cambiada a ${
      inc.estado || inc.status
    }`,
    fecha: inc.updatedAt || inc.fecha_actualizacion || inc.createdAt,
  }));

  return [...reportActivities, ...incidenceActivities]
    .sort((a, b) => {
      const dateA = new Date(a.fecha || 0).getTime();
      const dateB = new Date(b.fecha || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 5)
    .map((activity, index) => ({
      ...activity,
      hora: formatRelativeTime(activity.fecha),
      id: activity.id || index,
    }));
};

function AdminDashboardPage() {
  usePageTitle("Panel de Administración");
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState("Admin");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);

  useEffect(() => {
    // Verificar acceso al panel de admin
    const access = checkAdminAccess();

    if (!access.isAllowed) {
      // Redirigir si no tiene acceso
      navigate(access.redirectPath || "/");
      return;
    }

    setUserRole(access.userRole);
    setIsAuthorized(true);
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    if (!isAuthorized) return;

    const fetchDashboardData = async () => {
      try {
        setStatsLoading(true);
        setStatsError(null);

        const [usersResponse, productsData, incidencesData, reportsData] =
          await Promise.all([
            api.get("/users/").catch(() => ({ data: [] })),
            productAPI.getAll().catch(() => []),
            incidenceAPI.getAll().catch(() => []),
            reportAPI.getAll().catch(() => []),
          ]);

        const users = safeArray(usersResponse.data);
        const products = safeArray(productsData);
        const incidences = safeArray(incidencesData);
        const reports = safeArray(reportsData);

        const totalUsuarios = users.length;
        const usuariosSuspendidos = users.filter((user) => {
          if (typeof user.estado === "boolean") return !user.estado;
          if (typeof user.status === "boolean") return !user.status;
          if (typeof user.isActive === "boolean") return !user.isActive;
          if (typeof user.enabled === "boolean") return !user.enabled;
          return false;
        }).length;
        const usuariosActivos = totalUsuarios - usuariosSuspendidos;

        const moderadoresActivos = users.filter((user) => {
          const rawRole =
            user?.Roles?.[0] ||
            user?.roles?.[0] ||
            user?.role ||
            user?.primaryRole;
          return normalizeRole(rawRole) === ROLES.MODERADOR;
        }).length;

        const totalProductos = products.length;
        const productosActivos = products.filter((product) => {
          const status = (product.moderationStatus || product.status || "")
            .toString()
            .toLowerCase();
          return (
            status !== "suspendido" &&
            status !== "eliminado" &&
            status !== "blocked"
          );
        }).length;
        const productosSuspendidos = totalProductos - productosActivos;

        const incidenciasPendientes = incidences.filter((incident) => {
          const state = (
            incident.estado ||
            incident.status ||
            ""
          ).toLowerCase();
          return state === "pendiente";
        }).length;
        const incidenciasEnRevision = incidences.filter((incident) => {
          const state = (
            incident.estado ||
            incident.status ||
            ""
          ).toLowerCase();
          return state === "en_revision";
        }).length;

        setDashboardStats({
          totalUsuarios,
          usuariosActivos,
          usuariosSuspendidos,
          totalProductos,
          productosActivos,
          productosSuspendidos,
          productosReportados: reports.length,
          incidenciasPendientes,
          incidenciasEnRevision,
          moderadoresActivos,
        });

        setActivityFeed(buildActivityFeed(incidences, reports));
      } catch (error) {
        console.error("Error cargando estadísticas del dashboard:", error);
        setStatsError("No se pudieron cargar las estadísticas en tiempo real.");
      } finally {
        setStatsLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAuthorized]);

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
      className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all ${
        onClick ? "cursor-pointer hover:scale-105" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <h3 className="text-3xl font-bold mb-1" style={{ color }}>
            {value}
          </h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="text-2xl" style={{ color }} />
        </div>
      </div>
    </div>
  );

  const QuickActionCard = ({
    icon: Icon,
    title,
    description,
    color,
    onClick,
  }) => (
    <button
      onClick={onClick}
      className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all text-left w-full group hover:border-gray-300"
    >
      <div className="flex items-start gap-4">
        <div
          className="p-3 rounded-lg group-hover:scale-110 transition-transform"
          style={{ backgroundColor: `${color}15` }}
        >
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
        case "producto_reportado":
          return <FiAlertTriangle className="text-red-500" />;
        case "usuario_suspendido":
          return <MdBlock className="text-red-600" />;
        case "incidencia_resuelta":
          return <MdVerified className="text-green-500" />;
        case "apelacion_recibida":
          return <FiAlertTriangle className="text-orange-500" />;
        case "moderador_asignado":
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

  const statsData = dashboardStats || {
    totalUsuarios: 0,
    usuariosActivos: 0,
    usuariosSuspendidos: 0,
    totalProductos: 0,
    productosActivos: 0,
    productosSuspendidos: 0,
    productosReportados: 0,
    incidenciasPendientes: 0,
    incidenciasEnRevision: 0,
    moderadoresActivos: 0,
  };

  const displayedActivity = activityFeed.length > 0 ? activityFeed : [];

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
              <p className="text-gray-600 mt-2">
                Gestiona usuarios, productos e incidencias de la plataforma
              </p>
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
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Estadísticas Generales
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {hasPermission("gestionar_usuarios") && (
                  <StatCard
                    icon={FiUsers}
                    title="Total Usuarios"
                    value={statsData.totalUsuarios.toLocaleString()}
                    subtitle={`${statsData.usuariosActivos} activos`}
                    color="#3B82F6"
                    onClick={() => navigate("/admin/usuarios")}
                  />
                )}
                {hasPermission("gestionar_productos_admin") && (
                  <StatCard
                    icon={FiPackage}
                    title="Total Productos"
                    value={statsData.totalProductos.toLocaleString()}
                    subtitle={`${statsData.productosActivos} activos`}
                    color="#10B981"
                    onClick={() => navigate("/admin/productos")}
                  />
                )}
                {hasPermission("gestionar_incidencias") && (
                  <StatCard
                    icon={FiAlertTriangle}
                    title="Incidencias Pendientes"
                    value={statsData.incidenciasPendientes}
                    subtitle={`${statsData.incidenciasEnRevision} en revisión`}
                    color="#EF4444"
                    onClick={() => navigate("/admin/incidencias")}
                  />
                )}
                {userRole === "Admin" && (
                  <StatCard
                    icon={FiShield}
                    title="Moderadores Activos"
                    value={statsData.moderadoresActivos}
                    subtitle="En plataforma"
                    color="#8B5CF6"
                  />
                )}
              </div>
              {statsLoading && (
                <p className="text-sm text-gray-500 mt-3">
                  Cargando información en tiempo real...
                </p>
              )}
              {statsError && (
                <p className="text-sm text-red-600 mt-3">{statsError}</p>
              )}
            </div>

            {/* Alertas críticas */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Alertas Críticas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <MdBlock className="text-2xl text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-red-900">
                        Usuarios Suspendidos
                      </h3>
                      <p className="text-sm text-red-700">Requieren revisión</p>
                    </div>
                  </div>
                  <p className="text-3xl font-black text-red-600 mb-4">
                    {statsData.usuariosSuspendidos}
                  </p>
                  <button
                    onClick={() => navigate("/admin/usuarios")}
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
                      <h3 className="font-bold text-orange-900">
                        Productos Reportados
                      </h3>
                      <p className="text-sm text-orange-700">
                        Pendientes de revisión
                      </p>
                    </div>
                  </div>
                  <p className="text-3xl font-black text-orange-600 mb-4">
                    {statsData.productosReportados}
                  </p>
                  <button
                    onClick={() => navigate("/admin/incidencias")}
                    className="text-sm text-orange-700 font-semibold hover:text-orange-800 underline"
                  >
                    Revisar ahora →
                  </button>
                </div>
              </div>
            </div>

            {/* Acciones rápidas */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Acciones Rápidas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hasPermission("gestionar_usuarios") && (
                  <QuickActionCard
                    icon={FiUsers}
                    title="Gestionar Usuarios"
                    description="Ver, activar o suspender cuentas"
                    color="#3B82F6"
                    onClick={() => navigate("/admin/usuarios")}
                  />
                )}
                {hasPermission("gestionar_incidencias") && (
                  <QuickActionCard
                    icon={FiAlertTriangle}
                    title="Revisar Incidencias"
                    description="Gestionar reportes y productos"
                    color="#F59E0B"
                    onClick={() => navigate("/admin/incidencias")}
                  />
                )}
                {hasPermission("registrar_moderadores") && (
                  <QuickActionCard
                    icon={FiShield}
                    title="Registrar Moderador"
                    description="Dar de alta nuevos moderadores"
                    color="#8B5CF6"
                    onClick={() => navigate("/admin/moderadores")}
                  />
                )}
                {hasPermission("gestionar_productos_admin") && (
                  <QuickActionCard
                    icon={FiPackage}
                    title="Gestionar Productos"
                    description="Ver y administrar todos los productos"
                    color="#10B981"
                    onClick={() => navigate("/admin/productos")}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Columna 2: Actividades recientes */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Actividad Reciente
              </h2>
              <div className="space-y-0">
                {displayedActivity.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Aún no hay actividad reciente para mostrar.
                  </p>
                )}
                {displayedActivity.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
              <button
                className="mt-6 w-full py-2 text-center text-orange-600 font-semibold hover:text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-50 transition"
                onClick={() => navigate("/admin/incidencias")}
              >
                Ir a actividad detallada
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
