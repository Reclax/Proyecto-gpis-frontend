import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiEye, FiAlertTriangle, FiCheck, FiX, FiClock, FiPackage, FiChevronDown } from 'react-icons/fi';
import { MdBlock, MdVerified } from 'react-icons/md';
import usePageTitle from '../hooks/usePageTitle';
import Modal from '../components/common/Modal';
import { checkAdminAccess } from '../utils/rolePermissions';

// Datos demo de productos
const productosDemo = [
  {
    id: 1,
    codigo: 'PROD-001',
    titulo: 'iPhone 13 Pro Max',
    descripcion: 'En perfecto estado, batería al 95%',
    precio: 850,
    ubicacion: 'Quito, Ecuador',
    tipo: 'producto',
    estado: 'activo',
    condicion: 'activo',
    fecha_publicacion: '2025-01-20T10:00:00',
    vendedor: 'Juan Pérez',
    vendedor_id: 1,
    categoria: 'Electrónica',
    es_peligroso: false,
    reportes: 0,
    foto: '/uploads/products/iphone.jpg'
  },
  {
    id: 2,
    codigo: 'PROD-002',
    titulo: 'Cuchillo táctico militar',
    descripcion: 'Cuchillo de supervivencia profesional',
    precio: 45,
    ubicacion: 'Guayaquil, Ecuador',
    tipo: 'producto',
    estado: 'suspendido',
    condicion: 'activo',
    fecha_publicacion: '2025-01-22T15:30:00',
    vendedor: 'Carlos Ramírez',
    vendedor_id: 3,
    categoria: 'Deportes',
    es_peligroso: true,
    razon_suspension: 'Detectado como producto potencialmente peligroso',
    fecha_suspension: '2025-01-23T10:00:00',
    reportes: 2,
    foto: '/uploads/products/cuchillo.jpg'
  },
  {
    id: 3,
    codigo: 'PROD-003',
    titulo: 'Servicio de Plomería',
    descripcion: 'Reparación e instalación de tuberías profesional',
    precio: 25,
    ubicacion: 'Cuenca, Ecuador',
    tipo: 'servicio',
    estado: 'activo',
    condicion: 'activo',
    fecha_publicacion: '2025-01-15T08:00:00',
    vendedor: 'María González',
    vendedor_id: 2,
    categoria: 'Servicios',
    es_peligroso: false,
    horario_atencion: 'Lunes a Viernes 8:00 - 18:00',
    reportes: 0
  },
  {
    id: 4,
    codigo: 'PROD-004',
    titulo: 'Laptop HP Pavilion',
    descripcion: 'Intel i5, 8GB RAM, 256GB SSD, Pantalla 15.6"',
    precio: 450,
    ubicacion: 'Loja, Ecuador',
    tipo: 'producto',
    estado: 'pendiente',
    condicion: 'activo',
    fecha_publicacion: '2025-01-24T12:00:00',
    vendedor: 'Ana Torres',
    vendedor_id: 4,
    categoria: 'Electrónica',
    es_peligroso: false,
    reportes: 0,
    foto: '/uploads/products/laptop.jpg'
  },
  {
    id: 5,
    codigo: 'PROD-005',
    titulo: 'Pistola de aire comprimido',
    descripcion: 'Arma de juguete para práctica de tiro',
    precio: 65,
    ubicacion: 'Ambato, Ecuador',
    tipo: 'producto',
    estado: 'suspendido',
    condicion: 'activo',
    fecha_publicacion: '2025-01-19T14:20:00',
    vendedor: 'Roberto Gómez',
    vendedor_id: 5,
    categoria: 'Deportes',
    es_peligroso: true,
    razon_suspension: 'Producto clasificado como arma de fuego simulada - prohibido',
    fecha_suspension: '2025-01-21T09:00:00',
    reportes: 5,
    foto: '/uploads/products/gun.jpg'
  }
];

function GestionProductosPage() {
  usePageTitle('Gestión de Productos');
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState(productosDemo);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [modalData, setModalData] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

  useEffect(() => {
    // Verificar acceso a gestión de productos
    const access = checkAdminAccess('gestionar_productos_admin');

    if (!access.isAllowed) {
      navigate(access.redirectPath || '/');
      return;
    }

    setIsAuthorized(true);
    setLoading(false);
  }, [navigate]);

  // Filtrar productos
  const productosFiltrados = productos.filter(prod => {
    const matchSearch =
      prod.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.vendedor.toLowerCase().includes(searchTerm.toLowerCase());

    const matchEstado = filterEstado === 'todos' || prod.estado === filterEstado;
    const matchTipo = filterTipo === 'todos' || prod.tipo === filterTipo;

    return matchSearch && matchEstado && matchTipo;
  });

  // Cambiar estado del producto
  const cambiarEstadoProducto = (producto, nuevoEstado) => {
    const accion = nuevoEstado === 'activo' ? 'activar' : 'suspender';
    setModalData({
      isOpen: true,
      type: 'confirm',
      title: `${accion === 'activar' ? 'Activar' : 'Suspender'} Producto`,
      message: `¿Estás seguro de ${accion} el producto "${producto.titulo}"?${accion === 'suspender' ? '\n\nEsta acción ocultará el producto de la plataforma.' : ''}`,
      onConfirm: () => {
        setProductos(prev =>
          prev.map(p => p.id === producto.id ? { ...p, estado: nuevoEstado, fecha_suspension: nuevoEstado === 'suspendido' ? new Date().toISOString() : null } : p)
        );
        setModalData({
          isOpen: true,
          type: 'success',
          title: 'Producto Actualizado',
          message: `El producto ha sido ${accion === 'activar' ? 'activado' : 'suspendido'} correctamente`,
          confirmText: 'Entendido'
        });
        setSelectedProduct(null);
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
      title: 'Marcar como Peligroso',
      message: `¿Estás seguro de marcar "${producto.titulo}" como producto peligroso?\n\nEsto:\n- Suspenderá automáticamente el producto\n- Lo ocultará de todos los usuarios\n- Notificará al vendedor\n- Permitirá una apelación`,
      onConfirm: () => {
        setProductos(prev =>
          prev.map(p => p.id === producto.id ? {
            ...p,
            es_peligroso: true,
            estado: 'suspendido',
            fecha_suspension: new Date().toISOString(),
            razon_suspension: 'Detectado como producto potencialmente peligroso'
          } : p)
        );
        setModalData({
          isOpen: true,
          type: 'success',
          title: 'Producto Marcado',
          message: 'El producto ha sido marcado como peligroso y suspendido automáticamente. El vendedor ha sido notificado.',
          confirmText: 'Entendido'
        });
        setSelectedProduct(null);
      },
      confirmText: 'Marcar como Peligroso',
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
      onConfirm: () => {
        setProductos(prev =>
          prev.map(p => p.id === producto.id ? {
            ...p,
            es_peligroso: false,
            estado: 'activo',
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
        setSelectedProduct(null);
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-6 border-t border-gray-200">
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
                  onClick={() => setExpandedId(expandedId === producto.id ? null : producto.id)}
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
                        <span>Vendedor: <span className="font-bold text-gray-900">{producto.vendedor}</span></span>
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
                        {producto.estado === 'activo' && (
                          <button
                            onClick={() => cambiarEstadoProducto(producto, 'suspendido')}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition"
                          >
                            <MdBlock className="inline mr-2" />
                            Suspender
                          </button>
                        )}
                        {producto.estado === 'suspendido' && !producto.es_peligroso && (
                          <button
                            onClick={() => cambiarEstadoProducto(producto, 'activo')}
                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition"
                          >
                            <FiCheck className="inline mr-2" />
                            Activar
                          </button>
                        )}
                        {!producto.es_peligroso && producto.estado !== 'suspendido' && (
                          <button
                            onClick={() => marcarComoPeligroso(producto)}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition"
                          >
                            <FiAlertTriangle className="inline mr-2" />
                            Marcar como Peligroso
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
        onConfirm={modalData.onConfirm}
        confirmText={modalData.confirmText || 'Confirmar'}
        cancelText={modalData.cancelText}
        onCancel={() => setModalData({ ...modalData, isOpen: false })}
      />
    </div>
  );
}

export default GestionProductosPage;

