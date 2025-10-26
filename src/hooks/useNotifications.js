import { useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '../services/api';
import webSocketService from '../services/websocket';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Función getSenderInfo eliminada - ya no necesaria

  // Cargar notificaciones desde la API (persistencia)
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await notificationAPI.getAllNotifications();
      
      // Mapear y ordenar por fecha (más recientes primero)
      const mappedNotifications = data.map(notification => ({
        id: notification.id,
        title: notification.title || 'Nueva notificación',
        message: notification.message,
        read: notification.read || false,
        createdAt: notification.createdAt,
        typeId: notification.typeId,
        userId: notification.userId,
        // Agregar campos adicionales para compatibilidad
        type: getNotificationType(notification.typeId),
        timestamp: notification.createdAt
      })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  setNotifications(mappedNotifications);
      
    } catch (err) {
      // Error cargando notificaciones
      setError(err.message);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Función auxiliar para determinar el tipo de notificación
  const getNotificationType = (typeId) => {
    // Mapear typeId a tipo de notificación
    switch (typeId) {
      case 1:
        return 'message';
      case 2:
        return 'product';
      case 3:
        return 'system';
      default:
        return 'general';
    }
  };

  // Agregar nueva notificación (desde WebSocket)
  const addNotification = useCallback((newNotification) => {
    setNotifications(prev => {
      // Evitar duplicados
      const exists = prev.some(notif => notif.id === newNotification.id);
      if (exists) {
        return prev;
      }

      const mappedNotification = {
        id: newNotification.id || Date.now(),
        title: newNotification.title || 'Nueva notificación',
        message: newNotification.message || newNotification.content || '',
        read: false, // Las nuevas notificaciones siempre son no leídas
        createdAt: newNotification.createdAt || new Date().toISOString(),
        typeId: newNotification.typeId,
        userId: newNotification.userId,
        type: getNotificationType(newNotification.typeId),
        timestamp: newNotification.createdAt || new Date().toISOString()
      };

      
      // Emitir evento para sincronizar con otras instancias del hook
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('notificationUpdated', { 
          detail: { type: 'add', notification: mappedNotification } 
        }));
      }, 0);
      
      // Agregar al inicio del array (más reciente primero)
      return [mappedNotification, ...prev];
    });
  }, []);

  // Marcar como leída
  const markAsRead = useCallback(async (notificationId) => {
    try {
      // Actualizar en el servidor
      await notificationAPI.markAsRead(notificationId);
      
      // Actualizar en el estado local
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
      
      // Emitir evento para sincronizar con otras instancias del hook
      window.dispatchEvent(new CustomEvent('notificationUpdated', { 
        detail: { type: 'markAsRead', notificationId } 
      }));
      
    } catch (err) {
      // Error marcando notificación como leída
      setError(err.message);
    }
  }, []);

  // Marcar todas como leídas
  const markAllAsRead = useCallback(async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    
    if (unreadNotifications.length === 0) {
      return;
    }

    try {
      // Marcar todas como leídas localmente para UX rápida
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );

      // Marcar en el servidor
      await Promise.all(
        unreadNotifications.map(notification =>
          notificationAPI.markAsRead(notification.id)
        )
      );
      
      // Emitir evento para sincronizar con otras instancias del hook
      window.dispatchEvent(new CustomEvent('notificationUpdated', { 
        detail: { type: 'markAllAsRead' } 
      }));
      
    } catch (err) {
      // Error marcando todas las notificaciones como leídas
      setError(err.message);
      // Recargar notificaciones en caso de error
      loadNotifications();
    }
  }, [notifications, loadNotifications]);

  // Eliminar notificación
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await notificationAPI.deleteNotification(notificationId);
      
      setNotifications(prev =>
        prev.filter(notif => notif.id !== notificationId)
      );
      
      // Emitir evento para sincronizar con otras instancias del hook
      window.dispatchEvent(new CustomEvent('notificationUpdated', { 
        detail: { type: 'delete', notificationId } 
      }));
      
    } catch (err) {
      // Error eliminando notificación
      setError(err.message);
    }
  }, []);

  // Contar notificaciones no leídas
  const unreadCount = notifications.filter(notif => !notif.read).length;

  // Obtener notificaciones recientes (últimas 10)
  const recentNotifications = notifications.slice(0, 10);

  // Configurar listeners de WebSocket - Solo para la primera instancia
  // Singleton para listeners de notificaciones (evita duplicados en hot reload y múltiples hooks)
  useEffect(() => {
    if (!window.__wsNotificationListener) {
      window.__wsNotificationListener = true;
      let lastMessageId = null;
      const handleNewMessage = (payload) => {
        // Solo crear notificación si el mensaje no es del usuario actual y no es duplicado
        if (
          payload.senderId &&
          payload.senderId !== webSocketService.currentUserId &&
          payload.id !== lastMessageId
        ) {
          lastMessageId = payload.id;
          const notificationPayload = {
            id: `msg_${payload.id}_${Date.now()}`,
            title: 'Nuevo mensaje',
            message: 'Tienes un mensaje nuevo',
            typeId: 1,
            userId: webSocketService.currentUserId,
            createdAt: payload.sentAt || payload.createdAt || new Date().toISOString(),
            originalMessage: payload,
            conversationId: payload.conversationId,
            senderId: payload.senderId
          };
          addNotification(notificationPayload);
        }
      };
      webSocketService.on('newMessage', handleNewMessage);
      window.__wsNotificationCleanup = () => {
        webSocketService.off('newMessage', handleNewMessage);
        window.__wsNotificationListener = false;
      };
    }
    return () => {
      if (window.__wsNotificationCleanup) {
        window.__wsNotificationCleanup();
        window.__wsNotificationCleanup = null;
      }
    };
  }, [addNotification]);

  // Cargar notificaciones al montar el hook
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Sincronización entre instancias del hook
  useEffect(() => {
    const handleNotificationUpdate = (event) => {
      const { type, notificationId, notification } = event.detail;
      
      switch (type) {
        case 'markAsRead':
          setNotifications(prev =>
            prev.map(notif =>
              notif.id === notificationId ? { ...notif, read: true } : notif
            )
          );
          break;
        
        case 'markAllAsRead':
          setNotifications(prev => 
            prev.map(notif => ({ ...notif, read: true }))
          );
          break;
        
        case 'delete':
          setNotifications(prev =>
            prev.filter(notif => notif.id !== notificationId)
          );
          break;
        
        case 'add':
          setNotifications(prev => {
            // Evitar duplicados
            const exists = prev.some(notif => notif.id === notification.id);
            if (exists) return prev;
            return [notification, ...prev];
          });
          break;
        
        default:
          break;
      }
    };

    window.addEventListener('notificationUpdated', handleNotificationUpdate);
    
    return () => {
      window.removeEventListener('notificationUpdated', handleNotificationUpdate);
    };
  }, []);

  return {
    notifications,
    recentNotifications,
    unreadCount,
    loading,
    error,
    loadNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification
  };
};

export default useNotifications;