import React, { useState, useRef, useEffect } from 'react';
import { FiBell, FiX, FiCheck, FiCheckCircle, FiMessageSquare } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import useNotifications from '../../hooks/useNotifications';

const NotificationIcon = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  
  const {
    recentNotifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Formatear fecha de manera amigable
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

    setIsOpen(false); // Cerrar dropdown

    // Si es una notificación de mensaje, navegar al chat
    if (notification.conversationId || notification.originalMessage?.conversationId) {
      const conversationId = notification.conversationId || notification.originalMessage?.conversationId;
      navigate(`/chat/${conversationId}`);
    }
    // Si es una notificación de reporte con productId, navegar a gestión de incidencias
    else if (notification.productId || notification.reportId) {
      const productId = notification.productId;
      // Navegar a la pestaña de reportes pendientes con scroll al producto
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
    <div className="relative" ref={dropdownRef}>
      {/* Icono de notificaciones */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
        title={`${unreadCount} notificaciones no leídas`}
      >
        <FiBell className="w-6 h-6" />
        
        {/* Badge de contador */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-semibold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50 max-h-96 flex flex-col">
          {/* Header del dropdown */}
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  title="Marcar todas como leídas"
                >
                  <FiCheckCircle className="w-4 h-4" />
                  Todas
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de notificaciones */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-pulse">Cargando notificaciones...</div>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-500">
                <div className="text-sm">Error al cargar notificaciones</div>
                <div className="text-xs mt-1">{error}</div>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <FiBell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <div className="text-gray-500 font-medium">No hay notificaciones</div>
                <div className="text-sm text-gray-400 mt-1">
                  Cuando recibas mensajes o actualizaciones, aparecerán aquí
                </div>
              </div>
            ) : (
              recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Icono según tipo de notificación */}
                      <div className={`p-2 rounded-full flex-shrink-0 mt-1 ${
                        notification.conversationId || notification.originalMessage?.conversationId
                          ? 'bg-blue-100'
                          : 'bg-gray-100'
                      }`}>
                        {notification.conversationId || notification.originalMessage?.conversationId ? (
                          <FiMessageSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <FiBell className="w-4 h-4 text-gray-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-medium text-sm truncate ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2" title={notification.message}>
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">
                            {formatTime(notification.createdAt)}
                          </span>
                          {notification.read && (
                            <FiCheck className="w-3 h-3 text-green-500" />
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
                      className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0"
                      title="Eliminar notificación"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer con enlace a ver todas */}
          {recentNotifications.length > 0 && (
            <div className="p-3 border-t text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notificaciones');
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Ver todas las notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationIcon;