import { useState, useEffect, useCallback, useRef } from 'react';
import webSocketService from '../services/websocket';

// Hook para manejar la conexión WebSocket
export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectStatus, setReconnectStatus] = useState({
    isReconnecting: false,
    attempts: 0,
    maxAttempts: 5
  });
  const [error, setError] = useState(null);

  const connect = useCallback(() => {
    return webSocketService.connect()
      .then(() => {
        setIsConnected(true);
        setError(null);
      })
      .catch((err) => {
        setError(err);
        setIsConnected(false);
        throw err;
      });
  }, []);

  const disconnect = useCallback(() => {
    webSocketService.disconnect();
    setIsConnected(false);
  }, []);

  useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
      setError(null);
      setReconnectStatus(webSocketService.getReconnectStatus());
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setReconnectStatus(webSocketService.getReconnectStatus());
    };

    const handleError = (error) => {
      setError(error);
      setIsConnected(false);
    };

    const handleMaxReconnectAttemptsReached = () => {
      setError(new Error('No se pudo reconectar después de varios intentos'));
      setReconnectStatus(webSocketService.getReconnectStatus());
    };

    // Suscribirse a eventos
    webSocketService.on('connected', handleConnected);
    webSocketService.on('disconnected', handleDisconnected);
    webSocketService.on('error', handleError);
    webSocketService.on('maxReconnectAttemptsReached', handleMaxReconnectAttemptsReached);

    // Cleanup
    return () => {
      webSocketService.off('connected', handleConnected);
      webSocketService.off('disconnected', handleDisconnected);
      webSocketService.off('error', handleError);
      webSocketService.off('maxReconnectAttemptsReached', handleMaxReconnectAttemptsReached);
    };
  }, []);

  return {
    isConnected,
    reconnectStatus,
    error,
    connect,
    disconnect,
    send: webSocketService.send.bind(webSocketService),
    joinConversation: webSocketService.joinConversation.bind(webSocketService),
    leaveConversation: webSocketService.leaveConversation.bind(webSocketService),
    startTyping: webSocketService.startTyping.bind(webSocketService),
    stopTyping: webSocketService.stopTyping.bind(webSocketService)
  };
};

// Hook para manejar mensajes en tiempo real
export const useWebSocketMessages = (conversationId) => {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const conversationIdRef = useRef(conversationId);

  // Actualizar la referencia cuando cambie conversationId
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const addMessage = useCallback((message) => {
    setMessages(prevMessages => {
      // Evitar duplicados
      const exists = prevMessages.some(msg => msg.id === message.id);
      if (exists) return prevMessages;
      
      return [...prevMessages, message];
    });
  }, []);

  const updateMessage = useCallback((messageId, updates) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    );
  }, []);

  const setMessagesFromAPI = useCallback((apiMessages) => {
    setMessages(apiMessages);
  }, []);

  useEffect(() => {
    const handleNewMessage = (payload) => {
      
      // Marcar al emisor como online (si no es el usuario actual)
      if (payload.senderId && payload.senderId !== webSocketService.currentUserId) {
        // Importar dinámicamente el hook de usuarios online
        import('../pages/ChatPage').then(() => {
          // El usuario que envía mensajes está claramente online
          // Esto se manejará a nivel de componente
        }).catch(() => {});
      }
      
      // Solo procesar mensajes de la conversación actual (comparar como strings y números)
      const payloadConvId = payload.conversationId?.toString();
      const currentConvId = conversationIdRef.current?.toString();
      
      if (payloadConvId === currentConvId) {
        
        // Mapear el mensaje del WebSocket al formato de UI
        const mappedMessage = {
          id: payload.id,
          text: payload.content,
          sender: payload.senderId === webSocketService.currentUserId ? 'me' : 'vendor',
          timestamp: formatMessageTimestamp(payload.sentAt || payload.createdAt),
          originalData: payload
        };
        
        addMessage(mappedMessage);
  }
    };

    const handleUserTyping = (payload) => {
      if (payload.conversationId === conversationIdRef.current && 
          payload.userId !== webSocketService.currentUserId) {
        setTypingUsers(prev => new Set([...prev, payload.userId]));
      }
    };

    const handleUserStoppedTyping = (payload) => {
      if (payload.conversationId === conversationIdRef.current) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(payload.userId);
          return newSet;
        });
      }
    };

    const handleMessageSent = (messageData) => {
      // Actualizar mensaje temporal con datos reales del servidor
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.pending && msg.text === messageData.content ? {
            ...msg,
            id: messageData.id,
            pending: false,
            status: 'sent', // Confirmado como enviado
            timestamp: formatMessageTimestamp(messageData.sentAt || messageData.createdAt),
            originalData: messageData
          } : msg
        )
      );
    };

    const handleMessageReadUpdate = (data) => {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === data.messageId ? {
            ...msg,
            status: data.read ? 'read' : 'delivered'
          } : msg
        )
      );
    };

    // Suscribirse a eventos
    webSocketService.on('newMessage', handleNewMessage);
    webSocketService.on('messageSent', handleMessageSent);
    webSocketService.on('messageReadUpdate', handleMessageReadUpdate);
    webSocketService.on('userTyping', handleUserTyping);
    webSocketService.on('userStoppedTyping', handleUserStoppedTyping);

    // Unirse a la conversación si hay una seleccionada
    if (conversationId) {
      const joined = webSocketService.joinConversation(conversationId);
      if (!joined) {
  // No se pudo unir a la conversación WebSocket (no conectado)
      }
    }

    return () => {
      // Cleanup
      webSocketService.off('newMessage', handleNewMessage);
      webSocketService.off('messageSent', handleMessageSent);
      webSocketService.off('messageReadUpdate', handleMessageReadUpdate);
      webSocketService.off('userTyping', handleUserTyping);
      webSocketService.off('userStoppedTyping', handleUserStoppedTyping);
      
      // Salir de la conversación
      if (conversationId) {
        webSocketService.leaveConversation(conversationId);
      }
    };
  }, [conversationId, addMessage]);

  return {
    messages,
    typingUsers,
    addMessage,
    updateMessage,
    setMessagesFromAPI
  };
};

// Hook para manejar notificaciones en tiempo real
export const useWebSocketNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    setNotifications(prev => {
      // Evitar duplicados
      const exists = prev.some(notif => notif.id === notification.id);
      if (exists) return prev;
      
      return [notification, ...prev];
    });
  }, []);

  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
  }, []);

  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  }, []);

  useEffect(() => {
    const handleNewNotification = (payload) => {
      addNotification(payload);
    };

    webSocketService.on('newNotification', handleNewNotification);

    return () => {
      webSocketService.off('newNotification', handleNewNotification);
    };
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    markAsRead
  };
};

// Hook para manejar estado online de usuarios
export const useOnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [userStatuses, setUserStatuses] = useState(new Map()); // userId -> {status, lastSeen}

  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(userId?.toString());
  }, [onlineUsers]);

  const getUserStatus = useCallback((userId) => {
    return userStatuses.get(userId?.toString()) || { status: 'offline', lastSeen: null };
  }, [userStatuses]);

  const requestUserStatus = useCallback((userId) => {
    return webSocketService.requestUserStatus(userId);
  }, []);

  const requestOnlineUsers = useCallback(() => {
    return webSocketService.requestOnlineUsers();
  }, []);

  // Método para marcar manualmente a un usuario como online (útil para sincronización)
  const setUserOnline = useCallback((userId, status = 'online') => {
    setOnlineUsers(prev => new Set([...prev, userId.toString()]));
    setUserStatuses(prev => new Map(prev).set(userId.toString(), {
      status,
      lastSeen: new Date().toISOString()
    }));
  }, []);

  const setUserOffline = useCallback((userId) => {
    setOnlineUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId.toString());
      return newSet;
    });
    setUserStatuses(prev => new Map(prev).set(userId.toString(), {
      status: 'offline',
      lastSeen: new Date().toISOString()
    }));
  }, []);

  useEffect(() => {
    const handleUserOnline = (payload) => {
      // Maneja tanto formato directo como con userId
      const userId = payload.userId || payload.id || payload;
      const status = payload.status || 'online';
      const timestamp = payload.timestamp || new Date().toISOString();
      
      
      setOnlineUsers(prev => new Set([...prev, userId.toString()]));
      setUserStatuses(prev => new Map(prev).set(userId.toString(), {
        status,
        lastSeen: timestamp
      }));
    };

    const handleUserOffline = (payload) => {
      // Maneja tanto formato directo como con userId
      const userId = payload.userId || payload.id || payload;
      const timestamp = payload.timestamp || new Date().toISOString();
      
      
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId.toString());
        return newSet;
      });
      
      setUserStatuses(prev => new Map(prev).set(userId.toString(), {
        status: 'offline',
        lastSeen: timestamp
      }));
    };

    const handleOnlineUsersList = (payload) => {
      const { users = [] } = payload;
      
      const onlineUserIds = new Set(users.map(user => 
        typeof user === 'object' ? user.userId?.toString() : user?.toString()
      ));
      
      const statusMap = new Map();
      users.forEach(user => {
        if (typeof user === 'object') {
          statusMap.set(user.userId?.toString(), {
            status: user.status || 'online',
            lastSeen: user.lastSeen || new Date().toISOString()
          });
        } else {
          statusMap.set(user?.toString(), {
            status: 'online',
            lastSeen: new Date().toISOString()
          });
        }
      });
      
      setOnlineUsers(onlineUserIds);
      setUserStatuses(statusMap);
    };

    // Suscribirse a eventos
    webSocketService.on('userOnline', handleUserOnline);
    webSocketService.on('userOffline', handleUserOffline);
    webSocketService.on('onlineUsers', handleOnlineUsersList);

    // Solicitar lista inicial de usuarios online cuando se conecta
    const handleConnected = () => {
      setTimeout(() => {
        webSocketService.requestOnlineUsers();
        
        // También simulemos que el usuario actual está online
        const currentUser = webSocketService.currentUserId;
        if (currentUser) {
          handleUserOnline({ userId: currentUser, status: 'online' });
        }
      }, 1000); // Esperar 1 segundo después de conectar
    };

    // Manejar datos iniciales del WebSocket
    const handleInitData = (data) => {
      // Si hay información de usuarios en los datos iniciales, procesarla
      if (data && data.conversations) {
        // Extraer IDs de usuarios de las conversaciones y marcarlos como potencialmente online
        data.conversations.forEach(conv => {
          // El usuario que envió el último mensaje podría estar online
          if (conv.lastMessage && conv.lastMessage.sentAt) {
            const lastMessageTime = new Date(conv.lastMessage.sentAt);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastMessageTime) / (1000 * 60));
            
            // Si enviaron un mensaje en los últimos 30 minutos, considerarlo online
            // Si enviaron un mensaje en los últimos 30 minutos, considerarlo online
            if (diffMinutes < 30) {
              // ...existing code...
            }
          }
        });
      }
    };

    webSocketService.on('connected', handleConnected);
    webSocketService.on('init', handleInitData);

    return () => {
      webSocketService.off('userOnline', handleUserOnline);
      webSocketService.off('userOffline', handleUserOffline);
      webSocketService.off('onlineUsers', handleOnlineUsersList);
      webSocketService.off('connected', handleConnected);
      webSocketService.off('init', handleInitData);
    };
  }, []);

  return {
    onlineUsers,
    userStatuses,
    isUserOnline,
    getUserStatus,
    requestUserStatus,
    requestOnlineUsers,
    setUserOnline,
    setUserOffline
  };
};

// Función auxiliar para formatear timestamp (movida aquí para reutilización)
const formatMessageTimestamp = (dateString) => {
  const messageDate = new Date(dateString);
  const now = new Date();
  
  if (messageDate.toDateString() === now.toDateString()) {
    return messageDate.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  } else if (messageDate.toDateString() === new Date(now.getTime() - 86400000).toDateString()) {
    return `Ayer ${messageDate.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return messageDate.toLocaleDateString('es-EC', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};