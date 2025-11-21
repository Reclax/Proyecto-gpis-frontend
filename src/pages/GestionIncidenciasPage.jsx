import { useEffect, useMemo, useState, useCallback } from "react";
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
  FiEye,
  FiLayers
} from "react-icons/fi";
import { MdBlock, MdVerified } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import Modal from "../components/common/Modal";
import {
  LIMITES_INCIDENCIAS,
  normalizeRole,
  obtenerEstadisticasModerador,
  obtenerMensajeValidacion,
  ROLES,
} from "../config/roles";
import usePageTitle from "../hooks/usePageTitle";
import api, {
  appealAPI,
  authAPI,
  incidenceAPI,
  reportAPI,
  productAPI,
} from "../services/api";
import { checkAdminAccess } from "../utils/rolePermissions";

const STATUS_LABELS = {
  active: "Activo",
  inactive: "Inactivo",
  paused: "Pausado",
  sold: "Vendido",
  blocked: "Bloqueado",
  deleted: "Eliminado",
};

const MODERATION_LABELS = {
  active: "Aprobado",
  review: "En revisión",
  flagged: "Marcado",
  block: "Bloqueado",
  suspended: "Suspendido",
  rejected: "Rechazado",
};

const MODERATION_STATUS_OPTIONS = [
  { value: "active", label: "Aprobado" },
  { value: "review", label: "En revisión" },
  { value: "flagged", label: "Marcado" },
  { value: "block", label: "Bloqueado" },
  { value: "suspended", label: "Suspendido" },
];

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

// Usa productMap para asegurar datos consistentes
const buildProductInfo = (source, productMap = {}) => {
  const rawId = source?.productId ||
    source?.product?.id ||
    source?.product?.productId ||
    source?.Product?.id ||
    source?.Product?.productId;
  const id = parseNumericId(rawId);
  const productFromMap = id ? productMap[id] : null;

  const title =
    productFromMap?.title ||
    source?.product?.title ||
    source?.product?.name ||
    source?.Product?.title ||
    source?.Product?.name ||
    `Producto #${id ?? "sin-id"}`;

  const photo =
    productFromMap?.ProductPhotos?.[0]?.url ||
    productFromMap?.photos?.[0]?.url ||
    productFromMap?.mainPhoto ||
    productFromMap?.imageUrl ||
    source?.product?.photos?.[0]?.url ||
    source?.product?.mainPhoto ||
    source?.product?.imageUrl ||
    source?.Product?.photos?.[0]?.url ||
    source?.Product?.mainPhoto ||
    source?.Product?.imageUrl ||
    null;

  const statusGeneral =
    productFromMap?.status ||
    source?.product?.status ||
    source?.Product?.status ||
    source?.productStatus ||
    "desconocido";

  const moderationStatus =
    productFromMap?.moderationStatus ||
    source?.product?.moderationStatus ||
    source?.Product?.moderationStatus ||
    source?.moderationStatus ||
    source?.productModerationStatus ||
    "desconocido";

  return {
    id,
    title,
    photo,
    statusGeneral,
    moderationStatus,
  };
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

const normalizeReport = (report, productMap) => {
  const product = buildProductInfo(report, productMap);
  const reporter = buildUserLabel(
    report.user || report.reporter || report.usuario || report.User
  );
  return {
    id: report.id,
    productId: product.id,
    productTitle: product.title,
    productPhoto: product.photo,
    productStatusGeneral: product.statusGeneral,
    productModerationStatus: product.moderationStatus,
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

const resolveModeratorId = (incidence) => {
  return (
    parseNumericId(
      incidence.moderatorId ||
        incidence.moderadorId ||
        incidence.assignedModeratorId ||
        incidence.assignedTo
    ) ||
    parseNumericId(incidence.userId) ||
    null
  );
};

const normalizeIncidence = (
  incidence,
  appealsList,
  reportsList,
  userMap,
  productMap
) => {
  const product = buildProductInfo(incidence, productMap);
  const incidenceId = parseNumericId(incidence.id || incidence.incidenceId);

  const statusRaw = ((incidence.status || incidence.estado || "pendiente") + "")
    .toLowerCase()
    .trim();
  const estadoMap = {
    pending: "pendiente",
    pendiente: "pendiente",
    open: "pendiente",
    en_revision: "en_revision",
    review: "en_revision",
    revisando: "en_revision",
    in_review: "en_revision",
    assigned: "en_revision",
    resolved: "resuelto",
    resuelto: "resuelto",
    closed: "resuelto",
    finalizado: "resuelto",
    suspended: "suspendido",
    suspendido: "suspendido",
  };
  const estado = estadoMap[statusRaw] || statusRaw || "pendiente";

  const codigo =
    incidence.codigo ||
    incidence.code ||
    incidence.reference ||
    (incidenceId ? `INC-${incidenceId}` : "INCIDENCIA");

  const incidenceAppeals = (appealsList || []).filter(
    (appeal) => appeal.incidenceId === incidenceId
  );

  const associatedReports = (reportsList || []).filter(
    (r) => r.productId === product.id
  );

  const moderatorId = resolveModeratorId(incidence);
  const moderatorUser = moderatorId ? userMap[moderatorId] : null;
  const moderadorNombre = moderatorUser
    ? `${moderatorUser.name || ""} ${moderatorUser.lastname || ""}`.trim() ||
      moderatorUser.email ||
      `Usuario ${moderatorUser.id}`
    : "";

  return {
    id: incidenceId,
    codigo,
    estado,
    tipo: incidence.tipo || incidence.type || "reporte_usuario",
    prioridad: incidence.prioridad || incidence.priority || "media",
    productId: product.id,
    productTitle: product.title,
    productPhoto: product.photo,
    productStatusGeneral: product.statusGeneral,
    productModerationStatus: product.moderationStatus,
    moderadorId: moderatorId || null,
    moderadorNombre: moderadorNombre || "",
    createdAt:
      incidence.dateIncidence ||
      incidence.createdAt ||
      incidence.fecha_incidencia ||
      incidence.fechaCreacion ||
      new Date().toISOString(),
    updatedAt:
      incidence.updatedAt ||
      incidence.fecha_actualizacion ||
      incidence.fechaActualizacion ||
      null,
    notas:
      incidence.notas ||
      incidence.comentarios ||
      incidence.detalle ||
      incidence.description ||
      "",
    appeals: incidenceAppeals,
    hasPendingAppeal: incidenceAppeals.some(
      (appeal) => appeal.estado === "pendiente"
    ),
    reportsHistory: associatedReports,
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

  const [users, setUsers] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [productsMap, setProductsMap] = useState({});

  const [reports, setReports] = useState([]);
  const [incidences, setIncidences] = useState([]);
  const [appeals, setAppeals] = useState([]);

  const [selectedTab, setSelectedTab] = useState("pendientes");
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("todos");
  const [decisionNotes, setDecisionNotes] = useState({});
  const [moderationSelections, setModerationSelections] = useState({});
  const [modalData, setModalData] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
  });
  const [fetchingData, setFetchingData] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedIncidenceReports, setExpandedIncidenceReports] = useState({});
  const [reportGroupAssignments, setReportGroupAssignments] = useState({});

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

  const loadAllUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/users");
      const arr = Array.isArray(data) ? data : [];
      setUsers(arr);
      const map = {};
      arr.forEach((u) => {
        const id = parseNumericId(u.id);
        if (id != null) map[id] = u;
      });
      setUserMap(map);
    } catch (e) {
      console.error("Error cargando usuarios:", e);
    }
  }, []);

  // Carga productos necesarios dado reportes e incidencias
  const loadProductsMap = useCallback(async (reportArr, incidenceArr) => {
    const ids = new Set();
    reportArr.forEach((r) => r.productId && ids.add(r.productId));
    incidenceArr.forEach((i) => i.productId && ids.add(i.productId));
    const fetched = {};
    await Promise.all(
      Array.from(ids).map(async (pid) => {
        try {
          const product = await productAPI.getById(pid);
          fetched[pid] = product;
        } catch {
          fetched[pid] = null;
        }
      })
    );
    setProductsMap(fetched);
    return fetched;
  }, []);

  const refreshData = useCallback(async () => {
    try {
      setFetchingData(true);
      const [reportsData, incidencesData, appealsData] = await Promise.all([
        reportAPI.getAll().catch(() => []),
        incidenceAPI.getAll().catch(() => []),
        appealAPI.getAll().catch(() => []),
      ]);

      const normalizedAppeals = (Array.isArray(appealsData) ? appealsData : []).map(normalizeAppeal);

      // Primero normalizar reportes sin producto (temporal), luego cargar productos y volver a normalizar
      const provisionalReports = (Array.isArray(reportsData) ? reportsData : []).map((r) =>
        normalizeReport(r, {})
      );
      const provisionalIncidences = (Array.isArray(incidencesData) ? incidencesData : []).map(
        (i) => normalizeIncidence(i, normalizedAppeals, provisionalReports, userMap, {})
      );

      const productMapActual = await loadProductsMap(provisionalReports, provisionalIncidences);

      const finalReports = (Array.isArray(reportsData) ? reportsData : []).map((r) =>
        normalizeReport(r, productMapActual)
      );
      const finalIncidences = (Array.isArray(incidencesData) ? incidencesData : []).map((i) =>
        normalizeIncidence(i, normalizedAppeals, finalReports, userMap, productMapActual)
      );

      setAppeals(normalizedAppeals);
      setReports(finalReports);
      setIncidences(finalIncidences);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setModalData({
        isOpen: true,
        type: "error",
        title: "Error al cargar datos",
        message:
          "No pudimos obtener el estado actualizado. Intenta nuevamente en unos segundos.",
        confirmText: "Entendido",
      });
    } finally {
      setFetchingData(false);
    }
  }, [userMap, loadProductsMap]);

  useEffect(() => {
    if (!isAuthorized) return;
    (async () => {
      await loadAllUsers();
    })();
  }, [isAuthorized, loadAllUsers]);

  useEffect(() => {
    if (isAuthorized && Object.keys(userMap).length > 0) {
      refreshData();
    }
  }, [isAuthorized, userMap, refreshData]);

  const closeModal = () => setModalData((prev) => ({ ...prev, isOpen: false }));

  const showFeedback = useCallback((type, title, message) => {
    setModalData({
      isOpen: true,
      type,
      title,
      message,
      confirmText: "Entendido",
    });
  }, []);

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
      if (selectedTab === "pendientes" && incidence.estado !== "pendiente") return false;
      if (selectedTab === "en_revision" && incidence.estado !== "en_revision") return false;
      if (selectedTab === "historial" && !["resuelto", "suspendido"].includes(incidence.estado)) return false;
      if (priorityFilter !== "todos" && incidence.prioridad !== priorityFilter) return false;
      if (searchTerm.trim() === "") return true;
      const term = searchTerm.trim().toLowerCase();
      return (
        incidence.codigo.toLowerCase().includes(term) ||
        incidence.productTitle.toLowerCase().includes(term) ||
        (incidence.moderadorNombre || "").toLowerCase().includes(term)
      );
    });
  }, [incidences, priorityFilter, searchTerm, selectedTab]);

  const reportGroups = useMemo(() => {
    const productIdsWithIncidence = new Set(
      incidences.map((inc) => inc.productId)
    );
    const groups = new Map();
    reports.forEach((r) => {
      if (!r.productId) return;
      if (productIdsWithIncidence.has(r.productId)) return;
      if (!groups.has(r.productId)) {
        groups.set(r.productId, {
          productId: r.productId,
          productTitle: r.productTitle,
          productPhoto: r.productPhoto,
          productModerationStatus: r.productModerationStatus,
          productStatusGeneral: r.productStatusGeneral,
          reports: [],
        });
      }
      groups.get(r.productId).reports.push(r);
    });
    return Array.from(groups.values());
  }, [reports, incidences]);

  const filteredReportGroups = useMemo(() => {
    if (searchTerm.trim() === "") return reportGroups;
    const term = searchTerm.trim().toLowerCase();
    return reportGroups.filter(
      (g) =>
        g.productTitle.toLowerCase().includes(term) ||
        g.reports.some((r) =>
          (r.reporterName || "").toLowerCase().includes(term)
        )
    );
  }, [reportGroups, searchTerm]);

  const canResolve =
    userRole === ROLES.ADMIN || userRole === ROLES.MODERADOR;

  const ensureCapacityBeforeTaking = () => {
    if (!currentUser?.id) return true;
    const activas = incidences.filter(
      (inc) =>
        inc.moderadorId === currentUser.id &&
        (inc.estado === "pendiente" || inc.estado === "en_revision")
    ).length;
    if (activas >= LIMITES_INCIDENCIAS.MAX_INCIDENCIAS_ACTIVAS_POR_MODERADOR) {
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

  const handleModerationSelectionChange = (incidenceId, value) => {
    setModerationSelections((prev) => ({
      ...prev,
      [incidenceId]: value,
    }));
  };

  const handleModerationStatusUpdate = async (incidence) => {
    if (userRole !== ROLES.ADMIN) {
      showFeedback(
        "warning",
        "Permiso requerido",
        "Solo un administrador puede modificar el estado de moderación."
      );
      return;
    }
    if (!incidence.productId) {
      showFeedback(
        "error",
        "Producto no disponible",
        "No encontramos el producto asociado."
      );
      return;
    }
    const desiredStatus =
      moderationSelections[incidence.id] ??
      incidence.productModerationStatus ??
      "";
    if (!desiredStatus) {
      showFeedback("warning", "Selecciona un estado", "Debes elegir un estado.");
      return;
    }
    try {
      setActionLoading(true);
      await productAPI.updateModerationStatus(
        incidence.productId,
        desiredStatus
      );
      await refreshData();
      showFeedback(
        "success",
        "Estado actualizado",
        `El producto ahora está en estado de moderación "${MODERATION_LABELS[desiredStatus] || desiredStatus}".`
      );
    } catch (error) {
      console.error("Error al actualizar moderationStatus:", error);
      showFeedback(
        "error",
        "No se pudo actualizar",
        "Intenta nuevamente o verifica tu conexión."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertReportGroup = (
    group,
    assignToSelf = true,
    moderatorId = null
  ) => {
    if (assignToSelf && !ensureCapacityBeforeTaking()) return;
    if (!assignToSelf && !moderatorId) {
      showFeedback(
        "warning",
        "Selecciona moderador",
        "Elige un moderador antes de asignar."
      );
      return;
    }

    setModalData({
      isOpen: true,
      type: "confirm",
      title: "Crear incidencia",
      message: `Se creará una incidencia para el producto "${group.productTitle}" con ${group.reports.length} reporte(s) agrupado(s). ¿Deseas continuar?`,
      confirmText: assignToSelf ? "Crear y tomar" : "Crear",
      cancelText: "Cancelar",
      onConfirm: () =>
        executeConvertReportGroup(group, assignToSelf, moderatorId),
    });
  };

  const executeConvertReportGroup = async (
    group,
    assignToSelf,
    moderatorId
  ) => {
    try {
      setActionLoading(true);
      const targetModeratorId =
        assignToSelf && currentUser?.id
          ? currentUser.id
          : parseNumericId(moderatorId);

      if (!targetModeratorId) {
        showFeedback(
          "warning",
          "Moderador requerido",
          "Debes asignar un moderador para crear la incidencia."
        );
        setActionLoading(false);
        return;
      }

      const aggregatedDescription = group.reports
        .map(
          (r) =>
            `• (${r.type}) ${r.description || "Sin descripción"} - ${
              r.reporterName
            }`
        )
        .join("\n");

      const incidencePayload = {
        dateIncidence: new Date().toISOString(),
        description: aggregatedDescription,
        status: "pending",
        userId: targetModeratorId,
        productId: group.productId,
      };

      await incidenceAPI.create(incidencePayload);

      try {
        await productAPI.updateModerationStatus(group.productId, "review");
      } catch (e) {
        console.warn("No se pudo marcar el producto en revisión:", e);
      }

      for (const r of group.reports) {
        try {
          await reportAPI.remove(r.id);
        } catch (e) {
          console.warn("No se pudo eliminar reporte", r.id, e);
        }
      }

      await refreshData();
      showFeedback(
        "success",
        "Incidencia creada",
        assignToSelf
          ? "La incidencia fue creada y asignada a ti exitosamente."
          : "La incidencia fue creada y asignada."
      );
    } catch (error) {
      console.error("Error al convertir grupo de reportes:", error);
      showFeedback(
        "error",
        "Error al crear incidencia",
        "Revisa tu conexión e intenta nuevamente."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissReportGroup = (group) => {
    setModalData({
      isOpen: true,
      type: "confirm",
      title: "Descartar reportes",
      message:
        "Se descartarán todos los reportes de este producto sin crear una incidencia. ¿Deseas continuar?",
      confirmText: "Descartar",
      cancelText: "Cancelar",
      onConfirm: () => executeDismissReportGroup(group),
    });
  };

  const executeDismissReportGroup = async (group) => {
    try {
      setActionLoading(true);
      for (const r of group.reports) {
        try {
          await reportAPI.remove(r.id);
        } catch (e) {
          console.warn("No se pudo descartar reporte", r.id, e);
        }
      }
      await refreshData();
      showFeedback(
        "success",
        "Reportes descartados",
        "Se eliminaron todos los reportes del producto."
      );
    } catch (error) {
      console.error("Error al descartar reportes:", error);
      showFeedback(
        "error",
        "No se pudo descartar",
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
        "Solo un administrador puede decidir mientras exista una apelación abierta."
      );
      return;
    }

    const messages = {
      aprobar:
        "El producto se mantendrá aprobado y la incidencia se cerrará como resuelta.",
      rechazar: "El producto será marcado (flagged). ¿Confirmas el rechazo?",
      suspender:
        "El producto será suspendido. La incidencia quedará en historial.",
    };

    setModalData({
      isOpen: true,
      type: "confirm",
      title: "Confirmar decisión",
      message: messages[decision] || "Esta acción actualizará la incidencia.",
      confirmText: "Confirmar",
      cancelText: "Cancelar",
      onConfirm: () => executeResolveIncidence(incidence, decision),
    });
  };

  const executeResolveIncidence = async (incidence, decision) => {
    try {
      setActionLoading(true);
      let status = "resolved";
      if (decision === "suspender") status = "suspended";
      const payload = {
        status,
        decision,
        notas: decisionNotes[incidence.id] || "",
        fechaResolucion: new Date().toISOString(),
        resolvedBy: currentUser?.id,
      };
      await incidenceAPI.update(incidence.id, payload);

      if (incidence.productId) {
        let moderationStatus = "active";
        if (decision === "rechazar") moderationStatus = "flagged";
        if (decision === "suspender") moderationStatus = "suspended";
        try {
          await productAPI.updateModerationStatus(
            incidence.productId,
            moderationStatus
          );
        } catch (e) {
          console.warn("No se pudo actualizar moderationStatus del producto:", e);
        }
      }
      await refreshData();
      setDecisionNotes((prev) => ({ ...prev, [incidence.id]: "" }));
      showFeedback(
        "success",
        "Incidencia actualizada",
        "Se registró tu decisión correctamente."
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

  if (!isAuthorized) return null;

  const renderReportGroups = () => {
    if (!filteredReportGroups.length) {
      return (
        <EmptyState
          icon={FiInbox}
            title="Sin reportes pendientes"
          description="Los productos con reportes aparecerán aquí mientras no tengan una incidencia creada."
        />
      );
    }

    return (
      <div className="space-y-4">
        {filteredReportGroups.map((group) => {
          const selectedModerator = reportGroupAssignments[group.productId] || "";
          return (
            <div
              key={group.productId}
              className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">
                      Producto #{group.productId}
                    </p>
                    <h3 className="text-xl font-bold text-gray-900">
                      {group.productTitle}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-3 text-xs">
                      <span className="px-2 py-1 bg-gray-100 rounded-full font-medium">
                        Estado: {STATUS_LABELS[group.productStatusGeneral] || group.productStatusGeneral || "desconocido"}
                      </span>
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                        Moderación: {MODERATION_LABELS[group.productModerationStatus] || group.productModerationStatus || "desconocido"}
                      </span>
                      <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full font-semibold inline-flex items-center gap-1">
                        <FiAlertTriangle /> {group.reports.length} reporte(s)
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => navigate(`/producto/${group.productId}`)}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <FiEye /> Ver producto
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleConvertReportGroup(group, true)}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl disabled:opacity-50"
                    >
                      Crear incidencia y tomar
                    </button>
                  </div>
                </div>

                {userRole === ROLES.ADMIN && (
                  <div className="flex flex-col sm:flex-row gap-3 mt-2">
                    <div className="flex-1">
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        value={selectedModerator}
                        onChange={(e) =>
                          setReportGroupAssignments((prev) => ({
                            ...prev,
                            [group.productId]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Seleccionar moderador</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {`${u.name || ""} ${u.lastname || ""}`.trim() ||
                              u.email ||
                              `Usuario ${u.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      disabled={actionLoading || !selectedModerator}
                      onClick={() =>
                        handleConvertReportGroup(
                          group,
                          false,
                          selectedModerator
                        )
                      }
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl disabled:opacity-50 text-sm"
                    >
                      Crear y asignar
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleDismissReportGroup(group)}
                      className="px-4 py-2 bg-white border border-gray-300 hover:border-red-400 text-gray-700 font-semibold rounded-xl disabled:opacity-50 text-sm"
                    >
                      Descartar
                    </button>
                  </div>
                )}

                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FiLayers className="text-orange-500" /> Detalle de reportes
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600 max-h-56 overflow-auto">
                    {group.reports.map((r) => (
                      <li
                        key={r.id}
                        className="border-b border-dashed last:border-none pb-2"
                      >
                        <span className="font-semibold">{r.type}</span>:{" "}
                        {r.description || "Sin descripción"}{" "}
                        <span className="text-xs text-gray-500">
                          · {r.reporterName} · {formatDate(r.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
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
              ? "Cuando cierres incidencias aparecerán aquí."
              : "Cuando existan incidencias en este estado se mostrarán en esta pestaña."
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        {list.map((incidence) => {
          const expanded = !!expandedIncidenceReports[incidence.id];
          return (
            <div
              key={incidence.id}
              className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">
                    {incidence.codigo}
                  </p>
                  <h3 className="text-xl font-bold text-gray-900">
                    {incidence.productTitle}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-3 text-xs">
                    <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium inline-flex items-center gap-1">
                      <FiClock className="text-blue-500" />{" "}
                      {formatDate(incidence.createdAt)}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-gray-100 font-medium inline-flex items-center gap-1">
                      <FiTag /> {incidence.tipo}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full font-medium ${
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
                      <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700 font-medium">
                        Apelación pendiente
                      </span>
                    )}
                    <span className="px-2 py-1 rounded-full bg-gray-100 font-medium">
                      Estado:{" "}
                      {STATUS_LABELS[incidence.productStatusGeneral] ||
                        incidence.productStatusGeneral ||
                        "desconocido"}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                      Moderación:{" "}
                      {MODERATION_LABELS[incidence.productModerationStatus] ||
                        incidence.productModerationStatus ||
                        "desconocido"}
                    </span>
                    {incidence.reportsHistory.length > 0 && (
                      <button
                        onClick={() =>
                          setExpandedIncidenceReports((prev) => ({
                            ...prev,
                            [incidence.id]: !expanded,
                          }))
                        }
                        className="px-2 py-1 rounded-full bg-orange-50 text-orange-700 font-semibold inline-flex items-center gap-1 hover:bg-orange-100"
                      >
                        <FiLayers />
                        {expanded
                          ? "Ocultar reportes"
                          : `Reportes (${incidence.reportsHistory.length})`}
                        <FiChevronDown
                          className={`transition-transform ${
                            expanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-600 w-full max-w-xs space-y-2">
                  <p>
                    Moderador:{" "}
                    <span className="font-semibold text-gray-900">
                      {incidence.moderadorNombre || "Sin asignar"}
                    </span>
                  </p>
                  {incidence.updatedAt && (
                    <p>Actualizado: {formatDate(incidence.updatedAt)}</p>
                  )}
                  <button
                    onClick={() => navigate(`/producto/${incidence.productId}`)}
                    className="mt-2 px-3 py-2 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-100 flex items-center gap-2 text-sm"
                  >
                    <FiEye /> Ver producto
                  </button>
                </div>
              </div>

              {userRole === ROLES.ADMIN && !isHistory && (
                <div className="mt-5 border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      Estado de moderación:
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                        {MODERATION_LABELS[incidence.productModerationStatus] ||
                          incidence.productModerationStatus ||
                          "N/D"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={
                          moderationSelections[incidence.id] ??
                          incidence.productModerationStatus ??
                          ""
                        }
                        onChange={(e) =>
                          handleModerationSelectionChange(
                            incidence.id,
                            e.target.value
                          )
                        }
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Seleccionar</option>
                        {MODERATION_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleModerationStatusUpdate(incidence)}
                        className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-black disabled:opacity-50"
                      >
                        Actualizar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!isHistory &&
                incidence.estado === "en_revision" &&
                canResolve && (
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
                      placeholder="Describe la resolución para informar al vendedor."
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    />
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <button
                        disabled={actionLoading}
                        onClick={() =>
                          handleResolveIncidence(incidence, "aprobar")
                        }
                        className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                      >
                        <MdVerified /> Aprobar
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() =>
                          handleResolveIncidence(incidence, "rechazar")
                        }
                        className="flex-1 px-4 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                      >
                        <MdBlock /> Rechazar
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() =>
                          handleResolveIncidence(incidence, "suspender")
                        }
                        className="flex-1 px-4 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                      >
                        <FiAlertTriangle /> Suspender
                      </button>
                    </div>
                    {incidence.hasPendingAppeal && (
                      <p className="mt-3 text-sm text-purple-700">
                        Apelación pendiente: documenta cada decisión.
                      </p>
                    )}
                  </div>
                )}

              {expanded && incidence.reportsHistory.length > 0 && (
                <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Reportes asociados al producto
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600 max-h-56 overflow-auto">
                    {incidence.reportsHistory.map((r) => (
                      <li
                        key={r.id}
                        className="border-b border-dashed last:border-none pb-2"
                      >
                        <span className="font-semibold">{r.type}</span>:{" "}
                        {r.description || "Sin descripción"}{" "}
                        <span className="text-xs text-gray-500">
                          · {r.reporterName} · {formatDate(r.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
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
          );
        })}
      </div>
    );
  };

  const renderAppeals = () => {
    if (!appeals.length) {
      return (
        <EmptyState
          icon={FiUsers}
          title="Sin apelaciones activas"
          description="Cuando un vendedor apele una decisión se mostrará aquí."
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
        return renderReportGroups();
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
              Controla reportes agrupados, incidencias y apelaciones.
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
            <p className="text-xs text-gray-500">Agrupados (sin incidencia)</p>
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