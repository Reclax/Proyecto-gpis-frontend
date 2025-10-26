import { useState, useEffect } from 'react';
import { authAPI, favoriteAPI, productAPI, API_BASE_URL } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';
import { FiHeart, FiTrash2, FiMapPin, FiEye, FiShoppingBag, FiLoader } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { MdVerified } from 'react-icons/md';
import Modal from '../components/common/Modal';

function FavoritosPage() {
  const [favoritos, setFavoritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalData, setModalData] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });
  const navigate = useNavigate();

  // Función para obtener favoritos del backend
  const fetchFavoritos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const favoritesData = await favoriteAPI.getUserFavorites();
      
      // Mapear los datos del backend al formato esperado por el componente
      const mappedFavoritos = await Promise.all(favoritesData.map(async (favorite) => {
        
        const product = favorite.Product || {};
        const seller = product.User || {};
        
        
        // Obtener las fotos del producto desde /products/:id ya que /favorites no las incluye
        let imageUrl = null;
        try {
          const fullProductData = await productAPI.getProductById(product.id);
          
          // Obtener la primera imagen del producto
          if (fullProductData.ProductPhotos && Array.isArray(fullProductData.ProductPhotos) && fullProductData.ProductPhotos.length > 0) {
            const sortedPhotos = fullProductData.ProductPhotos.sort((a, b) => (a.position || 0) - (b.position || 0));
            const firstPhoto = sortedPhotos[0];
            
            // Try both 'photo' and 'url' fields
            const photoFileName = firstPhoto.photo || firstPhoto.url;
            if (photoFileName) {
              imageUrl = photoFileName.startsWith('http') 
                ? photoFileName 
                : `${API_BASE_URL}${photoFileName.startsWith('/') ? '' : '/'}${photoFileName}`;
            }
          }
        } catch {
          // Error fetching product details for ID
        }
        
        const mappedProduct = {
          id: product.id,
          titulo: product.title || 'Producto sin título',
          precio: product.price || 0,
          imagen: imageUrl,
          ubicacion: product.location || 'Ubicación no especificada',
          vendedor: seller.name && seller.lastname ? 
            `${seller.name} ${seller.lastname}`.trim() : 
            seller.name || 'Vendedor desconocido',
          sellerId: seller.id,
          fechaGuardado: favorite.createdAt || new Date().toISOString(),
          status: product.status || 'active',
          isImageUrl: !!imageUrl
        };
        
        return mappedProduct;
      }));
      
      setFavoritos(mappedFavoritos);
     
      
    } catch (error) {
      console.error('Error loading favorites:', error);
      setError('Error al cargar favoritos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authAPI.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchFavoritos();
  }, [navigate]);

  // Función para eliminar un favorito específico
  const eliminarFavorito = async (productId, titulo) => {
    setModalData({
      isOpen: true,
      type: 'confirm',
      title: 'Quitar de Favoritos',
      message: `¿Estás seguro de que quieres quitar "${titulo}" de tus favoritos?`,
      onConfirm: async () => {
        try {
          await favoriteAPI.removeFavorite(productId);
          
          // Actualizar estado local
          setFavoritos(prev => prev.filter(fav => fav.id !== productId));
          
          // Mostrar mensaje de éxito
          setModalData({
            isOpen: true,
            type: 'success',
            title: 'Favorito Eliminado',
            message: 'El producto ha sido eliminado de tus favoritos exitosamente.',
            confirmText: 'Entendido'
          });
          
        } catch {
          // Error removing favorite
          setModalData({
            isOpen: true,
            type: 'error',
            title: 'Error',
            message: 'Error al eliminar favorito. Inténtalo de nuevo.',
            confirmText: 'Entendido'
          });
        }
      },
      confirmText: 'Quitar',
      cancelText: 'Cancelar'
    });
  };

  // Función para eliminar todos los favoritos
  const eliminarTodos = async () => {
    setModalData({
      isOpen: true,
      type: 'warning',
      title: 'Eliminar Todos los Favoritos',
      message: `¿Estás seguro de que quieres eliminar todos los ${favoritos.length} favoritos? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        try {
          // Eliminar uno por uno ya que no hay endpoint para eliminar todos
          const deletePromises = favoritos.map(fav => favoriteAPI.removeFavorite(fav.id));
          await Promise.all(deletePromises);
          
          setFavoritos([]);
          
          // Mostrar mensaje de éxito
          setModalData({
            isOpen: true,
            type: 'success',
            title: 'Favoritos Eliminados',
            message: 'Todos los favoritos han sido eliminados exitosamente.',
            confirmText: 'Entendido'
          });
          
        } catch {
          // Error removing all favorites
          setModalData({
            isOpen: true,
            type: 'error',
            title: 'Error',
            message: 'Error al eliminar favoritos. Inténtalo de nuevo.',
            confirmText: 'Entendido'
          });
          // Recargar para sincronizar estado
          fetchFavoritos();
        }
      },
      confirmText: 'Eliminar Todos',
      cancelText: 'Cancelar'
    });
  };

  // Componente de loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="sb-container">
          <div className="text-center py-12">
            <FiLoader className="animate-spin text-4xl text-orange-600 mx-auto mb-4" />
            <p className="text-gray-600">Cargando tus favoritos...</p>
          </div>
        </div>
      </div>
    );
  }

  // Componente de error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="sb-container">
          <div className="text-center py-12">
            <FiHeart className="text-4xl text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Error al cargar favoritos</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchFavoritos}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="sb-container">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Mis Favoritos</h1>
            <p className="text-gray-600 mt-1">
              {favoritos.length > 0
                ? `${favoritos.length} producto${favoritos.length > 1 ? 's' : ''} guardado${favoritos.length > 1 ? 's' : ''}`
                : 'No tienes favoritos guardados'}
            </p>
          </div>
          {favoritos.length > 0 && (
            <button
              onClick={eliminarTodos}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-semibold flex items-center gap-2 border border-red-200"
            >
              <FiTrash2 />
              Eliminar todos
            </button>
          )}
        </div>

        {favoritos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favoritos.map((producto) => (
              <div key={producto.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all group">
                {/* Imagen del producto */}
                <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-8xl">
                  {producto.isImageUrl && producto.imagen ? (
                    <img 
                      src={producto.imagen} 
                      alt={producto.titulo}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                       
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'block';
                      }}
                    />
                  ) : null}
                  
                  {/* Fallback cuando no hay imagen o falla la carga */}
                  <span 
                    className={`text-gray-400 text-6xl ${producto.isImageUrl && producto.imagen ? 'hidden' : 'block'}`}
                  >
                    📦
                  </span>
                  
                  {/* Badges de estado */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {producto.status === 'active' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                        <HiSparkles className="text-xs" />
                        Activo
                      </span>
                    )}
                    {producto.sellerId && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                        <MdVerified className="text-xs" />
                        Verificado
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => eliminarFavorito(producto.id, producto.titulo)}
                    className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-red-50 transition-colors group"
                    title="Quitar de favoritos"
                  >
                    <FiHeart className="w-4 h-4 text-red-500 fill-red-500 group-hover:scale-110 transition-transform" />
                  </button>
                </div>

                {/* Información del producto */}
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 min-h-[3.5rem]">
                    {producto.titulo}
                  </h3>
                  <p className="font-bold text-2xl mb-3" style={{ color: '#CF5C36' }}>
                    ${producto.precio}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <FiMapPin className="flex-shrink-0" style={{ color: '#CF5C36' }} />
                    <span className="truncate">{producto.ubicacion}</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">
                    Vendido por: <span className="font-semibold">{producto.vendedor}</span>
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Guardado el {new Date(producto.fechaGuardado).toLocaleDateString('es-EC', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>

                  <div className="flex gap-2">
                    <Link
                      to={`/producto/${producto.id}`}
                      className="flex-1 py-2 text-white rounded-lg hover:opacity-90 transition-colors font-semibold text-center flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#CF5C36' }}
                    >
                      <FiEye />
                      Ver Producto
                    </Link>
                    <button
                      onClick={() => eliminarFavorito(producto.id, producto.titulo)}
                      className="px-4 py-2 border-2 border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                      title="Eliminar de favoritos"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FiHeart className="mx-auto text-6xl text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No tienes favoritos guardados</h3>
            <p className="text-gray-600 mb-6">Explora productos y guarda los que te interesen</p>
            <Link
              to="/productos"
              className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-lg hover:opacity-90 transition-colors font-semibold"
              style={{ backgroundColor: '#CF5C36' }}
            >
              <FiShoppingBag />
              Explorar productos
            </Link>
          </div>
        )}
      </div>

      {/* Modal para notificaciones */}
      <Modal
        isOpen={modalData.isOpen}
        onClose={() => setModalData({ ...modalData, isOpen: false })}
        type={modalData.type}
        title={modalData.title}
        message={modalData.message}
        onConfirm={modalData.onConfirm}
        confirmText={modalData.confirmText}
        cancelText={modalData.cancelText}
      />
    </div>
  );
}

export default FavoritosPage;
