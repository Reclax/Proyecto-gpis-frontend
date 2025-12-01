import { useState, useEffect } from 'react';
import Modal from '../components/common/Modal';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiMapPin, 
  FiChevronLeft, 
  FiMessageCircle, 
  FiHeart, 
  FiShare2,
  FiAlertTriangle
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { MdVerified } from 'react-icons/md';
import { 
  productAPI, 
  categoryAPI, 
  userAPI, 
  conversationAPI, 
  authAPI, 
  favoriteAPI,
  API_BASE_URL
} from '../services/api';
import { normalizeRole, ROLES } from '../config/roles';
import ReportProductModal from '../components/ReportProductModal';

// Componente para mostrar detalles del producto con funcionalidad de favoritos
function ProductoDetallePage() {
  // Estado para modal de compartir
  const [shareModal, setShareModal] = useState(false);
  // Estado para modal de reportar producto
  const [reportModalOpen, setReportModalOpen] = useState(false);
  // Función para copiar la URL al portapapeles y mostrar modal
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareModal(true);
      setTimeout(() => setShareModal(false), 1500);
    } catch (err) {
      alert('No se pudo copiar la URL', err);
    }
  };
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contactingVendor, setContactingVendor] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const productData = await productAPI.getProductById(id);
        // Comprobar visibilidad según estado de moderación
        try {
          const moderationStatus = productData.moderationStatus || 'active';
          const currentUser = authAPI.getUserData();
          const userRole = currentUser ? normalizeRole(
            (Array.isArray(currentUser.roles) && currentUser.roles[0]) || currentUser.role || null
          ) : null;
          const isOwner = currentUser && currentUser.id === productData.sellerId;
          const isPrivileged = userRole === ROLES.ADMIN || userRole === ROLES.MODERADOR || isOwner;
          if (moderationStatus !== 'active' && !isPrivileged) {
            setError('Este producto no está disponible.');
            setLoading(false);
            return;
          }
        } catch {
          // Ignorar errores de verificación de moderación
        }
        
        // Obtener información de categoría usando categoryId
        let categoryInfo = 'Sin categoría';
        let subcategoryInfo = '';
        
        if (productData.categoryId) {
          try {
            // Obtener todas las categorías para encontrar la correcta
            const allCategories = await categoryAPI.getAll();
            const productCategory = allCategories.find(cat => String(cat.id) === String(productData.categoryId));
            
            if (productCategory) {
              if (productCategory.parentCategoryId) {
                // Es una subcategoría
                subcategoryInfo = productCategory.name;
                const parentCategory = allCategories.find(cat => String(cat.id) === String(productCategory.parentCategoryId));
                categoryInfo = parentCategory ? parentCategory.name : 'Sin categoría';
              } else {
                // Es una categoría principal
                categoryInfo = productCategory.name;
              }
            }
          } catch {
            // Error obteniendo categorías
          }
        }
        
        // Obtener información del vendedor usando sellerId
        let sellerInfo = {
          name: 'Usuario desconocido',
          memberSince: 'Miembro nuevo',
          avatar: null
        };
        
        if (productData.sellerId) {
          try {
            const sellerData = await userAPI.getUserById(productData.sellerId);
            sellerInfo = {
              name: `${sellerData.name}${sellerData.lastname ? ' ' + sellerData.lastname : ''}`.trim(),
              memberSince: sellerData.createdAt ? 
                `Miembro desde ${new Date(sellerData.createdAt).getFullYear()}` : 'Miembro nuevo',
              avatar: sellerData.avatarUrl ? 
                (sellerData.avatarUrl.startsWith('http') ? sellerData.avatarUrl : `${API_BASE_URL}${sellerData.avatarUrl}`) : null,
              rating: typeof sellerData.rating === 'number' ? sellerData.rating : (parseFloat(sellerData.rating) || 0),
              ratingCount: sellerData.ratingCount || 0
            };
          } catch {
            // Error obteniendo datos del vendedor
          }
        }
        
        // Mapear datos del backend al formato esperado por el componente
        const mappedProduct = {
          id: productData.id,
          sellerId: productData.sellerId, // Asegura que sellerId esté presente
          title: productData.title,
          price: productData.price,
          description: productData.description || 'Sin descripción disponible',
          location: productData.location || 'Ubicación no especificada',
          category: categoryInfo,
          subcategory: subcategoryInfo,
          condition: productData.status === 'active' ? 'Activo' : 
                    productData.status === 'sold' ? 'Vendido' : 
                    productData.status === 'reserved' ? 'Reservado' : 'Inactivo',
          images: productData.ProductPhotos && productData.ProductPhotos.length > 0 
            ? productData.ProductPhotos.map(photo => 
                photo.url.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`
              )
            : ['📦'], // Emoji por defecto si no hay imágenes
          seller: sellerInfo,
          moderationStatus: productData.moderationStatus || 'active'
        };
        
        setProduct(mappedProduct);

        // Verificar si el producto está en favoritos (solo si el usuario está autenticado)
        if (authAPI.isAuthenticated()) {
          try {
            const isFav = await favoriteAPI.isFavorite(id);
            setIsFavorite(isFav);
          } catch {
            // Error verificando favorito
          }
        }
      } catch  {
  // Error cargando producto
        setError('Error al cargar el producto');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id]);

  // Función para contactar al vendedor
  const handleContactVendor = async () => {
    try {
      // Verificar si el usuario está autenticado
      if (!authAPI.isAuthenticated()) {
        navigate('/login');
        return;
      }

      // Verificar que el usuario no sea el mismo vendedor
      const currentUser = authAPI.getUserData();
      if (currentUser?.id === product?.sellerId) {
        alert('No puedes contactarte a ti mismo');
        return;
      }

      setContactingVendor(true);

      // Primero, verificar si ya existe una conversación para este producto
      try {
        const myConversations = await conversationAPI.getMyConversations();
        const existingConversation = myConversations.find(conv => 
          conv.productId === product.id && 
          (conv.buyerId === currentUser.id || conv.sellerId === currentUser.id)
        );

        if (existingConversation) {
          // Ya existe una conversación, redirigir a ella
          navigate(`/chat/${existingConversation.id}`);
          return;
        }
      } catch {
  // Error verificando conversaciones existentes
      }

      // Si no existe conversación, crear una nueva
      try {
        const newConversation = await conversationAPI.createConversation(product.id, product.sellerId);
        navigate(`/chat/${newConversation.id}`);
      } catch {
  // Error creando conversación
        // Como fallback, ir al chat general donde se podrán ver las conversaciones
        navigate('/chat');
      }

    } catch {
  // Error al contactar vendedor
      alert('Error al iniciar conversación. Inténtalo de nuevo.');
    } finally {
      setContactingVendor(false);
    }
  };


  // Función para manejar favoritos
  const handleToggleFavorite = async () => {
    try {
      // Verificar si el usuario está autenticado
      if (!authAPI.isAuthenticated()) {
        navigate('/login');
        return;
      }

      setFavoriteLoading(true);

      const productId = parseInt(id);
  // Toggling favorite for product

      if (isFavorite) {
        // Quitar de favoritos
  // Removing from favorites
        await favoriteAPI.removeFavorite(productId);
        setIsFavorite(false);
          // Removed successfully
      } else {
        // Agregar a favoritos  
  // Adding to favorites
        await favoriteAPI.addFavorite(productId);
        setIsFavorite(true);
          // Added successfully
      }
    } catch (error) {
  // Error al manejar favorito
  // Error response: error.response?.data
      
      // Manejar casos específicos
      if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.message || '';
        
        if (errorMsg.includes('ya está en favoritos') || errorMsg.includes('already')) {
          // El producto ya está en favoritos, actualizar estado local
          // Product already in favorites, updating local state
          setIsFavorite(true);
          return;
        }
        
        if (errorMsg.includes('no encontrado') || errorMsg.includes('not found')) {
          alert('Favorito no encontrado');
          return;
        }
      }
      
      // Mostrar mensaje más específico
      const errorMessage = error.response?.data?.message || 'Error al actualizar favoritos. Inténtalo de nuevo.';
      alert(errorMessage);
    } finally {
      setFavoriteLoading(false);
    }
  };

  // Estados de loading y error
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EEE5E9' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando producto...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EEE5E9' }}>
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar el producto</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EEE5E9' }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Producto no encontrado</h2>
          <p className="text-gray-600 mb-6">El producto que buscas no existe o ha sido eliminado</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EEE5E9' }}>
      {/* Contenido Principal */}
      <section className="py-8">
        <div className="sb-container">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 font-semibold"
          >
            <FiChevronLeft />
            Volver
          </button>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Columna Izquierda - Imágenes */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl p-6 shadow-lg mb-6">
                {/* Imagen Principal */}
                <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center mb-4 overflow-hidden">
                  {product.images[selectedImage].startsWith('http') ? (
                    <img 
                      src={product.images[selectedImage]} 
                      alt={product.title}
                      className="w-full h-full object-cover rounded-2xl"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <div className="text-9xl">
                      {product.images[selectedImage]}
                    </div>
                  )}
                  <div className="w-full h-full items-center justify-center text-9xl hidden">
                    📦
                  </div>
                </div>

                {/* Miniaturas */}
                <div className="grid grid-cols-4 gap-3">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`aspect-square bg-gray-100 rounded-xl flex items-center justify-center transition-all overflow-hidden ${
                        selectedImage === idx ? 'ring-4 ring-orange-500' : 'hover:ring-2 ring-gray-300'
                      }`}
                    >
                      {img.startsWith('http') ? (
                        <img 
                          src={img} 
                          alt={`${product.title} ${idx + 1}`}
                          className="w-full h-full object-cover rounded-xl"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <div className="text-4xl">
                          {img}
                        </div>
                      )}
                      <div className="w-full h-full items-center justify-center text-4xl hidden">
                        📦
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div className="bg-white rounded-3xl p-8 shadow-lg">
                <h2 className="text-2xl font-black text-gray-900 mb-4">Descripción</h2>
                <div className="bg-gray-50 rounded-2xl p-4 border-2 border-gray-200 max-h-64 overflow-y-auto">
                  <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                    {product.description}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-8 pt-8 border-t">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Categoría</p>
                    <p className="font-semibold">
                      {product.category}
                      {product.subcategory && (
                        <span className="text-gray-600"> → {product.subcategory}</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Estado</p>
                    <p className="font-semibold">{product.condition}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha - Info y Acciones */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl p-8 shadow-lg">
                {/* Estado del producto */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full ${
                    product.condition === 'Activo' ? 'bg-green-500 text-white' :
                    product.condition === 'Vendido' ? 'bg-gray-500 text-white' :
                    product.condition === 'Reservado' ? 'bg-yellow-500 text-white' :
                    'bg-red-500 text-white'
                  }`}>
                    {product.condition}
                  </span>
                </div>

                {/* Título y Precio */}
                <h1 className="text-3xl font-black text-gray-900 mb-4">
                  {product.title}
                </h1>
                <p className="text-5xl font-black mb-6" style={{ color: '#CF5C36' }}>
                  ${product.price}
                </p>

                {/* Ubicación */}
                <div className="mb-6 pb-6 border-b">
                  <div className="flex items-center gap-2 text-gray-600">
                    <FiMapPin className="text-xl" />
                    <span>{product.location}</span>
                  </div>
                </div>

                {/* Botón de Acción */}
                <div className="space-y-3 mb-6">
                  {(() => {
                    const currentUser = authAPI.getUserData();
                    const isAuthenticated = authAPI.isAuthenticated();
                    const isOwnProduct = isAuthenticated && currentUser?.id === product?.sellerId;

                    // Extraer y normalizar el rol del usuario autenticado (puede venir como string u objeto)
                    const extractRoleFromUser = (user) => {
                      if (!user) return null;
                      try {
                        if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
                          const r = user.roles[0];
                          if (typeof r === 'string') return normalizeRole(r);
                          if (r && typeof r === 'object') return normalizeRole(r.roleName || r.role || r.name || '');
                        }

                        // Intentar leer desde el token como fallback
                        if (authAPI.isAuthenticated()) {
                          const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
                          if (token) {
                            const payload = JSON.parse(atob(token.split('.')[1]));
                            const pr = payload.roles?.[0];
                            if (typeof pr === 'string') return normalizeRole(pr);
                            if (pr && typeof pr === 'object') return normalizeRole(pr.roleName || pr.role || pr.name || '');
                          }
                        }
                      } catch {
                        // ignore
                      }

                      return normalizeRole(user.role || null);
                    };

                    const currentUserRole = isAuthenticated ? extractRoleFromUser(currentUser) : null;

                    // Si el usuario está autenticado y es el propietario
                    if (isOwnProduct) {
                      return (
                        <div className="w-full py-4 bg-gray-100 text-gray-500 font-bold rounded-xl flex items-center justify-center gap-2 border-2 border-dashed border-gray-300">
                          <FiMessageCircle className="text-xl" />
                          Eres el propietario del producto
                        </div>
                      );
                    }

                    // Si el usuario no está autenticado
                    if (!isAuthenticated) {
                      return (
                        <button
                          onClick={() => navigate('/login')}
                          className="w-full py-4 text-white font-bold rounded-xl transition-all hover:opacity-90 shadow-lg flex items-center justify-center gap-2"
                          style={{ backgroundColor: '#CF5C36' }}
                        >
                          <FiMessageCircle className="text-xl" />
                          Iniciar sesión para contactar
                        </button>
                      );
                    }

                    // Si el usuario está autenticado y pertenece a rol Admin o Moderador, no puede comprar/contactar
                    if (currentUserRole === ROLES.ADMIN || currentUserRole === ROLES.MODERADOR) {
                      return (
                        <div className="w-full py-4 bg-gray-100 text-gray-500 font-bold rounded-xl flex items-center justify-center gap-2 border-2 border-dashed border-gray-300">
                          {`No Autorizado para contactar`}
                        </div>
                      );
                    }

                    // Si el usuario está autenticado y el producto no es suyo
                    return (
                      <>
                        <button
                          onClick={handleContactVendor}
                          disabled={contactingVendor}
                          className={`w-full py-4 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                            contactingVendor
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:opacity-90'
                          }`}
                          style={{ backgroundColor: '#CF5C36' }}
                        >
                          <FiMessageCircle
                            className={`text-xl ${
                              contactingVendor ? 'animate-pulse' : ''
                            }`}
                          />
                          {contactingVendor ? 'Iniciando chat...' : 'Contactar vendedor'}
                        </button>

                        <div className="flex gap-3">
                          <button
                            onClick={handleToggleFavorite}
                            disabled={favoriteLoading}
                            className={`flex-1 py-3 border-2 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                              isFavorite
                                ? 'border-red-500 text-red-500 bg-red-50'
                                : 'border-gray-300 text-gray-700 hover:border-gray-400'
                            } ${favoriteLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <FiHeart className={`${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'} ${favoriteLoading ? 'animate-pulse' : ''} transition-colors`} />
                            {favoriteLoading ? 'Actualizando...' : (isFavorite ? 'Guardado' : 'Guardar')}
                          </button>

                          <button
                            type="button"
                            onClick={handleShare}
                            className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-gray-400 transition-all flex items-center justify-center gap-2"
                          >
                            <FiShare2 />
                            Compartir
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!authAPI.isAuthenticated()) {
                                navigate('/login');
                                return;
                              }
                              setReportModalOpen(true);
                            }}
                            className="flex-1 py-3 border-2 border-red-300 text-red-600 rounded-xl font-semibold hover:bg-red-50 hover:border-red-400 transition-all flex items-center justify-center gap-2"
                          >
                            <FiAlertTriangle />
                            Reportar
                          </button>
      {/* Modal de URL copiada */}
      <Modal
        isOpen={shareModal}
        onClose={() => setShareModal(false)}
        type="info"
        title="URL copiada"
        message="El enlace del producto ha sido copiado al portapapeles."
        hideCloseButton
        centered
      />
      {/* Modal de Reporte de Producto */}
      <ReportProductModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        productId={product.id}
        productTitle={product.title}
      />
                        </div>
                      </>
                    );
                  })()}
                </div>


                {/* Info del Vendedor */}
                <div className="pt-6 border-t">
                  <p className="text-sm text-gray-500 mb-3">Vendedor</p>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold overflow-hidden">
                      {product.seller.avatar ? (
                        <img 
                          src={product.seller.avatar}
                          alt={product.seller.name}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <span className="text-white font-bold">
                          {product.seller.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="w-full h-full items-center justify-center text-white font-bold hidden">
                        {product.seller.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">
                        {product.seller.name}
                      </p>
                      <p className="text-sm text-gray-500">{product.seller.memberSince}</p>
                      {typeof product.seller.rating !== 'undefined' && (
                        <p className="text-sm text-gray-700 mt-1">
                          ⭐ {Number(product.seller.rating).toFixed(1)} ({product.seller.ratingCount || 0})
                        </p>
                      )}
                    </div>
                  </div>
                  
                </div>
              </div>

              {/* Consejos de Seguridad - Tarjeta separada */}
              <div className="bg-yellow-50 rounded-3xl p-6 shadow-lg mt-6">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  🔒 Consejos de seguridad
                </h3>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• Verifica el producto antes de pagar</li>
                  <li>• Reúnete en lugares públicos</li>
                  <li>• No transfieras dinero sin ver el producto</li>
                  <li>• Desconfía de precios muy bajos</li>
                </ul>
              </div>
            </div>
          </div>


        </div>
      </section>
    </div>
  );
}

export default ProductoDetallePage;
