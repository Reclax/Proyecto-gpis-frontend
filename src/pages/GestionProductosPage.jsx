import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiEye, FiAlertTriangle, FiCheck, FiX, FiClock, FiPackage, FiChevronDown } from 'react-icons/fi';
import { MdBlock, MdVerified } from 'react-icons/md';
import usePageTitle from '../hooks/usePageTitle';
import Modal from '../components/common/Modal';
import { checkAdminAccess } from '../utils/rolePermissions';
import { productAPI, categoryAPI, authAPI, reportAPI, incidenceAPI, API_BASE_URL } from '../services/api';

// Sin datos estáticos: cargaremos desde la API

function GestionProductosPage() {
  usePageTitle('Gestión de Productos');
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos');
  // Filtro por estado de moderación: todos | active | review | block
  const [filterModeracion, setFilterModeracion] = useState('todos');
  // Filtro por origen de alerta (incidencia/reporte) si disponible en _raw
  const [filterOrigen, setFilterOrigen] = useState('todos');
  // Selección no requerida actualmente
  const [expandedId, setExpandedId] = useState(null);
  const [modalData, setModalData] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });
  const [categoryCache, setCategoryCache] = useState({}); // id -> category object

  useEffect(() => {
    // Verificar acceso a gestión de productos
    const access = checkAdminAccess('gestionar_productos_admin');

    if (!access.isAllowed) {
      navigate(access.redirectPath || '/');
      return;
    }

    setIsAuthorized(true);
    // Cargar productos desde el API
    const load = async () => {
      try {
        // Usar endpoint de moderación para incluir todos los productos sin filtros (solo admins)
        const data = await productAPI.getAllModeration().catch(async () => {
          // Fallback si endpoint no disponible
          return await productAPI.getAll();
        });
        // Mapear al modelo usado en esta vista sin datos estáticos
        const mapped = (Array.isArray(data) ? data : []).map(p => {
          const firstPhoto = p.ProductPhotos && p.ProductPhotos.length > 0 ? p.ProductPhotos[0].url : null;
          const foto = firstPhoto ? (firstPhoto.startsWith('http') ? firstPhoto : `${API_BASE_URL}${firstPhoto}`) : null;
          // Mapear estado del backend a etiquetas locales
          const estadoMap = {
            active: 'activo',
            suspended: 'suspendido',
            pending: 'pendiente',
            deleted: 'eliminado'
          };
          const estadoLocal = estadoMap[p.status] || 'activo';
          const moderationStatus = p.moderationStatus || 'active'; // active | review | block
          return {
            id: p.id,
            codigo: `PROD-${p.id}`,
            titulo: p.title,
            descripcion: p.description || '',
            precio: p.price,
            ubicacion: p.location || '',
            tipo: 'producto',
            estado: estadoLocal,
            condicion: estadoLocal,
            fecha_publicacion: p.createdAt || new Date().toISOString(),
            vendedor: `ID ${p.sellerId}`,
            vendedor_id: p.sellerId,
            categoria: `ID ${p.categoryId}`,
            es_peligroso: false,
            reportes: 0,
            foto,
            moderationStatus,
            // Guardar datos crudos para el modal
            _raw: p
          };
        });
        setProductos(mapped);
      } catch {
        setProductos([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  // Filtrar productos
  const productosFiltrados = productos.filter(prod => {
    const matchSearch =
      prod.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.vendedor.toLowerCase().includes(searchTerm.toLowerCase());

    const matchEstado = filterEstado === 'todos' || prod.estado === filterEstado;
    const matchTipo = filterTipo === 'todos' || prod.tipo === filterTipo;
    const matchModeracion = filterModeracion === 'todos' || prod.moderationStatus === filterModeracion;
    // Origen: marca automática si fue bloqueado por incidencia/reporte (simulado si _raw tiene incidenceCount/reportCount)
    const origen = prod._raw?.lastModerationSource || (prod._raw?.incidenceCount > 0 ? 'incidencia' : (prod._raw?.reportCount > 0 ? 'reporte' : 'ninguno'));
    const matchOrigen = filterOrigen === 'todos' || origen === filterOrigen;

    return matchSearch && matchEstado && matchTipo && matchModeracion && matchOrigen;
  });

  // Cambiar estado del producto
  const cambiarEstadoProducto = (producto, nuevoEstado) => {
    const accion = nuevoEstado === 'activo' ? 'activar' : 'suspender';
    setModalData({
      isOpen: true,
      type: 'confirm',
      title: `${accion === 'activar' ? 'Activar' : 'Suspender'} Producto`,
      message: `¿Estás seguro de ${accion} el producto "${producto.titulo}"?${accion === 'suspender' ? '\n\nEsta acción:\n- Creará una incidencia pendiente automáticamente\n- Ocultará el producto de la plataforma\n- La incidencia aparecerá en "Incidencias pendientes"' : ''}`,
      onConfirm: async () => {
        try {
          // Cuando se suspende: usar 'review' para que aparezca en pendientes
          // Cuando se activa: usar 'active' para resolver incidencias
          const targetModeration = nuevoEstado === 'suspendido' ? 'review' : 'active';
          
          console.log(`Cambiando estado de producto ${producto.id} a moderationStatus: ${targetModeration}`);
          await productAPI.updateModerationStatus(producto.id, targetModeration);
          
          setProductos(prev =>
            prev.map(p => p.id === producto.id ? {
              ...p,
              estado: nuevoEstado,
              moderationStatus: targetModeration,
              fecha_suspension: nuevoEstado === 'suspendido' ? new Date().toISOString() : null
            } : p)
          );
          setModalData({
            isOpen: true,
            type: 'success',
            title: 'Producto Actualizado',
            message: `El producto ha sido ${accion === 'activar' ? 'activado' : 'suspendido'} correctamente${nuevoEstado === 'suspendido' ? '. Se ha creado una incidencia pendiente automáticamente.' : '.'}`,
            confirmText: 'Entendido'
          });
        } catch (error) {
          console.error('Error al cambiar estado:', error);
          setModalData({
            isOpen: true,
            type: 'error',
            title: 'Error',
            message: 'No se pudo actualizar el estado del producto',
            confirmText: 'Cerrar'
          });
        }
      },
      confirmText: accion === 'activar' ? 'Activar' : 'Suspender',
      cancelText: 'Cancelar'
    });
  };

  // Marcar como peligroso
  const marcarComoPeligroso = (producto) => {
    setModalData({
      isOpen: true,
      type: 'warning',
      title: 'Reportar',
      message: `¿Estás seguro de reportar "${producto.titulo}"?\n\nEsto:\n- Creará un reporte administrativo\n- Creará una incidencia pendiente\n- Suspenderá automáticamente el producto\n- Lo ocultará de todos los usuarios\n- Notificará al vendedor\n- Permitirá una apelación`,
      onConfirm: async () => {
        try {
          console.log('=== INICIANDO REPORTE DE PRODUCTO ===');
          
          // 1. Obtener el usuario actual (administrador que reporta)
          const currentUser = authAPI.getUserData();
          console.log('Usuario actual:', currentUser);
          
          if (!currentUser || !currentUser.id) {
            throw new Error('No se pudo obtener el usuario actual. Por favor, inicia sesión nuevamente.');
          }

          // 2. Crear el reporte administrativo en la base de datos
          console.log('Creando reporte...');
          const reporteCreado = await reportAPI.create({
            productId: producto.id,
            userId: currentUser.id,
            type: 'reporte_administrativo',
            description: 'Producto marcado como peligroso por el administrador. Detectado como potencialmente peligroso y suspendido automáticamente.'
          });
          console.log('✅ Reporte creado:', reporteCreado);

          // 3. Crear la incidencia asociada al reporte
          console.log('Creando incidencia...');
          const incidenciaCreada = await incidenceAPI.create({
            userId: currentUser.id,
            productId: producto.id,
            description: 'Producto reportado y bloqueado por el administrador. Motivo: detectado como potencialmente peligroso.',
            status: 'pending'
          });
          console.log('✅ Incidencia creada:', incidenciaCreada);

          // 4. Actualizar el estado de moderación del producto a 'review' (en revisión)
          console.log('Actualizando moderationStatus a review...');
          await productAPI.updateModerationStatus(producto.id, 'review');
          console.log('✅ ModerationStatus actualizado');

          // 5. Actualizar el estado local
          setProductos(prev =>
            prev.map(p => p.id === producto.id ? {
              ...p,
              es_peligroso: true,
              estado: 'suspendido',
              moderationStatus: 'review', // Cambiado a 'review' para que aparezca en pendientes
              fecha_suspension: new Date().toISOString(),
              razon_suspension: 'Detectado como producto potencialmente peligroso'
            } : p)
          );

          console.log('=== REPORTE COMPLETADO EXITOSAMENTE ===');
          
          setModalData({
            isOpen: true,
            type: 'success',
            title: 'Producto Reportado',
            message: 'El producto ha sido reportado y bloqueado automáticamente. La incidencia aparecerá en "Incidencias pendientes" y el vendedor podrá apelar.',
            confirmText: 'Entendido'
          });
        } catch (error) {
          console.error('=== ERROR AL REPORTAR PRODUCTO ===');
          console.error('Error completo:', error);
          console.error('Respuesta del servidor:', error.response?.data);
          console.error('Status:', error.response?.status);
          
          let mensajeError = 'No se pudo reportar el producto';
          
          if (error.response?.status === 401) {
            mensajeError = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          } else if (error.response?.data?.message) {
            mensajeError = error.response.data.message;
          } else if (error.message) {
            mensajeError = error.message;
          }
          
          setModalData({
            isOpen: true,
            type: 'error',
            title: 'Error al Reportar',
            message: mensajeError,
            confirmText: 'Cerrar'
          });
        }
      },
      confirmText: 'Reportar',
      cancelText: 'Cancelar'
    });
  };

  // Revertir marca de peligroso
  const revertirPeligroso = (producto) => {
    setModalData({
      isOpen: true,
      type: 'confirm',
      title: 'Revertir Marca de Peligroso',
      message: `¿Estás seguro de que "${producto.titulo}" no es un producto peligroso?\n\nSe reactivará el producto automáticamente.`,
      onConfirm: async () => {
        try {
          await productAPI.updateModerationStatus(producto.id, 'active');
          setProductos(prev =>
            prev.map(p => p.id === producto.id ? {
              ...p,
              es_peligroso: false,
              estado: 'activo',
              moderationStatus: 'active',
              razon_suspension: null,
              fecha_suspension: null
            } : p)
          );
          setModalData({
            isOpen: true,
            type: 'success',
            title: 'Marca Revertida',
            message: 'El producto ha sido reactivado y está disponible nuevamente en la plataforma.',
            confirmText: 'Entendido'
          });
        } catch {
          setModalData({
            isOpen: true,
            type: 'error',
            title: 'Error',
            message: 'No se pudo reactivar el producto',
            confirmText: 'Cerrar'
          });
        }
      },
      confirmText: 'Revertir',
      cancelText: 'Cancelar'
    });
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'activo': return 'bg-green-100 text-green-800 border-green-300';
      case 'pendiente': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'suspendido': return 'bg-red-100 text-red-800 border-red-300';
      case 'eliminado': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
            <FiPackage className="text-green-500" />
            Gestión de Productos y Servicios
          </h1>
          <p className="text-gray-600 mt-1">Administra y supervisa todos los productos y servicios publicados en la plataforma</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            {/* Búsqueda */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Título, código o vendedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Filtro Estado */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="todos">Todos</option>
                <option value="activo">Activos</option>
                <option value="pendiente">Pendientes</option>
                <option value="suspendido">Suspendidos</option>
                <option value="eliminado">Eliminados</option>
              </select>
            </div>

            {/* Filtro Tipo */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="todos">Todos</option>
                <option value="producto">Productos</option>
                <option value="servicio">Servicios</option>
              </select>
            </div>
            {/* Moderación */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Moderación</label>
              <select
                value={filterModeracion}
                onChange={(e) => setFilterModeracion(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="todos">Todos</option>
                <option value="active">Activos</option>
                <option value="review">En revisión</option>
                <option value="block">Bloqueados</option>
              </select>
            </div>
            {/* Origen */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Origen</label>
              <select
                value={filterOrigen}
                onChange={(e) => setFilterOrigen(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="todos">Todos</option>
                <option value="incidencia">Incidencia</option>
                <option value="reporte">Reporte</option>
                <option value="ninguno">Sin alerta</option>
              </select>
            </div>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
              <p className="text-lg font-bold text-blue-600">{productos.length}</p>
              <p className="text-xs text-blue-700 font-semibold">Total</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
              <p className="text-lg font-bold text-green-600">{productos.filter(p => p.estado === 'activo').length}</p>
              <p className="text-xs text-green-700 font-semibold">Activos</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
              <p className="text-lg font-bold text-yellow-600">{productos.filter(p => p.estado === 'pendiente').length}</p>
              <p className="text-xs text-yellow-700 font-semibold">Pendientes</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
              <p className="text-lg font-bold text-red-600">{productos.filter(p => p.es_peligroso).length}</p>
              <p className="text-xs text-red-700 font-semibold">Peligrosos</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-200">
              <p className="text-lg font-bold text-purple-600">{productos.filter(p => p.reportes > 0).length}</p>
              <p className="text-xs text-purple-700 font-semibold">Reportados</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
              <p className="text-lg font-bold text-orange-600">{productos.filter(p => p.moderationStatus === 'review').length}</p>
              <p className="text-xs text-orange-700 font-semibold">En revisión</p>
            </div>
            <div className="bg-black/5 rounded-lg p-3 text-center border border-gray-300">
              <p className="text-lg font-bold text-gray-800">{productos.filter(p => p.moderationStatus === 'block').length}</p>
              <p className="text-xs text-gray-700 font-semibold">Bloqueados</p>
            </div>
          </div>
        </div>

        {/* Lista de productos */}
        <div className="space-y-4">
          {productosFiltrados.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FiPackage className="text-5xl text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No hay productos que coincidan con los filtros</p>
            </div>
          ) : (
            productosFiltrados.map(producto => (
              <div key={producto.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Encabezado */}
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition"
                  onClick={async () => {
                    const willExpand = expandedId !== producto.id;
                    const nextId = willExpand ? producto.id : null;
                    setExpandedId(nextId);
                    // Al expandir, cargar nombre de categoría si no está en cache
                    if (willExpand) {
                      const catId = producto?._raw?.categoryId;
                      if (catId) {
                        const cached = categoryCache[catId];
                        if (cached) {
                          // Reemplazar texto si aún es "ID X"
                          if (typeof producto.categoria === 'string' && producto.categoria.startsWith('ID ')) {
                            setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, categoria: cached.name } : p));
                          }
                        } else {
                          try {
                            const cat = await categoryAPI.getById(catId);
                            setCategoryCache(prev => ({ ...prev, [catId]: cat }));
                            setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, categoria: cat.name } : p));
                          } catch {
                            // Ignorar errores silenciosamente; mantener "ID X"
                          }
                        }
                      }
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getEstadoColor(producto.estado)}`}>
                          {producto.estado === 'activo' && <FiCheck />}
                          {producto.estado === 'pendiente' && <FiClock />}
                          {producto.estado === 'suspendido' && <MdBlock />}
                          {producto.estado.toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                          producto.moderationStatus === 'active' ? 'bg-green-50 text-green-700 border-green-300' :
                          producto.moderationStatus === 'review' ? 'bg-orange-50 text-orange-700 border-orange-300' :
                          'bg-red-50 text-red-700 border-red-300'
                        }`}>
                          {producto.moderationStatus === 'active' && '✔ Activo'}
                          {producto.moderationStatus === 'review' && '⏳ Revisión'}
                          {producto.moderationStatus === 'block' && '⛔ Bloqueado'}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-semibold">
                          {producto.tipo === 'producto' ? '📦 Producto' : '🔧 Servicio'}
                        </span>
                        {producto.es_peligroso && (
                          <span className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                            <FiAlertTriangle /> Peligroso
                          </span>
                        )}
                        {producto.reportes > 0 && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold">
                            {producto.reportes} reportes
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-gray-900">{producto.codigo} - {producto.titulo}</h3>
                      <p className="text-sm text-gray-600 mt-1">{producto.descripcion}</p>

                      <div className="flex items-center gap-6 text-sm text-gray-600 mt-3 flex-wrap">
                        <span>Precio: <span className="font-bold text-gray-900">${producto.precio}</span></span>
                        <span>Ubicación: <span className="font-bold text-gray-900">{producto.ubicacion}</span></span>
                        <span>Publicado: <span className="font-bold text-gray-900">{formatDate(producto.fecha_publicacion)}</span></span>
                      </div>
                    </div>
                    <FiChevronDown className={`text-2xl text-gray-400 transition-transform flex-shrink-0 ${expandedId === producto.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Detalles expandibles */}
                {expandedId === producto.id && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Información del producto */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-4">Información Detallada</h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-gray-600 font-semibold">Categoría</p>
                            <p className="text-gray-900">{producto.categoria}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 font-semibold">Descripción</p>
                            <p className="text-gray-900">{producto.descripcion}</p>
                          </div>
                          {producto.horario_atencion && (
                            <div>
                              <p className="text-gray-600 font-semibold">Horario de Atención</p>
                              <p className="text-gray-900">{producto.horario_atencion}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Estado y fechas */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-4">Estado y Administración</h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-gray-600 font-semibold">Estado Actual</p>
                            <p className="text-gray-900">{producto.estado.toUpperCase()}</p>
                          </div>
                          {producto.es_peligroso && (
                            <div>
                              <p className="text-gray-600 font-semibold">Razón de Suspensión</p>
                              <p className="text-gray-900">{producto.razon_suspension}</p>
                            </div>
                          )}
                          {producto.fecha_suspension && (
                            <div>
                              <p className="text-gray-600 font-semibold">Fecha de Suspensión</p>
                              <p className="text-gray-900">{formatDate(producto.fecha_suspension)}</p>
                            </div>
                          )}
                          {producto.reportes > 0 && (
                            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                              <p className="text-purple-900 font-semibold">{producto.reportes} reportes de usuarios</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="border-t border-gray-300 pt-6">
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/producto/${producto.id}`);
                          }}
                          className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold flex items-center gap-2"
                        >
                          <FiEye /> Ver producto
                        </button>
                        {/* Suspender: disponible si está activo (moderationStatus === 'active') */}
                        {producto.moderationStatus === 'active' && (
                          <button
                            onClick={() => cambiarEstadoProducto(producto, 'suspendido')}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition"
                          >
                            <MdBlock className="inline mr-2" />
                            Suspender
                          </button>
                        )}
                        {/* Activar: disponible si está en revisión y no es peligroso */}
                        {producto.moderationStatus === 'review' && !producto.es_peligroso && (
                          <button
                            onClick={() => cambiarEstadoProducto(producto, 'activo')}
                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition"
                          >
                            <FiCheck className="inline mr-2" />
                            Activar
                          </button>
                        )}
                        {/* Mensaje para productos bloqueados */}
                        {producto.moderationStatus === 'block' && (
                          <div className="px-4 py-2 bg-red-100 text-red-700 font-semibold rounded-lg border border-red-300">
                            Producto bloqueado por moderación
                          </div>
                        )}
                        {/* Reportar: solo si está activo y no es peligroso */}
                        {producto.moderationStatus === 'active' && !producto.es_peligroso && (
                          <button
                            onClick={() => marcarComoPeligroso(producto)}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition"
                          >
                            <FiAlertTriangle className="inline mr-2" />
                            Reportar
                          </button>
                        )}
                        {producto.es_peligroso && (
                          <button
                            onClick={() => revertirPeligroso(producto)}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition"
                          >
                            <MdVerified className="inline mr-2" />
                            Revertir Marca Peligroso
                          </button>
                        )}
                        {/* Datos API button removed as requested */}
                      </div>
                    </div>
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
        onClose={() => setModalData({ ...modalData, isOpen: false })}
        onConfirm={modalData.onConfirm}
        confirmText={modalData.confirmText || 'Confirmar'}
        cancelText={modalData.cancelText}
        onCancel={() => setModalData({ ...modalData, isOpen: false })}
      />

      {/* Datos API modal removed as requested */}
    </div>
  );
}

export default GestionProductosPage;

