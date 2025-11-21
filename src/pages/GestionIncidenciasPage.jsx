import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiChevronDown,
  FiClock,
  FiInbox,
  FiRefreshCw,
  FiSearch,
  FiTag,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { MdBlock, MdVerified } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import Modal from "../components/common/Modal";
import {
  LIMITES_INCIDENCIAS,
  normalizeRole,
  obtenerEstadisticasModerador,
  obtenerMensajeValidacion,
  puedeTomarIncidencia,
  ROLES,
} from "../config/roles";
import usePageTitle from "../hooks/usePageTitle";
import api, {
  appealAPI,
  authAPI,
  incidenceAPI,
  reportAPI,
} from "../services/api";
import { checkAdminAccess } from "../utils/rolePermissions";

const parseNumericId = (value) => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const buildUserLabel = (user, fallback = "Usuario") => {
  if (!user) return { id: null, name: fallback };
  const id = parseNumericId(user.id || user.userId || user.usuarioId);
  const firstName = user.name || user.nombre || user.firstName || "";
  const lastName = user.lastname || user.apellido || user.lastName || "";
  const username = user.username || user.email || fallback;
  const name = `${firstName} ${lastName}`.trim() || username;
  return { id, name };
};

const buildProductInfo = (source) => {
  const product =
    source?.product ||
    source?.Product ||
    source?.producto ||
    source?.Producto ||
    {};
  const id = parseNumericId(
    source?.productId || product.id || product.productId
  );
  const title =
    product.title ||
    product.name ||
    source?.productTitle ||
    `Producto #${id ?? "sin-id"}`;
  const photo =
    product.photos?.[0]?.url || product.mainPhoto || product.imageUrl || null;
  const status =
    product.status ||
    product.moderationStatus ||
    source?.productStatus ||
    "desconocido";
  return { id, title, photo, status };
};

const normalizeAppeal = (appeal) => {
  const incidenceId = parseNumericId(
    appeal.incidenceId ||
      appeal.incidenciaId ||
      appeal.incidence?.id ||
      appeal.incidencia?.id
  );
  return {
    id: appeal.id,
    incidenceId,
    estado: appeal.estado || appeal.status || "pendiente",
    motivo: appeal.motivo || appeal.reason || appeal.descripcion || "",
    createdAt:
      appeal.createdAt ||
      appeal.fecha_apelacion ||
      appeal.fechaCreacion ||
      new Date().toISOString(),
    raw: appeal,
  };
};

const normalizeReport = (report) => {
  const product = buildProductInfo(report);
  const reporter = buildUserLabel(
    report.user || report.reporter || report.usuario || report.User
  );
  return {
    id: report.id,
    productId: product.id,
    productTitle: product.title,
    productPhoto: product.photo,
    description: report.description || report.detalle || report.reason || "",
    type: report.typeReport || report.type || "reporte_usuario",
    status: report.status || report.estado || "pendiente",
    reporterName: reporter.name,
    reporterId:
      reporter.id || parseNumericId(report.userId || report.reporterId),
    createdAt:
      report.dateReport ||
      report.createdAt ||
      report.fechaReporte ||
      new Date().toISOString(),
    raw: report,
  };
};

const normalizeIncidence = (incidence, appeals = []) => {
  const product = buildProductInfo(incidence);
  const reporter = buildUserLabel(
    incidence.report ||
      incidence.reporter ||
      incidence.usuario ||
      incidence.User,
    "Usuario"
  );
  const moderator = buildUserLabel(
    incidence.moderador ||
      incidence.moderator ||
      incidence.asignadoA ||
      incidence.assignedTo,
    "Sin asignar"
  );
  const moderadorId =
    moderator.id ??
    parseNumericId(
      incidence.moderadorId || incidence.moderador_id || incidence.moderatorId
    );

  const incidenceAppeals = appeals.filter(
    (appeal) => appeal.incidenceId === parseNumericId(incidence.id)
  );

  return {
    id: incidence.id,
    codigo: incidence.codigo || incidence.code || `INC-${incidence.id}`,
    estado: incidence.estado || incidence.status || "pendiente",
    tipo: incidence.tipo || incidence.type || "reporte_usuario",
    prioridad: incidence.prioridad || incidence.priority || "media",
    productId: product.id,
    productTitle: product.title,
    productPhoto: product.photo,
    productStatus: product.status,
    reporterId: reporter.id,
    reporterName: reporter.name,
    moderadorId,
    moderadorNombre: moderador.name === "Sin asignar" ? "" : moderator.name,
    createdAt:
      incidence.createdAt ||
      incidence.fecha_incidencia ||
      incidence.fechaCreacion ||
      new Date().toISOString(),
    updatedAt:
      incidence.updatedAt ||
      incidence.fecha_actualizacion ||
      incidence.updatedAt,
    notas: incidence.notas || incidence.comentarios || incidence.detalle || "",
    appeals: incidenceAppeals,
    hasPendingAppeal: incidenceAppeals.some(
      (appeal) => appeal.estado === "pendiente"
    ),
    raw: incidence,
  };
};

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
    <div className="p-4 bg-gray-100 rounded-full mb-4">
      <Icon className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
    <p className="text-sm text-gray-500 max-w-md">{description}</p>
  </div>
);

const TAB_OPTIONS = [
  { id: "reportes", label: "Reportes pendientes" },
  { id: "pendientes", label: "Incidencias pendientes" },
  { id: "en_revision", label: "En revisión" },
  { id: "apelaciones", label: "Apelaciones" },
  { id: "historial", label: "Historial" },
];

function GestionIncidenciasPage() {
  usePageTitle("Gestión de Incidencias");
  const navigate = useNavigate();

  const [initializing, setInitializing] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [reports, setReports] = useState([]);
  const [incidences, setIncidences] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [moderators, setModerators] = useState([]);
  const [selectedTab, setSelectedTab] = useState("pendientes");
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("todos");
  const [decisionNotes, setDecisionNotes] = useState({});
  const [assignmentTargets, setAssignmentTargets] = useState({});
  const [modalData, setModalData] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
  });
  const [fetchingData, setFetchingData] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const access = checkAdminAccess("gestionar_incidencias");

    if (!access.isAllowed) {
      navigate(access.redirectPath || "/");
      return;
    }

    const userData = authAPI.getUserData();
    const resolvedRole = normalizeRole(
      access.userRole || userData?.roles?.[0] || userData?.role || ROLES.USUARIO
    );

    setCurrentUser(userData || null);
    setUserRole(resolvedRole);
    setIsAuthorized(true);
    setInitializing(false);
  }, [navigate]);

  useEffect(() => {
    if (!isAuthorized) return;
    refreshData();
    if (userRole === ROLES.ADMIN) {
      loadModerators();
    }
  }, [isAuthorized, userRole]);

  const loadModerators = async () => {
    try {
      const { data } = await api.get("/users/");
      const parsed = (Array.isArray(data) ? data : [])
        .map((user) => {
          const backendRole =
            user?.Roles?.[0]?.roleName || user?.role || "Usuario";
          const normalized = normalizeRole(backendRole);
          if (normalized !== ROLES.MODERADOR && normalized !== ROLES.ADMIN)
            return null;
          const label =
            `${user.name || ""} ${user.lastname || ""}`.trim() ||
            user.email ||
            `Usuario ${user.id}`;
          return { id: user.id, name: label, role: normalized };
        })
        .filter(Boolean);
      setModerators(parsed);
    } catch {
      // Silently ignore, admin still can autoasignarse
    }
  };

  const refreshData = async () => {
    try {
      setFetchingData(true);
      const [reportsData, incidencesData, appealsData] = await Promise.all([
        reportAPI.getAll().catch(() => []),
        incidenceAPI.getAll().catch(() => []),
        appealAPI.getAll().catch(() => []),
      ]);

      const normalizedAppeals = (
        Array.isArray(appealsData) ? appealsData : []
      ).map(normalizeAppeal);
      const normalizedReports = (
        Array.isArray(reportsData) ? reportsData : []
      ).map(normalizeReport);
      const normalizedIncidences = (
        Array.isArray(incidencesData) ? incidencesData : []
      ).map((item) => normalizeIncidence(item, normalizedAppeals));

      setAppeals(normalizedAppeals);
      setReports(normalizedReports);
      setIncidences(normalizedIncidences);
    } catch (error) {
      console.error("Error al cargar incidencias:", error);
      setModalData({
        isOpen: true,
        type: "error",
        title: "Error al cargar datos",
        message:
          "No pudimos obtener el estado actualizado de reportes e incidencias. Intenta nuevamente en unos segundos.",
        confirmText: "Entendido",
      });
    } finally {
      setFetchingData(false);
    }
  };

  const closeModal = () => setModalData((prev) => ({ ...prev, isOpen: false }));

  const showFeedback = (type, title, message) => {
    setModalData({
      isOpen: true,
      type,
      title,
      message,
      confirmText: "Entendido",
    });
  };

  const stats = useMemo(() => {
    const pendingIncidences = incidences.filter(
      (inc) => inc.estado === "pendiente"
    );
    const inReviewIncidences = incidences.filter(
      (inc) => inc.estado === "en_revision"
    );
    const resolvedIncidences = incidences.filter(
      (inc) => inc.estado === "resuelto"
    );
    const suspendedIncidences = incidences.filter(
      (inc) => inc.estado === "suspendido"
    );
    const pendingAppeals = appeals.filter((ap) => ap.estado === "pendiente");

    return {
      reportCount: reports.length,
      pendingCount: pendingIncidences.length,
      inReviewCount: inReviewIncidences.length,
      resolvedCount: resolvedIncidences.length,
      suspendedCount: suspendedIncidences.length,
      appealCount: pendingAppeals.length,
    };
  }, [reports, incidences, appeals]);

  const incidencesForStats = useMemo(
    () =>
      incidences.map((inc) => ({
        moderador_id: inc.moderadorId,
        estado: inc.estado,
      })),
    [incidences]
  );

  const moderatorStats = useMemo(() => {
    if (!currentUser?.id) return null;
    return obtenerEstadisticasModerador(currentUser.id, incidencesForStats);
  }, [currentUser, incidencesForStats]);

  const capacityWarning = moderatorStats
    ? obtenerMensajeValidacion(moderatorStats)
    : null;

  const filteredIncidences = useMemo(() => {
    return incidences.filter((incidence) => {
      if (priorityFilter !== "todos" && incidence.prioridad !== priorityFilter)
        return false;

      if (searchTerm.trim() === "") return true;
      const term = searchTerm.trim().toLowerCase();
      return (
        incidence.codigo.toLowerCase().includes(term) ||
        incidence.productTitle.toLowerCase().includes(term) ||
        (incidence.reporterName || "").toLowerCase().includes(term) ||
        (incidence.moderadorNombre || "").toLowerCase().includes(term)
      );
    });
  }, [incidences, priorityFilter, searchTerm]);

  const filteredReports = useMemo(() => {
    if (searchTerm.trim() === "") return reports;
    const term = searchTerm.trim().toLowerCase();
    return reports.filter(
      (report) =>
        report.productTitle.toLowerCase().includes(term) ||
        (report.reporterName || "").toLowerCase().includes(term)
    );
  }, [reports, searchTerm]);

  const canAssignOthers = userRole === ROLES.ADMIN;
  const canResolve = userRole === ROLES.ADMIN || userRole === ROLES.MODERADOR;

  const ensureCapacityBeforeTaking = () => {
    if (!moderatorStats || !userRole) return true;
    if (!puedeTomarIncidencia(userRole, moderatorStats)) {
      const warning = obtenerMensajeValidacion(moderatorStats);
      showFeedback(
        "warning",
        "Capacidad alcanzada",
        warning || "Has alcanzado el límite de incidencias activas."
      );
      return false;
    }
    return true;
  };

  const confirmConvertReport = (report, takeImmediately = false) => {
    if (takeImmediately && !ensureCapacityBeforeTaking()) {
      return;
    }

    setModalData({
      isOpen: true,
      type: "confirm",
      title: takeImmediately
        ? "Convertir y tomar incidencia"
        : "Convertir en incidencia",
      message: takeImmediately
        ? "Crearemos una incidencia con este reporte y la tomaremos inmediatamente bajo tu responsabilidad."
        : "Crearemos una incidencia con este reporte para que pueda ser gestionada por el equipo.",
      confirmText: takeImmediately ? "Convertir y tomar" : "Convertir",
      cancelText: "Cancelar",
      onConfirm: () => executeConvertReport(report, takeImmediately),
    });
  };

  const executeConvertReport = async (report, takeImmediately) => {
    try {
      setActionLoading(true);
      const payload = {
        reportId: report.id,
        productId: report.productId,
        tipo: report.type,
        estado: takeImmediately ? "en_revision" : "pendiente",
        descripcion: report.description,
        reporterId: report.reporterId,
        dateReport: report.createdAt,
        prioridad: "media",
      };

      if (takeImmediately && currentUser?.id) {
        payload.moderadorId = currentUser.id;
        payload.moderador_id = currentUser.id;
      }

      await incidenceAPI.create(payload);
      await reportAPI.remove(report.id);
      await refreshData();
      showFeedback(
        "success",
        "Reporte convertido",
        "Se creó la incidencia correctamente."
      );
    } catch (error) {
      console.error("Error al convertir reporte:", error);
      showFeedback(
        "error",
        "No se pudo convertir",
        "Ocurrió un error al convertir el reporte en incidencia."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissReport = (report) => {
    setModalData({
      isOpen: true,
      type: "confirm",
      title: "Descartar reporte",
      message:
        "Esta acción cerrará el reporte sin crear una incidencia. ¿Deseas continuar?",
      confirmText: "Descartar",
      cancelText: "Cancelar",
      onConfirm: () => executeDismissReport(report),
    });
  };

  const executeDismissReport = async (report) => {
    try {
      setActionLoading(true);
      await reportAPI.remove(report.id);
      await refreshData();
      showFeedback(
        "success",
        "Reporte descartado",
        "El reporte fue eliminado y el usuario será notificado."
      );
    } catch (error) {
      console.error("Error al descartar reporte:", error);
      showFeedback(
        "error",
        "No se pudo descartar",
        "Reintenta en unos segundos."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleTakeIncidence = (incidence) => {
    if (!ensureCapacityBeforeTaking()) {
      return;
    }

    setModalData({
      isOpen: true,
      type: "confirm",
      title: "Tomar incidencia",
      message:
        'La incidencia quedará marcada como "En revisión" bajo tu responsabilidad. ¿Confirmas que deseas tomarla?',
      confirmText: "Tomar incidencia",
      cancelText: "Cancelar",
      onConfirm: () => executeTakeIncidence(incidence),
    });
  };

  const executeTakeIncidence = async (incidence) => {
    if (!currentUser?.id) {
      showFeedback(
        "error",
        "Sesión no disponible",
        "No encontramos tu información de usuario. Intenta volver a iniciar sesión."
      );
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        estado: "en_revision",
        moderadorId: currentUser.id,
        moderador_id: currentUser.id,
        fechaAsignacion: new Date().toISOString(),
      };
      await incidenceAPI.update(incidence.id, payload);
      await refreshData();
      showFeedback(
        "success",
        "Incidencia tomada",
        "Ahora eres responsable de esta incidencia."
      );
    } catch (error) {
      console.error("Error al tomar incidencia:", error);
      showFeedback(
        "error",
        "No se pudo tomar",
        "No logramos asignarte la incidencia. Intenta más tarde."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignmentChange = (incidenceId, moderatorId) => {
    setAssignmentTargets((prev) => ({ ...prev, [incidenceId]: moderatorId }));
  };

  const handleReassignIncidence = (incidence) => {
    if (incidence.hasPendingAppeal) {
      showFeedback(
        "warning",
        "No es posible reasignar",
        "La incidencia tiene una apelación pendiente. Debe resolverse antes de cambiar al moderador responsable."
      );
      return;
    }

    const targetId = assignmentTargets[incidence.id];
    if (!targetId) {
      showFeedback(
        "warning",
        "Selecciona un moderador",
        "Debes seleccionar a qué moderador deseas reasignar la incidencia."
      );
      return;
    }

    const targetModerator = moderators.find(
      (mod) => mod.id === parseNumericId(targetId)
    );
    if (!targetModerator) {
      showFeedback(
        "error",
        "Moderador no encontrado",
        "Actualiza la lista de moderadores antes de reasignar."
      );
      return;
    }

    setModalData({
      isOpen: true,
      type: "confirm",
      title: "Reasignar incidencia",
      message: `La incidencia pasará a ${targetModerator.name}. ¿Confirmas la reasignación?`,
      confirmText: "Reasignar",
      cancelText: "Cancelar",
      onConfirm: () => executeReassignIncidence(incidence, targetModerator),
    });
  };

  const executeReassignIncidence = async (incidence, targetModerator) => {
    try {
      setActionLoading(true);
      const payload = {
        moderadorId: targetModerator.id,
        moderador_id: targetModerator.id,
        estado: "en_revision",
        reassignedBy: currentUser?.id,
        fechaAsignacion: new Date().toISOString(),
      };
      await incidenceAPI.update(incidence.id, payload);
      await refreshData();
      showFeedback(
        "success",
        "Incidencia reasignada",
        `Ahora ${targetModerator.name} es responsable del caso.`
      );
      setAssignmentTargets((prev) => ({ ...prev, [incidence.id]: undefined }));
    } catch (error) {
      console.error("Error al reasignar incidencia:", error);
      showFeedback(
        "error",
        "No se pudo reasignar",
        "Reintenta en unos segundos."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveIncidence = (incidence, decision) => {
    if (!canResolve) return;

    if (incidence.hasPendingAppeal && userRole !== ROLES.ADMIN) {
      showFeedback(
        "warning",
        "Apelación pendiente",
        "Solo un administrador puede tomar una decisión final mientras exista una apelación abierta."
      );
      return;
    }

    const messages = {
      aprobar:
        "El producto podrá seguir publicado y la incidencia se cerrará como resuelta.",
      rechazar:
        "El producto será marcado con la observación correspondiente. ¿Confirmas el rechazo?",
      suspender:
        "El producto quedará suspendido y la incidencia se mantendrá visible en el historial.",
    };

    setModalData({
      isOpen: true,
      type: "confirm",
      title: "Confirmar decisión",
      message:
        messages[decision] ||
        "Esta acción actualizará el estado de la incidencia.",
      confirmText: "Confirmar",
      cancelText: "Cancelar",
      onConfirm: () => executeResolveIncidence(incidence, decision),
    });
  };

  const executeResolveIncidence = async (incidence, decision) => {
    try {
      setActionLoading(true);
      const payload = {
        estado: decision === "suspender" ? "suspendido" : "resuelto",
        decision,
        notas: decisionNotes[incidence.id] || "",
        fechaResolucion: new Date().toISOString(),
        resolvedBy: currentUser?.id,
      };

      await incidenceAPI.update(incidence.id, payload);
      await refreshData();
      setDecisionNotes((prev) => ({ ...prev, [incidence.id]: "" }));
      showFeedback(
        "success",
        "Incidencia actualizada",
        "Se registró tu decisión y se notificó al vendedor."
      );
    } catch (error) {
      console.error("Error al resolver incidencia:", error);
      showFeedback("error", "No se pudo actualizar", "Intenta nuevamente.");
    } finally {
      setActionLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const renderReportList = () => {
    if (!filteredReports.length) {
      return (
        <EmptyState
          icon={FiInbox}
          title="Sin reportes pendientes"
          description="Cuando un comprador reporte un producto, aparecerá aquí para que puedas convertirlo en incidencia."
        />
      );
    }

    return (
      <div className="space-y-4">
        {filteredReports.map((report) => (
          <div
            key={report.id}
            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">
                  Reporte #{report.id}
                </p>
                <h3 className="text-xl font-bold text-gray-900">
                  {report.productTitle}
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  {report.description || "Sin descripción del reporte."}
                </p>
                <div className="flex flex-wrap gap-3 mt-4 text-sm text-gray-600">
                  <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-700 font-medium inline-flex items-center gap-2">
                    <FiTag /> {report.type}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-gray-100">
                    Reportado por: {report.reporterName}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-gray-100">
                    {formatDate(report.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <button
                  disabled={actionLoading}
                  onClick={() => confirmConvertReport(report, true)}
                  className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Convertir y tomar
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => confirmConvertReport(report, false)}
                  className="flex-1 px-4 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Convertir
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => handleDismissReport(report)}
                  className="flex-1 px-4 py-3 bg-white border border-gray-300 hover:border-red-400 text-gray-700 font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderIncidenceList = (list, isHistory = false) => {
    if (!list.length) {
      return (
        <EmptyState
          icon={FiAlertTriangle}
          title={
            isHistory
              ? "Sin incidencias cerradas"
              : "No hay incidencias en esta vista"
          }
          description={
            isHistory
              ? "Cuando cierres incidencias aparecerán aquí para consulta."
              : "Cuando existan incidencias en este estado se mostrarán en esta pestaña."
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        {list.map((incidence) => (
          <div
            key={incidence.id}
            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">
                  {incidence.codigo}
                </p>
                <h3 className="text-xl font-bold text-gray-900">
                  {incidence.productTitle}
                </h3>
                <div className="flex flex-wrap gap-3 mt-3">
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-2">
                    <FiClock className="text-blue-500" />{" "}
                    {formatDate(incidence.createdAt)}
                  </span>
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 inline-flex items-center gap-2">
                    <FiTag /> {incidence.tipo}
                  </span>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      incidence.prioridad === "alta"
                        ? "bg-red-50 text-red-700"
                        : incidence.prioridad === "baja"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    Prioridad {incidence.prioridad}
                  </span>
                  {incidence.hasPendingAppeal && (
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700">
                      Apelación pendiente
                    </span>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  Reportado por:{" "}
                  <span className="font-semibold text-gray-900">
                    {incidence.reporterName || "No disponible"}
                  </span>
                </p>
                <p>
                  Moderador asignado:{" "}
                  <span className="font-semibold text-gray-900">
                    {incidence.moderadorNombre || "Sin asignar"}
                  </span>
                </p>
                {incidence.updatedAt && (
                  <p>Última actualización: {formatDate(incidence.updatedAt)}</p>
                )}
              </div>
            </div>

            {!isHistory && incidence.estado === "pendiente" && (
              <div className="mt-6 bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-4">
                <p className="text-sm font-semibold text-gray-800 mb-3">
                  Acciones disponibles
                </p>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleTakeIncidence(incidence)}
                    className="px-4 py-3 rounded-xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Tomar incidencia
                  </button>

                  {canAssignOthers && (
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                      <select
                        className="flex-1 border border-gray-300 rounded-xl px-3 py-2"
                        value={assignmentTargets[incidence.id] || ""}
                        onChange={(e) =>
                          handleAssignmentChange(incidence.id, e.target.value)
                        }
                      >
                        <option value="">Seleccionar moderador</option>
                        {moderators.map((moderator) => (
                          <option key={moderator.id} value={moderator.id}>
                            {moderator.name}{" "}
                            {moderator.role === ROLES.ADMIN ? "(Admin)" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleReassignIncidence(incidence)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Asignar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isHistory && incidence.estado === "en_revision" && (
              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Observaciones / decisión
                </label>
                <textarea
                  value={decisionNotes[incidence.id] || ""}
                  onChange={(e) =>
                    setDecisionNotes((prev) => ({
                      ...prev,
                      [incidence.id]: e.target.value,
                    }))
                  }
                  rows="3"
                  placeholder="Describe la resolución tomada para informar al vendedor y registrar evidencia."
                  className="w-full border border-gray-300 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button
                    disabled={actionLoading || !canResolve}
                    onClick={() => handleResolveIncidence(incidence, "aprobar")}
                    className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <MdVerified /> Aprobar
                  </button>
                  <button
                    disabled={actionLoading || !canResolve}
                    onClick={() =>
                      handleResolveIncidence(incidence, "rechazar")
                    }
                    className="flex-1 px-4 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <MdBlock /> Rechazar
                  </button>
                  <button
                    disabled={actionLoading || !canResolve}
                    onClick={() =>
                      handleResolveIncidence(incidence, "suspender")
                    }
                    className="flex-1 px-4 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <FiAlertTriangle /> Suspender
                  </button>
                  {canAssignOthers && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleReassignIncidence(incidence)}
                      className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reasignar
                    </button>
                  )}
                </div>
                {incidence.hasPendingAppeal && (
                  <p className="mt-3 text-sm text-purple-700">
                    Esta incidencia tiene una apelación pendiente. Documenta
                    cada decisión para que quede registro.
                  </p>
                )}
              </div>
            )}

            {isHistory && (
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-600">
                <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full font-semibold">
                  Estado final: {incidence.estado}
                </span>
                {incidence.notas && (
                  <span className="px-3 py-1 bg-gray-50 rounded-full">
                    Notas: {incidence.notas}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderAppeals = () => {
    if (!appeals.length) {
      return (
        <EmptyState
          icon={FiUsers}
          title="Sin apelaciones activas"
          description="Cuando un vendedor apele una decisión se mostrará aquí para que puedas darle seguimiento."
        />
      );
    }

    return (
      <div className="space-y-4">
        {appeals.map((appeal) => (
          <div
            key={appeal.id}
            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">
                  Apelación #{appeal.id}
                </p>
                <h3 className="text-lg font-bold text-gray-900">
                  Incidencia vinculada: {appeal.incidenceId}
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  {appeal.motivo || "Sin motivo registrado."}
                </p>
              </div>
              <div className="text-sm text-gray-600">
                <p>
                  Estado:{" "}
                  <span className="font-semibold text-purple-700 capitalize">
                    {appeal.estado}
                  </span>
                </p>
                <p>Recibido: {formatDate(appeal.createdAt)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Dirígete a la incidencia vinculada para tomar una decisión. Las
              apelaciones no se resuelven de forma independiente.
            </p>
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (fetchingData) {
      return (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Actualizando datos...</p>
        </div>
      );
    }

    switch (selectedTab) {
      case "reportes":
        return renderReportList();
      case "pendientes":
        return renderIncidenceList(
          filteredIncidences.filter((inc) => inc.estado === "pendiente")
        );
      case "en_revision":
        return renderIncidenceList(
          filteredIncidences.filter((inc) => inc.estado === "en_revision")
        );
      case "apelaciones":
        return renderAppeals();
      case "historial":
        return renderIncidenceList(
          filteredIncidences.filter(
            (inc) => inc.estado === "resuelto" || inc.estado === "suspendido"
          ),
          true
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="sb-container max-w-7xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
              <FiAlertTriangle className="text-orange-500" /> Gestión de
              Incidencias
            </h1>
            <p className="text-gray-600 mt-1">
              Controla reportes, incidencias y apelaciones en un solo lugar.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={refreshData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-100"
            >
              <FiRefreshCw className="text-orange-500" /> Actualizar
            </button>
            <div className="px-4 py-2 bg-orange-50 text-orange-700 rounded-xl font-semibold flex items-center gap-2">
              <FiUserCheck /> {userRole || "Sin rol"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase font-semibold">
              Reportes
            </p>
            <p className="text-3xl font-black text-gray-900">
              {stats.reportCount}
            </p>
            <p className="text-xs text-gray-500">Pendientes de convertir</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase font-semibold">
              Pendientes
            </p>
            <p className="text-3xl font-black text-gray-900">
              {stats.pendingCount}
            </p>
            <p className="text-xs text-gray-500">Listas para tomar</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase font-semibold">
              En revisión
            </p>
            <p className="text-3xl font-black text-gray-900">
              {stats.inReviewCount}
            </p>
            <p className="text-xs text-gray-500">Asignadas actualmente</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase font-semibold">
              Apelaciones
            </p>
            <p className="text-3xl font-black text-gray-900">
              {stats.appealCount}
            </p>
            <p className="text-xs text-gray-500">Solicitan seguimiento</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase font-semibold">
              Cerradas
            </p>
            <p className="text-3xl font-black text-gray-900">
              {stats.resolvedCount + stats.suspendedCount}
            </p>
            <p className="text-xs text-gray-500">Historial reciente</p>
          </div>
        </div>

        {moderatorStats && (
          <div className="mb-6 p-4 rounded-2xl border border-dashed border-gray-300 bg-white flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
              <span className="font-semibold">Tus incidencias activas:</span>
              <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-700 font-bold">
                {moderatorStats.incidenciasActivas} /{" "}
                {LIMITES_INCIDENCIAS.MAX_INCIDENCIAS_ACTIVAS_POR_MODERADOR}
              </span>
              <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 font-semibold">
                Capacidad disponible:{" "}
                {Math.max(moderatorStats.capacidadDisponible, 0)}
              </span>
            </div>
            {capacityWarning && (
              <p className="text-sm text-amber-600 flex items-center gap-2">
                <FiAlertTriangle /> {capacityWarning}
              </p>
            )}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                    selectedTab === tab.id
                      ? "bg-orange-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por producto, código o moderador"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl"
                />
              </div>
              <div className="relative">
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="appearance-none border border-gray-300 rounded-xl px-4 py-2 pr-10"
                >
                  <option value="todos">Todas las prioridades</option>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {renderContent()}
      </div>

      <Modal
        isOpen={modalData.isOpen}
        type={modalData.type}
        title={modalData.title}
        message={modalData.message}
        onConfirm={modalData.onConfirm}
        confirmText={modalData.confirmText || "Confirmar"}
        cancelText={modalData.cancelText}
        onCancel={modalData.onCancel || closeModal}
        onClose={closeModal}
      />
    </div>
  );
}

export default GestionIncidenciasPage;
