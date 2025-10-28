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
import api, { API_BASE_URL, productAPI, userAPI } from '../services/api';

//

function GestionIncidenciasPage() {
  usePageTitle('Gestión de Incidencias');
  const navigate = useNavigate();
  const [incidencias, setIncidencias] = useState([]);
  const [filterEstado, setFilterEstado] = useState('todas');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [selectedIncidencia, setSelectedIncidencia] = useState(null);
  const [modalData, setModalData] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });
  const [decisionReason, setDecisionReason] = useState('');
  const [userRole] = useState('Admin'); // Demo: cambiar a 'Moderador' para probar
  const [moderadorId] = useState(1); // Demo: ID del moderador actual

  useEffect(() => {
    const loadIncidences = async () => {
      try {
        const { data } = await api.get('/incidences');
        const list = Array.isArray(data) ? data : [];

        const mapped = await Promise.all(
          list.map(async (inc) => {
            // Obtener producto
            let product = null;
            try {
              product = await productAPI.getProductById(inc.productId);
            } catch {
              product = null;
            }

            // Construir datos de producto
            let titulo = `Producto ${inc.productId}`;
            let precio = 0;
            let vendedorNombre = `ID ${product?.sellerId || inc.userId || '-'}`;
            let vendedorId = product?.sellerId || inc.userId || null;
            let foto = null;
            let codigo = `PROD-${inc.productId}`;

            if (product) {
              titulo = product.title || titulo;
              precio = product.price ?? 0;
              vendedorId = product.sellerId ?? vendedorId;
              const firstPhoto = product.ProductPhotos && product.ProductPhotos[0]?.url;
              foto = firstPhoto ? (firstPhoto.startsWith('http') ? firstPhoto : `${API_BASE_URL}${firstPhoto}`) : null;
              codigo = `PROD-${product.id}`;
              // Intentar obtener nombre del vendedor
              if (vendedorId) {
                try {
                  const seller = await userAPI.getUserById(vendedorId);
                  vendedorNombre = `${seller.name || ''} ${seller.lastname || ''}`.trim() || vendedorNombre;
                } catch { /* ignorar */ }
              }
            }

            // Obtener nombre del moderador si aplica
            let moderadorNombre = null;
            if (inc.moderatorId) {
              try {
                const mod = await userAPI.getUserById(inc.moderatorId);
                moderadorNombre = `${mod.name || ''} ${mod.lastname || ''}`.trim() || null;
              } catch { /* ignorar */ }
            }

            // Mapear estado
            const estadoMap = { pending: 'pendiente', in_review: 'en_revision', reviewing: 'en_revision', resolved: 'resuelto' };
            const estado = estadoMap[inc.status] || inc.status || 'pendiente';

            return {
              id: inc.id,
              fecha_incidencia: inc.dateIncidence || new Date().toISOString(),
              estado,
              descripcion: inc.description || '',
              tipo: 'reporte_usuario',
              producto: {
                id: product?.id || inc.productId,
                codigo,
                titulo,
                vendedor: vendedorNombre,
                vendedor_id: vendedorId,
                precio,
                foto
              },
              moderador_id: inc.moderatorId || null,
              moderador_nombre: moderadorNombre,
              vendedor_id: vendedorId,
              apelaciones: [],
              puede_apelar: false
            };
          })
        );

        setIncidencias(mapped);
      } catch (error) {
        console.error('Error al cargar incidencias:', error);
        setIncidencias([]);
      }
    };

    loadIncidences();
  }, []);

  const incidenciasFiltradas = incidencias.filter(inc => {
    const matchEstado = filterEstado === 'todas' || inc.estado === filterEstado;
    const matchTipo = filterTipo === 'todos' || inc.tipo === filterTipo;
    return matchEstado && matchTipo;
  });

  // Obtener estadísticas del moderador actual
  const estadisticasModerador = obtenerEstadisticasModerador(moderadorId, incidencias);

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
      onConfirm: () => {
        // Asignar la incidencia
        setIncidencias(prev =>
          prev.map(inc =>
            inc.id === incidencia.id
              ? {
                  ...inc,
                  estado: 'en_revision',
                  moderador_id: moderadorId,
                  moderador_nombre: 'Tú (Moderador)',
                  fecha_asignacion: new Date().toISOString()
                }
              : inc
          )
        );

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
        setSelectedIncidencia(null);
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
      onConfirm: () => {
        setIncidencias(prev =>
          prev.map(inc =>
            inc.id === incidencia.id
              ? {
                  ...inc,
                  estado: 'resuelto',
                  decision_final: decision,
                  razon_decision: decisionReason,
                  fecha_resolucion: new Date().toISOString()
                }
              : inc
          )
        );
        setSelectedIncidencia(null);
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
        setIncidencias(prev =>
          prev.map(inc =>
            inc.id === incidencia.id
              ? {
                  ...inc,
                  moderador_id: nuevoModId,
                  moderador_nombre: `Moderador ${nuevoModId}`
                }
              : inc
          )
        );
        setModalData({
          isOpen: true,
          type: 'success',
          title: 'Reasignado',
          message: 'Incidencia reasignada correctamente',
          confirmText: 'Entendido'
        });
        setSelectedIncidencia(null);
      },
      confirmText: 'Reasignar',
      cancelText: 'Cancelar'
    });
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'en_revision': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'resuelto': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTipoColor = (tipo) => {
    switch (tipo) {
      case 'deteccion_automatica': return 'bg-red-100 text-red-800';
      case 'reporte_usuario': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="todos">Todos</option>
                <option value="deteccion_automatica">Detección automática</option>
                <option value="reporte_usuario">Reporte de usuario</option>
              </select>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
                <p className="text-lg font-bold text-yellow-600">{incidencias.filter(i => i.estado === 'pendiente').length}</p>
                <p className="text-xs text-yellow-700 font-semibold">Pendientes</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                <p className="text-lg font-bold text-blue-600">{incidencias.filter(i => i.estado === 'en_revision').length}</p>
                <p className="text-xs text-blue-700 font-semibold">En revisión</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                <p className="text-lg font-bold text-green-600">{incidencias.filter(i => i.estado === 'resuelto').length}</p>
                <p className="text-xs text-green-700 font-semibold">Resueltos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de incidencias */}
        <div className="space-y-4">
          {incidenciasFiltradas.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FiAlertTriangle className="text-5xl text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No hay incidencias que coincidan con los filtros</p>
            </div>
          ) : (
            incidenciasFiltradas.map(incidencia => (
              <div key={incidencia.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Encabezado */}
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setSelectedIncidencia(selectedIncidencia?.id === incidencia.id ? null : incidencia)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getEstadoColor(incidencia.estado)}`}>
                          {incidencia.estado === 'pendiente' && <FiClock />}
                          {incidencia.estado === 'en_revision' && <FiEye />}
                          {incidencia.estado === 'resuelto' && <MdVerified />}
                          {incidencia.estado.toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getTipoColor(incidencia.tipo)}`}>
                          <FiAlertTriangle />
                          {incidencia.tipo === 'deteccion_automatica' ? 'Automática' : 'Usuario'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(incidencia.fecha_incidencia)}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900">#{incidencia.id} - {incidencia.producto.titulo}</h3>
                      <p className="text-sm text-gray-600 mt-1">{incidencia.descripcion}</p>
                      <div className="flex items-center gap-6 text-sm text-gray-600 mt-3 flex-wrap">
                        <span>Vendedor: <span className="font-bold text-gray-900">{incidencia.producto.vendedor}</span></span>
                        {incidencia.moderador_nombre && (
                          <span>Moderador: <span className="font-bold text-gray-900">{incidencia.moderador_nombre}</span></span>
                        )}
                      </div>
                    </div>
                    <FiChevronDown className={`text-2xl text-gray-400 transition-transform flex-shrink-0 ${selectedIncidencia?.id === incidencia.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Detalles expandibles */}
                {selectedIncidencia?.id === incidencia.id && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Información del producto */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-4">Información del Producto</h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-gray-600 font-semibold">Precio</p>
                            <p className="text-gray-900">${incidencia.producto.precio}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 font-semibold">Vendedor</p>
                            <p className="text-gray-900">{incidencia.producto.vendedor}</p>
                          </div>
                        </div>
                      </div>

                      {/* Información de la incidencia */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-4">Detalles</h4>
                        <div className="space-y-3 text-sm">

                          <div>
                            <p className="text-gray-600 font-semibold">Tipo</p>
                            <p className="text-gray-900">
                              {incidencia.tipo === 'deteccion_automatica' ? 'Detección Automática' : 'Reporte de Usuario'}
                            </p>
                          </div>
                          {incidencia.reporte && (
                            <div>
                              <p className="text-gray-600 font-semibold">Comentario del Usuario</p>
                              <p className="text-gray-900 italic">"{incidencia.reporte.comentario}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Acciones generales */}
                    <div className="mb-6">
                      <button
                        onClick={() => navigate(`/producto/${incidencia.producto.id}`)}
                        className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold flex items-center gap-2"
                      >
                        <FiEye /> Ver producto
                      </button>
                    </div>

                    {/* Apelaciones */}
                    {incidencia.apelaciones.length > 0 && (
                      <div className="mb-6 pb-6 border-b border-gray-300">
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <FiMessageSquare /> Apelaciones
                        </h4>
                        <div className="space-y-3">
                          {incidencia.apelaciones.map(apelacion => (
                            <div key={apelacion.id} className="bg-white rounded-lg p-4 border border-orange-200">
                              <p className="text-sm text-gray-700">{apelacion.descripcion}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                Revisado por: <span className="font-semibold">{apelacion.moderador_revisor}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Formulario de decisión */}
                    {incidencia.estado === 'en_revision' && (
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
                            onClick={() => resolverIncidencia(incidencia, 'aprobar')}
                            className="flex-1 min-w-[150px] py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition"
                          >
                            <MdVerified className="inline mr-2" />
                            Aprobar
                          </button>
                          <button
                            onClick={() => resolverIncidencia(incidencia, 'rechazar')}
                            className="flex-1 min-w-[150px] py-2 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition"
                          >
                            <MdBlock className="inline mr-2" />
                            Rechazar
                          </button>
                          {userRole === 'Admin' && (
                            <button
                              onClick={() => reasignarIncidencia(incidencia)}
                              className="flex-1 min-w-[150px] py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition"
                            >
                              🔄 Reasignar
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Botón de asignación */}
                    {incidencia.estado === 'pendiente' && (
                      <button
                        onClick={() => asignarIncidencia(incidencia)}
                        disabled={!puedeTomarMas}
                        className={`w-full py-2 px-4 font-semibold rounded-lg transition ${
                          puedeTomarMas
                            ? 'bg-orange-500 hover:bg-orange-600 text-white'
                            : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        }`}
                      >
                        {puedeTomarMas ? 'Tomar Incidencia' : 'No puedes tomar más (límite alcanzado)'}
                      </button>
                    )}

                    {/* Estado resuelto */}
                    {incidencia.estado === 'resuelto' && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Decisión Final:</span>
                          <span className="ml-2 font-bold text-green-600">{incidencia.decision_final?.toUpperCase()}</span>
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
      />
    </div>
  );
}

export default GestionIncidenciasPage;
