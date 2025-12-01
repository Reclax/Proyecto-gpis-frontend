import { useEffect } from 'react';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiZap, FiCheck, FiX, FiRefreshCw, FiMessageSquare } from 'react-icons/fi';
import useNotifications from '../hooks/useNotifications';
import usePageTitle from '../hooks/usePageTitle';

function NotificacionesPage() {
  usePageTitle('Notificaciones');
  const navigate = useNavigate();
  
  // Notificaciones hooks
  const { 
    notifications, 
    unreadCount, 
    loading, 
    error, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    loadNotifications 
  } = useNotifications();

  useEffect(() => {
    if (!authAPI.isAuthenticated()) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  // Función para formatear fecha
  const formatTime = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d`;
    return date.toLocaleDateString();
  };

  // Manejar clic en notificación
  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Si es una notificación de mensaje, navegar al chat
    if (notification.conversationId || notification.originalMessage?.conversationId) {
      const conversationId = notification.conversationId || notification.originalMessage?.conversationId;
      navigate(`/chat/${conversationId}`);
    }
    // Si es una notificación de reporte con productId, navegar a gestión de incidencias
    else if (notification.productId || notification.reportId) {
      const productId = notification.productId;
      navigate('/gestion-incidencias', { 
        state: { 
          tab: 'reportes',
          productId: productId,
          scrollToProduct: true 
        } 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="sb-container max-w-4xl">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-gray-900">Notificaciones</h1>
              <p className="text-gray-600 mt-1">Gestiona tus notificaciones</p>
            </div>
            
            {/* Controles de notificaciones */}
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiCheck className="w-4 h-4" />
                  Marcar todas como leídas
                </button>
              )}
              <button
                onClick={loadNotifications}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Badge de contador */}
          {unreadCount > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              <FiBell className="w-4 h-4" />
              {unreadCount} notificación{unreadCount !== 1 ? 'es' : ''} no leída{unreadCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Indicador eliminado para simplicidad */}

        {/* Lista de notificaciones */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {loading ? (
            <div className="p-12 text-center">
              <FiRefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
              <div className="text-gray-500 font-medium">Cargando notificaciones...</div>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <FiX className="w-8 h-8 text-red-400 mx-auto mb-4" />
              <div className="text-red-600 font-medium">Error al cargar notificaciones</div>
              <div className="text-sm text-red-500 mt-1">{error}</div>
              <button
                onClick={loadNotifications}
                className="mt-4 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <FiBell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <div className="text-gray-600 font-medium">No hay notificaciones</div>
              <div className="text-sm text-gray-400 mt-1">
                Cuando recibas mensajes o actualizaciones, aparecerán aquí
              </div>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Icono según tipo de notificación */}
                      <div className={`p-2 rounded-full flex-shrink-0 ${
                        notification.conversationId || notification.originalMessage?.conversationId
                          ? 'bg-blue-100'
                          : 'bg-gray-100'
                      }`}>
                        {notification.conversationId || notification.originalMessage?.conversationId ? (
                          <FiMessageSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <FiBell className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className={`font-semibold ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                        
                        <p className="text-gray-600 mb-2 whitespace-pre-wrap">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">
                            {formatTime(notification.createdAt)}
                          </span>
                          {notification.read && (
                            <div className="flex items-center gap-1 text-green-600">
                              <FiCheck className="w-3 h-3" />
                              <span className="text-xs">Leída</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Botón para eliminar */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                      title="Eliminar notificación"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer con estadísticas */}
        {notifications.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{notifications.length}</div>
                <div className="text-sm text-gray-500">Total de notificaciones</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
                <div className="text-sm text-gray-500">No leídas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{notifications.length - unreadCount}</div>
                <div className="text-sm text-gray-500">Leídas</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificacionesPage;
