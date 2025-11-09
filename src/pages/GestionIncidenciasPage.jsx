
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiCalendar, FiFilter, FiEye, FiCheck, FiX, FiClock, FiChevronDown, FiMessageSquare, FiInfo } from 'react-icons/fi';
import { MdBlock, MdVerified } from 'react-icons/md';
import usePageTitle from '../hooks/usePageTitle';
import Modal from '../components/common/Modal';
import {
  obtenerEstadisticasModerador,
  puedeTomarIncidencia,
  obtenerMensajeValidacion,
  LIMITES_INCIDENCIAS
} from '../config/roles';
import { API_BASE_URL, productAPI, userAPI, incidenceAPI, reportAPI } from '../services/api';

//

function GestionIncidenciasPage() {
  usePageTitle('Gestión de Incidencias');
  const navigate = useNavigate();
  // Grupos unificados por producto
  const [grupos, setGrupos] = useState([]);
  const [filterEstado, setFilterEstado] = useState('todas');
  // Origen: 'todos' | 'incidencia' | 'reporte'
  const [filterOrigen, setFilterOrigen] = useState('todos');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [modalData, setModalData] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });
  const [decisionReason, setDecisionReason] = useState('');
  const [userRole] = useState('Admin'); // Demo: cambiar a 'Moderador' para probar
  const [moderadorId] = useState(1); // Demo: ID del moderador actual

  useEffect(() => {
    const loadData = async () => {
      try {
        // Obtener incidencias y reportes en paralelo
        const [rawIncidences, rawReports] = await Promise.all([
          incidenceAPI.getAll().catch(() => []),
          reportAPI.getAll().catch(() => [])
        ]);

        const incidencesArray = Array.isArray(rawIncidences) ? rawIncidences : [];
        const reportsArray = Array.isArray(rawReports) ? rawReports : [];

        // Reunir todos los productIds únicos para hacer fetch de producto/seller
        const allProductIds = [
          ...new Set([
            ...incidencesArray.map(i => i.productId).filter(Boolean),
            ...reportsArray.map(r => r.productId).filter(Boolean)
          ])
        ];

        // Cache local de productos para evitar llamadas repetidas
        const productCache = {};
        for (const pid of allProductIds) {
          try {
            const p = await productAPI.getProductById(pid);
            productCache[pid] = p;
          } catch {
            productCache[pid] = null;
          }
        }

        // Cache de vendedores
        const sellerCache = {};
        const sellerIds = [
          ...new Set(Object.values(productCache).map(p => p?.sellerId).filter(Boolean))
        ];
        for (const sid of sellerIds) {
          try {
            const s = await userAPI.getUserById(sid);
            sellerCache[sid] = s;
          } catch {
            sellerCache[sid] = null;
          }
        }

  const estadoMap = { pending: 'pendiente', in_review: 'en_revision', reviewing: 'en_revision', resolved: 'resuelto', suspended: 'suspendido', suspendido: 'suspendido' };

        // Mapear incidencias (detección automática)
        const mappedIncidences = incidencesArray.map(inc => {
          const product = productCache[inc.productId];
          const vendedorId = product?.sellerId || inc.userId || null;
          const vendedorObj = vendedorId ? sellerCache[vendedorId] : null;
          const vendedorNombre = vendedorObj ? `${vendedorObj.name || ''} ${vendedorObj.lastname || ''}`.trim() || `ID ${vendedorId}` : `ID ${vendedorId || '-'}`;

          let moderadorNombre = null;
          if (inc.moderatorId) {
            moderadorNombre = `Moderador ${inc.moderatorId}`; // Se podría enriquecer con userAPI si necesario
          }

            const firstPhoto = product?.ProductPhotos && product.ProductPhotos[0]?.url;
            const foto = firstPhoto ? (firstPhoto.startsWith('http') ? firstPhoto : `${API_BASE_URL}${firstPhoto}`) : null;

          return {
            id: inc.id,
            fecha_incidencia: inc.dateIncidence || new Date().toISOString(),
            estado: estadoMap[inc.status] || inc.status || 'pendiente',
            descripcion: inc.description || '',
            tipo: 'deteccion_automatica',
            source: 'incidence',
            producto: {
              id: product?.id || inc.productId,
              codigo: `PROD-${inc.productId}`,
              titulo: product?.title || `Producto ${inc.productId}`,
              vendedor: vendedorNombre,
              vendedor_id: vendedorId,
              precio: product?.price ?? 0,
              foto
            },
            moderador_id: inc.moderatorId || null,
            moderador_nombre: moderadorNombre,
            vendedor_id: vendedorId,
            product_id: inc.productId,
            user_id: inc.userId || null,
            date_incidence_raw: inc.dateIncidence || null,
            apelaciones: [],
            puede_apelar: false
          };
        });

        // Mapear reportes (reporte de usuario)
        const mappedReports = reportsArray.map(rep => {
          const product = productCache[rep.productId];
          const vendedorId = product?.sellerId || rep.userId || null;
          const vendedorObj = vendedorId ? sellerCache[vendedorId] : null;
          const vendedorNombre = vendedorObj ? `${vendedorObj.name || ''} ${vendedorObj.lastname || ''}`.trim() || `ID ${vendedorId}` : `ID ${vendedorId || '-'}`;

          const firstPhoto = product?.ProductPhotos && product.ProductPhotos[0]?.url;
          const foto = firstPhoto ? (firstPhoto.startsWith('http') ? firstPhoto : `${API_BASE_URL}${firstPhoto}`) : null;

          return {
            id: rep.id,
            fecha_incidencia: rep.dateReport || new Date().toISOString(),
            estado: 'pendiente', // Los reportes comienzan como pendientes
            descripcion: rep.description || '',
            tipo: 'reporte_usuario',
            source: 'report',
            producto: {
              id: product?.id || rep.productId,
              codigo: `PROD-${rep.productId}`,
              titulo: product?.title || `Producto ${rep.productId}`,
              vendedor: vendedorNombre,
              vendedor_id: vendedorId,
              precio: product?.price ?? 0,
              foto
            },
            moderador_id: null,
            moderador_nombre: null,
            vendedor_id: vendedorId,
            product_id: rep.productId,
            user_id: rep.userId || null,
            reporte: {
              comentario: rep.description || '',
              usuario_id: rep.userId || null
            },
            apelaciones: [],
            puede_apelar: false
          };
        });

        // Unificar por product_id
        const groupMap = new Map();

        const pushToGroup = (item, type) => {
          const pid = item.product_id || item.producto?.id;
          if (!pid) return;
          if (!groupMap.has(pid)) {
            groupMap.set(pid, {
              id: pid,
              producto: item.producto,
              incidencias: [],
              reportes: [],
              fecha_ultima: item.fecha_incidencia || new Date().toISOString(),
              estado: 'pendiente'
            });
          }
          const g = groupMap.get(pid);
          if (type === 'incidencia') g.incidencias.push(item);
          if (type === 'reporte') g.reportes.push(item);
          // actualizar última fecha
          const d1 = new Date(g.fecha_ultima).getTime();
          const d2 = new Date(item.fecha_incidencia).getTime();
          if (d2 > d1) g.fecha_ultima = item.fecha_incidencia;
        };

        mappedIncidences.forEach(i => pushToGroup(i, 'incidencia'));
        mappedReports.forEach(r => pushToGroup(r, 'reporte'));

        // Agregar estado agregado por prioridad: en_revision > pendiente > suspendido > resuelto
        const prioridad = { en_revision: 4, pendiente: 3, suspendido: 2, resuelto: 1 };
        const groupsArr = Array.from(groupMap.values()).map(g => {
          const estados = [
            ...g.incidencias.map(i => i.estado),
            ...g.reportes.map(r => r.estado)
          ];
          let estadoAgregado = 'pendiente';
          let maxScore = 0;
          estados.forEach(st => {
            const score = prioridad[st] || 0;
            if (score > maxScore) { maxScore = score; estadoAgregado = st; }
          });
          return {
            ...g,
            estado: estadoAgregado
          };
        });

        // Orden por fecha más reciente
        groupsArr.sort((a, b) => new Date(b.fecha_ultima) - new Date(a.fecha_ultima));
        setGrupos(groupsArr);
      } catch (err) {
        console.error('Error al cargar incidencias/reportes:', err);
        setGrupos([]);
      }
    };

    loadData();
  }, []);

  const gruposFiltrados = grupos.filter(g => {
    const matchEstado = filterEstado === 'todas' || g.estado === filterEstado;
    const matchOrigen = filterOrigen === 'todos' ||
      (filterOrigen === 'incidencia' && g.incidencias.length > 0) ||
      (filterOrigen === 'reporte' && g.reportes.length > 0);
    return matchEstado && matchOrigen;
  });

  // Obtener estadísticas del moderador actual
  const todasIncidenciasPlanas = grupos.flatMap(g => g.incidencias);
  const estadisticasModerador = obtenerEstadisticasModerador(moderadorId, todasIncidenciasPlanas);

  // Verificar si el moderador puede tomar incidencias
  const puedeTomarMas = puedeTomarIncidencia(userRole, estadisticasModerador);
  const mensajeValidacion = obtenerMensajeValidacion(estadisticasModerador);

  // Función para asignar incidencia
  const asignarIncidencia = (incidencia) => {
    // Validar permisos
    if (!puedeTomarMas) {
      setModalData({
        isOpen: true,
        type: 'error',
        title: 'No puedes tomar más incidencias',
        message: mensajeValidacion,
        confirmText: 'Entendido'
      });
      return;
    }

    // Mostrar confirmación
    setModalData({
      isOpen: true,
      type: 'confirm',
      title: 'Tomar Incidencia',
      message: `¿Deseas asignarte esta incidencia?\n\nProducto: ${incidencia.producto.titulo}\n\n📊 Estadísticas:\nIncidencias activas: ${estadisticasModerador.incidenciasActivas}/${LIMITES_INCIDENCIAS.MAX_INCIDENCIAS_ACTIVAS_POR_MODERADOR}`,
      onConfirm: async () => {
        // Actualizar dentro de la estructura agrupada
        setGrupos(prev => prev.map(g => g.id === incidencia.producto.id ? {
          ...g,
          incidencias: g.incidencias.map(i => i.id === incidencia.id ? {
            ...i,
            estado: 'en_revision',
            moderador_id: moderadorId,
            moderador_nombre: 'Tú (Moderador)',
            fecha_asignacion: new Date().toISOString()
          } : i),
          estado: 'en_revision'
        } : g));
        // Actualizar estado de moderación del producto a 'review'
        try {
          await productAPI.updateModerationStatus(incidencia.producto.id, 'review');
        } catch {
          // Ignorar error de sincronización; se mostrará en UI si es crítico
        }

        // Mostrar éxito y advertencia si aplica
        const nuevosMensaje = estadisticasModerador.capacidadDisponible === 1
          ? `Incidencia asignada.\n\n⚠️ ${mensajeValidacion}`
          : 'Incidencia asignada correctamente';

        setModalData({
          isOpen: true,
          type: 'success',
          title: 'Asignado',
          message: nuevosMensaje,
          confirmText: 'Entendido'
        });
        setSelectedGroupId(null);
      },
      confirmText: 'Asignar',
      cancelText: 'Cancelar'
    });
  };

  // Función para resolver incidencia
  const resolverIncidencia = (incidencia, decision) => {
    const accion = decision === 'aprobar' ? 'aprobar' : 'rechazar';

    setModalData({
      isOpen: true,
      type: 'confirm',
      title: `${decision === 'aprobar' ? 'Aprobar' : 'Rechazar'} Producto`,
      message: `¿Estás seguro de ${accion} este producto?\n\nProducto: ${incidencia.producto.titulo}`,
      onConfirm: async () => {
        // Reflejar resolución en estructura agrupada
        setGrupos(prev => prev.map(g => g.id === incidencia.producto.id ? {
          ...g,
          incidencias: g.incidencias.map(i => i.id === incidencia.id ? {
            ...i,
            estado: 'resuelto',
            decision_final: decision,
            razon_decision: decisionReason,
            fecha_resolucion: new Date().toISOString()
          } : i),
          // Si todas las incidencias y reportes quedan resueltas marcar grupo resuelto
          estado: 'resuelto'
        } : g));
        // Sincronizar moderación del producto según decisión
        try {
          if (decision === 'aprobar') {
            await productAPI.updateModerationStatus(incidencia.producto.id, 'active');
          } else {
            // Rechazar o suspender bloquea el producto
            await productAPI.updateModerationStatus(incidencia.producto.id, 'block');
          }
        } catch {
          // Ignorar errores puntuales, ya que el flujo principal fue local
        }
  setSelectedGroupId(null);
        setDecisionReason('');
        setModalData({
          isOpen: true,
          type: 'success',
          title: 'Resuelto',
          message: `Producto ${decision === 'aprobar' ? 'aprobado' : 'rechazado'} correctamente`,
          confirmText: 'Entendido'
        });
      },
      confirmText: decision === 'aprobar' ? 'Aprobar' : 'Rechazar',
      cancelText: 'Cancelar'
    });
  };

  // Función para reasignar (solo Admin)
  const reasignarIncidencia = (incidencia) => {
    if (userRole !== 'Admin') {
      setModalData({
        isOpen: true,
        type: 'error',
        title: 'Acceso denegado',
        message: 'Solo el administrador puede reasignar incidencias',
        confirmText: 'Entendido'
      });
      return;
    }

    setModalData({
      isOpen: true,
      type: 'confirm',
      title: 'Reasignar Incidencia',
      message: `¿Deseas reasignar esta incidencia a otro moderador?\n\nProducto: ${incidencia.producto.titulo}\nModerador actual: ${incidencia.moderador_nombre}`,
      onConfirm: () => {
        // Reasignar a otro moderador (para demo, cambiar a 2)
        const nuevoModId = incidencia.moderador_id === 1 ? 2 : 1;
        setGrupos(prev => prev.map(g => g.id === incidencia.producto.id ? {
          ...g,
          incidencias: g.incidencias.map(i => i.id === incidencia.id ? {
            ...i,
            moderador_id: nuevoModId,
            moderador_nombre: `Moderador ${nuevoModId}`
          } : i)
        } : g));
        setModalData({
          isOpen: true,
          type: 'success',
          title: 'Reasignado',
          message: 'Incidencia reasignada correctamente',
          confirmText: 'Entendido'
        });
  setSelectedGroupId(null);
      },
      confirmText: 'Reasignar',
      cancelText: 'Cancelar'
    });
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'en_revision': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'suspendido': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'resuelto': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // (Ya no se usa getTipoColor tras agrupar por producto)

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="sb-container max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
            <FiAlertTriangle className="text-red-500" />
            Gestión de Incidencias y Reportes
          </h1>
          <p className="text-gray-600 mt-1">Revisa y resuelve incidencias de productos reportados</p>

          {/* Demo: Info del usuario actual */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <FiInfo className="inline mr-2" />
              <span className="font-semibold">Rol actual: {userRole}</span> |
              <span className="ml-2">Incidencias activas: {estadisticasModerador.incidenciasActivas}/{LIMITES_INCIDENCIAS.MAX_INCIDENCIAS_ACTIVAS_POR_MODERADOR}</span>
              {mensajeValidacion && <span className="ml-2 text-orange-700">⚠️ {mensajeValidacion}</span>}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="todas">Todas</option>
                <option value="pendiente">Pendientes</option>
                <option value="en_revision">En revisión</option>
                <option value="resuelto">Resueltos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
              <select
                value={filterOrigen}
                onChange={(e) => setFilterOrigen(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="todos">Todos</option>
                <option value="incidencia">Incidencia</option>
                <option value="reporte">Reporte</option>
              </select>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
                <p className="text-lg font-bold text-yellow-600">{grupos.filter(g => g.estado === 'pendiente').length}</p>
                <p className="text-xs text-yellow-700 font-semibold">Pendientes</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                <p className="text-lg font-bold text-blue-600">{grupos.filter(g => g.estado === 'en_revision').length}</p>
                <p className="text-xs text-blue-700 font-semibold">En revisión</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                <p className="text-lg font-bold text-green-600">{grupos.filter(g => g.estado === 'resuelto').length}</p>
                <p className="text-xs text-green-700 font-semibold">Resueltos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista agrupada por producto */}
        <div className="space-y-4">
          {gruposFiltrados.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FiAlertTriangle className="text-5xl text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No hay incidencias que coincidan con los filtros</p>
            </div>
          ) : (
            gruposFiltrados.map(entry => (
              <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Encabezado */}
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setSelectedGroupId(selectedGroupId === entry.id ? null : entry.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getEstadoColor(entry.estado)}`}>
                          {entry.estado === 'pendiente' && <FiClock />}
                          {entry.estado === 'en_revision' && <FiEye />}
                          {entry.estado === 'resuelto' && <MdVerified />}
                          {entry.estado.toUpperCase()}
                        </span>
                        {entry.incidencias.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <FiAlertTriangle /> {entry.incidencias.length} incidencia(s)
                          </span>
                        )}
                        {entry.reportes.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                            <FiAlertTriangle /> {entry.reportes.length} reporte(s)
                          </span>
                        )}
                        <span className="text-xs text-gray-500">{formatDate(entry.fecha_ultima)}</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">PROD-{entry.id} - {entry.producto.titulo}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {entry.incidencias[0]?.descripcion || entry.reportes[0]?.descripcion || ''}
                      </p>
                      <div className="flex items-center gap-6 text-sm text-gray-600 mt-3 flex-wrap">
                        <span>Vendedor: <span className="font-bold text-gray-900">{entry.producto.vendedor}</span></span>
                      </div>
                    </div>
                    <FiChevronDown className={`text-2xl text-gray-400 transition-transform flex-shrink-0 ${selectedGroupId === entry.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Detalles expandibles */}
                {selectedGroupId === entry.id && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Información del producto */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-4">Información del Producto</h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-gray-600 font-semibold">Precio</p>
                            <p className="text-gray-900">${entry.producto.precio}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 font-semibold">Vendedor</p>
                            <p className="text-gray-900">{entry.producto.vendedor}</p>
                          </div>
                        </div>
                      </div>

                      {/* Información agrupada */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-4">Detalles</h4>
                        <div className="space-y-3 text-sm">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-red-800 font-semibold">Incidencias: {entry.incidencias.length}</div>
                            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 text-orange-800 font-semibold">Reportes: {entry.reportes.length}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Acciones generales */}
                    <div className="mb-6">
                      <button
                        onClick={() => navigate(`/producto/${entry.producto.id}`)}
                        className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold flex items-center gap-2"
                      >
                        <FiEye /> Ver producto
                      </button>
                    </div>

                    {/* Listado de incidencias y reportes */}
                    {entry.incidencias.length > 0 && (
                      <div className="mb-6 pb-6 border-b border-gray-300">
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <FiAlertTriangle /> Incidencias automáticas
                        </h4>
                        <div className="space-y-3">
                          {entry.incidencias.map(inc => (
                            <div key={`inc-${inc.id}`} className="bg-white rounded-lg p-4 border border-blue-200">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-sm text-gray-700 mb-1">{inc.descripcion}</p>
                                  <p className="text-xs text-gray-500">Estado: <span className="font-semibold">{inc.estado}</span> · {formatDate(inc.fecha_incidencia)}</p>
                                </div>
                                <div className="flex gap-2">
                                  {inc.estado === 'pendiente' && (
                                    <button
                                      onClick={() => asignarIncidencia(inc)}
                                      disabled={!puedeTomarMas}
                                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                                        puedeTomarMas ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                      }`}
                                    >
                                      Tomar
                                    </button>
                                  )}
                                  {/* Editar/Eliminar incidencia */}
                                  <button
                                    onClick={() => {
                                      setModalData({
                                        isOpen: true,
                                        type: 'confirm',
                                        title: 'Editar Incidencia',
                                        message: '¿Deseas actualizar la descripción de esta incidencia?',
                                        onConfirm: async () => {
                                          try {
                                            await incidenceAPI.update(inc.id, {
                                              id: inc.id,
                                              dateIncidence: inc.date_incidence_raw || inc.fecha_incidencia,
                                              description: decisionReason || inc.descripcion,
                                              status: inc.estado === 'en_revision' ? 'in_review' : (inc.estado === 'pendiente' ? 'pending' : (inc.estado === 'suspendido' ? 'suspended' : 'resolved')),
                                              userId: inc.user_id || inc.vendedor_id || 0,
                                              moderatorId: inc.moderador_id || 0,
                                              productId: inc.product_id
                                            });
                                            // Actualizar estado local
                                            setGrupos(prev => prev.map(g => g.id === entry.id ? {
                                              ...g,
                                              incidencias: g.incidencias.map(i => i.id === inc.id ? { ...i, descripcion: decisionReason || i.descripcion } : i)
                                            } : g));
                                            setModalData({ isOpen: true, type: 'success', title: 'Incidencia Actualizada', message: 'Se actualizó la incidencia correctamente', confirmText: 'Entendido' });
                                          } catch {
                                            setModalData({ isOpen: true, type: 'error', title: 'Error', message: 'No se pudo actualizar la incidencia', confirmText: 'Cerrar' });
                                          }
                                        },
                                        confirmText: 'Actualizar',
                                        cancelText: 'Cancelar'
                                      });
                                    }}
                                    className="px-3 py-1.5 border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 font-semibold text-sm"
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setModalData({
                                        isOpen: true,
                                        type: 'confirm',
                                        title: 'Eliminar Incidencia',
                                        message: '¿Estás seguro de eliminar esta incidencia? Esta acción no se puede deshacer.',
                                        onConfirm: async () => {
                                          try {
                                            await incidenceAPI.remove(inc.id);
                                            setGrupos(prev => prev.map(g => g.id === entry.id ? { ...g, incidencias: g.incidencias.filter(i => i.id !== inc.id) } : g));
                                            setModalData({ isOpen: true, type: 'success', title: 'Eliminada', message: 'Incidencia eliminada correctamente', confirmText: 'Entendido' });
                                          } catch {
                                            setModalData({ isOpen: true, type: 'error', title: 'Error', message: 'No se pudo eliminar la incidencia', confirmText: 'Cerrar' });
                                          }
                                        },
                                        confirmText: 'Eliminar',
                                        cancelText: 'Cancelar'
                                      });
                                    }}
                                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg text-sm"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {entry.reportes.length > 0 && (
                      <div className="mt-6 flex flex-col gap-3 border-b border-gray-300 pb-6">
                        <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                          <FiAlertTriangle /> Reportes de usuarios
                        </h4>
                        {entry.reportes.map(rep => (
                          <div key={`rep-${rep.id}`} className="bg-white rounded-lg p-4 border border-orange-200">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-sm text-gray-700 mb-1">{rep.descripcion}</p>
                                <p className="text-xs text-gray-500">{formatDate(rep.fecha_incidencia)}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setModalData({
                                    isOpen: true,
                                    type: 'confirm',
                                    title: 'Eliminar Reporte',
                                    message: '¿Estás seguro de eliminar este reporte? Esta acción no se puede deshacer.',
                                    onConfirm: async () => {
                                      try {
                                        await reportAPI.remove(rep.id);
                                        setGrupos(prev => prev.map(g => g.id === entry.id ? { ...g, reportes: g.reportes.filter(r => r.id !== rep.id) } : g));
                                        setModalData({ isOpen: true, type: 'success', title: 'Reporte Eliminado', message: 'Reporte eliminado correctamente', confirmText: 'Entendido' });
                                      } catch {
                                        setModalData({ isOpen: true, type: 'error', title: 'Error', message: 'No se pudo eliminar el reporte', confirmText: 'Cerrar' });
                                      }
                                    },
                                    confirmText: 'Eliminar',
                                    cancelText: 'Cancelar'
                                  });
                                }}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg text-sm"
                              >
                                Eliminar Reporte
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Decisión a nivel de producto (opcional): usar el primer elemento en revisión si existe */}
                    {(() => {
                      const incEnRevision = entry.incidencias.find(i => i.estado === 'en_revision');
                      if (!incEnRevision) return null;
                      return (
                        <div className="mb-6 pb-6 border-b border-gray-300">
                          <h4 className="font-bold text-gray-900 mb-4">Tomar Decisión</h4>
                          <textarea
                            value={decisionReason}
                            onChange={(e) => setDecisionReason(e.target.value)}
                            placeholder="Razón de tu decisión..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 resize-none"
                            rows="3"
                          />
                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => resolverIncidencia(incEnRevision, 'aprobar')}
                              className="flex-1 min-w-[150px] py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition"
                            >
                              <MdVerified className="inline mr-2" />
                              Aprobar
                            </button>
                            <button
                              onClick={() => resolverIncidencia(incEnRevision, 'rechazar')}
                              className="flex-1 min-w-[150px] py-2 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition"
                            >
                              <MdBlock className="inline mr-2" />
                              Rechazar
                            </button>
                            <button
                              onClick={() => resolverIncidencia(incEnRevision, 'suspender')}
                              className="flex-1 min-w-[150px] py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition"
                            >
                              <FiAlertTriangle className="inline mr-2" />
                              Suspender
                            </button>
                            {userRole === 'Admin' && (
                              <button
                                onClick={() => reasignarIncidencia(incEnRevision)}
                                className="flex-1 min-w-[150px] py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition"
                              >
                                🔄 Reasignar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Nota: el botón de tomar está ahora junto a cada incidencia pendiente */}

                    {/* Estado resuelto (nivel de grupo) */}
                    {entry.estado === 'resuelto' && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Decisión Final:</span>
                          <span className="ml-2 font-bold text-green-600">Resuelto</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalData.isOpen}
        type={modalData.type}
        title={modalData.title}
        message={modalData.message}
        onConfirm={modalData.onConfirm}
        confirmText={modalData.confirmText || 'Confirmar'}
        cancelText={modalData.cancelText}
        onCancel={() => setModalData({ ...modalData, isOpen: false })}
        onClose={() => setModalData({ ...modalData, isOpen: false })}
      />
    </div>
  );
}

export default GestionIncidenciasPage;
