import axios from 'axios';
import Cookies from 'js-cookie';

// URL base del backend - Lee desde variable de entorno o usa localhost como fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
export { API_BASE_URL };

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 segundos de timeout (aumentado para manejar imágenes)
});

// Funciones utilitarias para manejo seguro de cookies
// Duración de sesión en milisegundos (30 minutos)
const SESSION_DURATION_MS = 30 * 60 * 1000;

const cookieUtils = {
  // Genera una fecha de expiración a 30 minutos desde 'ahora'
  _expiryDate: () => new Date(Date.now() + SESSION_DURATION_MS),

  setAuthToken: (token) => {
    Cookies.set('authToken', token, { 
      expires: cookieUtils._expiryDate(), // Expira en 30 minutos
      secure: window.location.protocol === 'https:',
      sameSite: 'strict',
      httpOnly: false
    });
  },
  
  getAuthToken: () => Cookies.get('authToken'),
  
  removeAuthToken: () => Cookies.remove('authToken'),
  
  setUserData: (userData) => {
    Cookies.set('userData', JSON.stringify(userData), {
      expires: cookieUtils._expiryDate(), // Alinear expiración con el token
      secure: window.location.protocol === 'https:',
      sameSite: 'strict'
    });
    
    // Disparar evento personalizado para notificar cambios en datos de usuario
    window.dispatchEvent(new CustomEvent('userDataUpdated', { detail: userData }));
  },
  
  getUserData: () => {
    const userData = Cookies.get('userData');
    return userData ? JSON.parse(userData) : null;
  },
  
  removeUserData: () => Cookies.remove('userData'),

  // Refresca la expiración (sliding session)
  refreshSession: () => {
    const token = Cookies.get('authToken');
    if (token) {
      cookieUtils.setAuthToken(token);
    }
    const userData = Cookies.get('userData');
    if (userData) {
      cookieUtils.setUserData(JSON.parse(userData));
    }
  }
};

// Interceptor para agregar token de autenticación automáticamente
api.interceptors.request.use(
  (config) => {
    const token = cookieUtils.getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // Renovar expiración en cada request (sliding expiration)
      cookieUtils.refreshSession();
    }
    
    // Establecer Content-Type solo si no es FormData
    if (!config.data || !(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar respuestas y errores
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido - limpiar datos de sesión
      cookieUtils.removeAuthToken();
      cookieUtils.removeUserData();
      
      // Solo redirigir al login si estamos en páginas que requieren autenticación
      const currentPath = window.location.pathname;
      const protectedPaths = ['/vender', '/mi-perfil', '/mis-productos', '/notificaciones', '/favoritos', '/chat'];
      
      if (protectedPaths.some(path => currentPath.startsWith(path))) {
        window.location.href = '/login';
      }
      
      // Para otras páginas, simplemente propagamos el error sin redirigir
    }
    return Promise.reject(error);
  }
);

// Funciones para autenticación
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/users/login', {
      email,
      password
    });
    return response.data;
  },
  
  // Solicitar recuperación de contraseña
  requestPasswordReset: async (email) => {
    const response = await api.post('/users/request-password-reset', { email });
    return response.data;
  },

  register: async (formData) => {
    const response = await api.post('/users/register', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  logout: () => {
    // Notificar al WebSocket que el usuario está cerrando sesión
    try {
      import('./websocket').then(({ default: webSocketService }) => {
        if (webSocketService.isConnected()) {
          // Notificando logout al WebSocket...
          webSocketService.send('userLogout', { reason: 'manual_logout' });
          // Dar tiempo para que se envíe el mensaje antes de desconectar
          setTimeout(() => {
            webSocketService.disconnect();
          }, 500);
        }
      });
    } catch {
      // No se pudo notificar logout al WebSocket
    }
    
    cookieUtils.removeAuthToken();
    cookieUtils.removeUserData();
  },

  // Función auxiliar para guardar token en cookie después del login
  saveAuthData: (token, userData) => {
    cookieUtils.setAuthToken(token);
    if (userData) {
      cookieUtils.setUserData(userData);
    }
  },

  // Función auxiliar para obtener datos del usuario desde cookie
  getUserData: () => {
    return cookieUtils.getUserData();
  },

  // Función auxiliar para verificar si el usuario está logueado
  isAuthenticated: () => {
    return !!cookieUtils.getAuthToken();
  },

  // Función auxiliar para obtener el token de autenticación
  getAuthToken: () => {
    return cookieUtils.getAuthToken();
  }
};

// Funciones para usuarios
export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  whoAmI: async () => {
    const response = await api.get('/users/whoami');
    return response.data;
  },

  getUserById: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  updateProfile: async (userId, userData) => {
    const response = await api.put(`/users/${userId}`, userData);
    
    // Actualizar datos del usuario en las cookies después de una actualización exitosa
    if (response.data && response.data.user) {
      const currentUserData = cookieUtils.getUserData() || {};
      const updatedUserData = {
        ...currentUserData,
        ...response.data.user
      };
      cookieUtils.setUserData(updatedUserData);
    }
    
    return response.data;
  },

  updateAvatar: async (userId, avatarFile) => {
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    
    const response = await api.put(`/users/${userId}/avatar`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    // Actualizar avatar URL en las cookies después de una actualización exitosa
    if (response.data && response.data.avatarUrl) {
      const currentUserData = cookieUtils.getUserData() || {};
      const updatedUserData = {
        ...currentUserData,
        avatarUrl: response.data.avatarUrl
      };
      cookieUtils.setUserData(updatedUserData);
    }
    
    return response.data;
  },

  changePassword: async (passwordData) => {
    const response = await api.put('/users/password', {
      oldPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    });
    return response.data;
  },

  // Función para refrescar datos del usuario actual
  refreshUserData: async () => {
    try {
      const currentUser = await userAPI.getCurrentUser();
      if (currentUser) {
        cookieUtils.setUserData(currentUser);
        return currentUser;
      }
    } catch {
      // Error refreshing user data
    }
    return null;
  }
};

// Funciones para productos
export const productAPI = {
  getAll: async () => {
    const response = await api.get('/products');
    return response.data;
  },

  // Lista de productos con estado de moderación (active/review/block)
  getModerationList: async () => {
    const response = await api.get('/products/moderation');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  create: async (productData) => {
    const response = await api.post('/products', productData);
    return response.data;
  },

  createWithPhotos: async (productData, photos) => {
    // Preparar datos en el formato exacto esperado por el backend
    const productPayload = {
      // No incluir sellerId - el backend lo obtiene del token
      title: productData.title,
      description: productData.description || '',
      location: productData.location || '',
      locationCoords: productData.locationCoords, // Ya viene como string JSON
      price: parseFloat(productData.price),
      categoryId: productData.categoryId, // Ya viene como integer
      status: productData.status || 'active'
    };

    // Si hay fotos, usar FormData
    if (photos && photos.length > 0) {
      const formData = new FormData();
      
      // Enviar cada campo del producto por separado (no como JSON)
      formData.append('title', productPayload.title);
      formData.append('description', productPayload.description);
      formData.append('location', productPayload.location);
      formData.append('locationCoords', productPayload.locationCoords);
      formData.append('price', productPayload.price);
      formData.append('categoryId', productPayload.categoryId);
      formData.append('status', productPayload.status);
      
      // Agregar fotos
      photos.forEach((photo) => {
        formData.append('photos', photo);
      });

      try {
        const response = await api.post('/products', formData);
        return response.data;
      } catch {
        // Error al crear producto con fotos
        throw new Error('Error al crear producto con fotos');
      }
    } else {
      // Sin fotos, enviar como JSON puro
      try {
        const response = await api.post('/products', productPayload);
        return response.data;
      } catch {
        // Error al crear producto sin fotos
        throw new Error('Error al crear producto sin fotos');
      }
    }
  },

  getMyProducts: async () => {
    const response = await api.get('/products/my');
    return response.data;
  },

  getProductById: async (productId) => {
    const response = await api.get(`/products/${productId}`);
    return response.data;
  },

  updateProduct: async (productId, productData, photos = null) => {
    const formData = new FormData();
    
    // Agregar datos del producto
    if (productData.title) formData.append('title', productData.title);
    if (productData.description) formData.append('description', productData.description);
    if (productData.price) formData.append('price', productData.price);
    if (productData.categoryId) formData.append('categoryId', productData.categoryId);
    if (productData.location) formData.append('location', productData.location);
    formData.append('locationCoords', JSON.stringify(productData.locationCoords || { lat: null, lng: null }));
    if (productData.status) formData.append('status', productData.status);
    
    // Agregar fotos si se proporcionaron
    if (photos && photos.length > 0) {
      photos.forEach((photo) => {
        formData.append('photos', photo);
      });
    }
    
    const response = await api.put(`/products/${productId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteProduct: async (productId) => {
    const response = await api.delete(`/products/${productId}`);
    return response.data;
  },

  // Actualiza el estado de moderación del producto
  updateModerationStatus: async (productId, moderationStatus) => {
    const payload = { moderationStatus };
    const response = await api.put(`/products/${productId}/moderation`, payload);
    return response.data;
  }
};

// Funciones para categorías
export const categoryAPI = {
  getAll: async () => {
    const response = await api.get('/categories');
    return response.data;
  },

  getMain: async () => {
    const response = await api.get('/categories/main');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  }
};

// API para Notificaciones
export const notificationAPI = {
  // Obtener todas las notificaciones del usuario
  getAllNotifications: async () => {
    const response = await api.get('/notifications');
    return response.data;
  },

  // Obtener notificación por ID
  getNotificationById: async (id) => {
    const response = await api.get(`/notifications/${id}`);
    return response.data;
  },

  // Marcar notificación como leída
  markAsRead: async (id) => {
    const response = await api.put(`/notifications/${id}`, { read: true });
    return response.data;
  },

  // Eliminar notificación
  deleteNotification: async (id) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  }
};

// API para Conversaciones
export const conversationAPI = {
  // Obtener todas las conversaciones del usuario
  getMyConversations: async () => {
    const response = await api.get('/conversations');
    return response.data;
  },

  // Crear una nueva conversación
  createConversation: async (productId, sellerId) => {
    const response = await api.post('/conversations', {
      productId,
      sellerId
    });
    return response.data;
  },

  // Obtener mensajes de una conversación específica
  getConversationMessages: async (conversationId) => {
    const response = await api.get(`/messages/?conversationId=${conversationId}`);
    return response.data;
  }
};

// API para Mensajes
export const messageAPI = {
  // Enviar un mensaje en una conversación
  sendMessage: async (conversationId, content) => {
    const payload = {
      conversationId: parseInt(conversationId), // Asegurar que sea número
      content: content.toString() // Asegurar que sea string
    };
    // Enviando mensaje con datos y tipos de datos
    const response = await api.post('/messages', payload);
    return response.data;
  },

  // Obtener mensajes de una conversación
  getMessages: async (conversationId) => {
    const response = await api.get(`/messages/?conversationId=${conversationId}`);
    return response.data;
  }
};

// API para Calificaciones de vendedores
export const ratingAPI = {
  // Crear o actualizar calificación de un vendedor
  rateSeller: async (sellerId, { score, comment }) => {
    const response = await api.post(`/ratings/${sellerId}`, { score, comment });
    return response.data;
  }
};

// ====== API de Favoritos ======
// Cache para evitar múltiples llamadas
let favoritesCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 segundos

export const favoriteAPI = {
  // Obtener todos los favoritos del usuario
  getUserFavorites: async (useCache = true) => {
    const now = Date.now();
    
    // Usar cache si está disponible y es reciente
    if (useCache && favoritesCache && (now - cacheTimestamp < CACHE_DURATION)) {
  // Using cached favorites
      return favoritesCache;
    }
    
  // Making fresh request to GET /favorites
    const response = await api.get('/favorites');
  // getUserFavorites response
    
    // Verificar estructura de respuesta
    if (Array.isArray(response.data) && response.data.length > 0) {
  // Sample favorite structure and available keys in favorite
    }
    
    // Actualizar cache
    favoritesCache = response.data;
    cacheTimestamp = now;
    
    return response.data;
  },

  // Limpiar cache cuando se modifica un favorito
  clearCache: () => {
    favoritesCache = null;
    cacheTimestamp = 0;
  },

  // Agregar producto a favoritos
  addFavorite: async (productId) => {
  // API addFavorite called with productId and type
    
    // Asegurar que productId es un número
    const numericProductId = parseInt(productId);
    if (isNaN(numericProductId)) {
      throw new Error(`Invalid productId: ${productId}`);
    }
    
    const payload = { productId: numericProductId };
  // Sending payload to POST /favorites
    
    const response = await api.post('/favorites', payload);
  // addFavorite response
    
    // Limpiar cache para forzar refetch
    favoriteAPI.clearCache();
    
    return response.data;
  },

  // Eliminar producto de favoritos
  removeFavorite: async (productId) => {
  // API removeFavorite called with productId
    
    const numericProductId = parseInt(productId);
    if (isNaN(numericProductId)) {
      throw new Error(`Invalid productId: ${productId}`);
    }
    
    const response = await api.delete(`/favorites/${numericProductId}`);
  // removeFavorite response
    
    // Limpiar cache para forzar refetch
    favoriteAPI.clearCache();
    
    return response.data;
  },

  // Verificar si un producto está en favoritos
  isFavorite: async (productId) => {
    try {
  // Checking if product is favorite
      const favorites = await favoriteAPI.getUserFavorites();
  // User favorites raw data
      
      // Verificar estructura de datos
      if (favorites.length > 0) {
  // First favorite structure and available keys
      }
      
      const numericProductId = parseInt(productId);
  // Looking for productId and type
      
      // Intentar diferentes formas de comparar basado en la estructura del backend
      const isFav = favorites.some(favorite => {
        // Pueden ser diferentes estructuras según el swagger
        const backendProductId = favorite.productId || favorite.Product?.id;
        const backendProductIdNum = parseInt(backendProductId);
        
  // Comparing backend productId and target
        return backendProductIdNum === numericProductId;
      });
      
  // Product is favorite: isFav
      return isFav;
    } catch (error) {
      console.error('Error verificando favorito:', error);
      // Si el usuario no está autenticado, devolver false sin error
      if (error.response?.status === 401 || error.response?.status === 403) {
        return false;
      }
      return false;
    }
  }
};

// ====== API de Incidencias ======
export const incidenceAPI = {
  getAll: async () => {
    const response = await api.get('/incidences');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/incidences/${id}`);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/incidences/${id}`, data);
    return response.data;
  },
  remove: async (id) => {
    const response = await api.delete(`/incidences/${id}`);
    return response.data;
  }
};

// ====== API de Reportes ======
export const reportAPI = {
  getAll: async () => {
    const response = await api.get('/reports');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/reports/${id}`);
    return response.data;
  },
  remove: async (id) => {
    const response = await api.delete(`/reports/${id}`);
    return response.data;
  },
  create: async ({ typeReport, description, userId, productId, dateReport }) => {
    const payload = {
      // El backend acepta estos campos según ejemplo dado
      dateReport: dateReport || new Date().toISOString(),
      type: typeReport, // algunos backends pueden usar 'type'
      typeReport,       // y otros 'typeReport'
      description,
      userId,
      productId
    };
    const response = await api.post('/reports', payload);
    return response.data;
  }
};

export default api;