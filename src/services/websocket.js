import { authAPI, API_BASE_URL } from './api.js';
import { websocketConfig } from '../config/websocket.js';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.isReconnecting = false;
    this.messageQueue = [];
    this.eventListeners = new Map();
    this.currentUserId = null;

    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.send = this.send.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.startHeartbeat = this.startHeartbeat.bind(this);
    this.stopHeartbeat = this.stopHeartbeat.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    // Setup visibility change detection
    this.setupVisibilityDetection();
  }

  async connect() {
    if (this.isConnected || this.isReconnecting) {
      return Promise.resolve();
    }
    // Conectando a WebSocket...
    const token = authAPI.getAuthToken();
    const currentUser = authAPI.getUserData();
    if (!token || !currentUser) {
      throw new Error('No hay usuario autenticado');
    }
    this.currentUserId = currentUser.id;
    const wsUrl = `${websocketConfig.url}?token=${token}&userId=${currentUser.id}`;
    this.ws = new WebSocket(wsUrl);
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws.close();
        reject(new Error('Timeout de conexión WebSocket'));
      }, websocketConfig.connectionTimeout);
      this.ws.onopen = () => {
        clearTimeout(timeout);
        // WebSocket conectado
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.startHeartbeat();
        this.processMessageQueue();
        this.emit('connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        // Mensaje WebSocket recibido
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        clearTimeout(timeout);
        // WebSocket desconectado
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected', event);
        if (!this.isReconnecting && event.code !== 1000) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        // Error WebSocket
        this.emit('error', error);
        reject(error);
      };
    });
  }

  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      // Procesando mensaje WebSocket
      // Manejar diferentes tipos de mensajes del backend
      switch (message.type) {
        case 'init:data':
          // Datos de inicialización recibidos
          this.emit('init', message.data);
          // Si hay conversaciones, procesarlas
          if (message.data && Array.isArray(message.data.conversations)) {
            // Conversaciones iniciales
          }
          break;
        case 'chat:new':
          // Nuevo mensaje de chat recibido
          if (message.data && message.data.message) {
            this.emit('newMessage', message.data.message);
          }
          break;
        case 'chat:sent':
          // Mensaje enviado confirmado
          if (message.data && message.data.message) {
            this.emit('messageSent', message.data.message);
          }
          break;
        case 'notification:new':
        case 'newNotification':
          // Nueva notificación recibida
          this.emit('newNotification', message.data);
          break;
        case 'chat:read:update':
          // Estado de lectura actualizado
          this.emit('messageReadUpdate', message.data);
          break;
        case 'notification:read:confirm':
          // Notificación marcada como leída
          this.emit('notificationReadConfirm', message.data);
          break;
        case 'user:online':
          // Usuario conectado
          this.emit('userOnline', message.data);
          break;
        case 'user:offline':
          // Usuario desconectado
          this.emit('userOffline', message.data);
          break;
        case 'users:list':
          // Lista de usuarios conectados
          this.emit('onlineUsers', message.data);
          break;
        case 'error':
          // Error del servidor
          this.emit('serverError', message);
          break;
        case 'newMessage':
        case 'message': // Mantener compatibilidad con tipos genéricos
          // Emitiendo evento newMessage
          this.emit('newMessage', message.payload || message.data);
          break;
        case 'messageUpdate':
          // Emitiendo evento messageUpdate
          this.emit('messageUpdate', message.payload);
          break;
        case 'userOnline':
          // Usuario online
          this.emit('userOnline', message.payload);
          break;
        case 'userOffline':
          this.emit('userOffline', message.payload);
          break;
        case 'userStatusUpdate':
          this.emit('userStatusUpdate', message.payload);
          break;
        case 'onlineUsers':
          this.emit('onlineUsers', message.payload);
          break;
        case 'typingStart':
          this.emit('typingStart', message.payload);
          break;
        case 'typingStop':
          this.emit('typingStop', message.payload);
          break;
        case 'pong':
          break;
        default:
          // Emitir evento genérico para mensajes desconocidos
          this.emit('message', message);
      }
    } catch {
      // Error al procesar mensaje WebSocket
    }
  }

  send(message) {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    } else {
      this.messageQueue.push(message);
      return false;
    }
  }

  joinConversation(conversationId) {
    const success = this.send({
      type: 'joinConversation',
      payload: { conversationId }
    });
    return success;
  }

  leaveConversation(conversationId) {
    return this.send({
      type: 'leaveConversation',
      payload: { conversationId }
    });
  }

  sendMessage(conversationId, content) {
    return this.send({
      type: 'chat:send',
      conversationId: conversationId,
      content: content
    });
  }

  startTyping(conversationId) {
    return this.send({
      type: 'startTyping',
      payload: { conversationId }
    });
  }

  stopTyping(conversationId) {
    return this.send({
      type: 'stopTyping',
      payload: { conversationId }
    });
  }

  setUserStatus(status) {
    return this.send({
      type: 'userStatusChange',
      payload: { 
        status, 
        timestamp: new Date().toISOString() 
      }
    });
  }

  getUsersOnline() {
    return this.send({
      type: 'getUsersOnline',
      payload: {}
    });
  }

  requestUserStatus(userId) {
    return this.send({
      type: 'requestUserStatus',
      payload: { userId }
    });
  }

  markMessageAsRead(messageId) {
    return this.send({
      type: 'chat:read',
      messageId: messageId
    });
  }

  markNotificationAsRead(notificationId) {
    return this.send({
      type: 'notification:read',
      notificationId: notificationId
    });
  }

  sendNotification(userId, title, body, notificationType) {
    return this.send({
      type: 'notification:send',
      userId: userId,
      title: title,
      body: body,
      notificationType: notificationType
    });
  }

  requestOnlineUsers() {
    return this.send({
      type: 'users:request',
      action: 'getOnlineUsers'
    });
  }

  updateUserStatus(status) {
    return this.send({
      type: 'user:status',
      status: status,
      timestamp: new Date().toISOString()
    });
  }

  disconnect() {
    this.isReconnecting = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.messageQueue = [];
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || this.isReconnecting) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit('maxReconnectAttemptsReached');
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(websocketConfig.reconnectBackoff || 1.5, this.reconnectAttempts - 1);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        this.isReconnecting = false;
        // Si ya llegamos al máximo de intentos, no intentar más
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.emit('maxReconnectAttemptsReached');
        } else {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'ping',
          payload: { timestamp: Date.now() }
        });
      }
    }, websocketConfig.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  setupVisibilityDetection() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('focus', () => this.handleVisibilityChange('focus'));
    window.addEventListener('blur', () => this.handleVisibilityChange('blur'));
  }

  handleVisibilityChange(eventType) {
    if (!this.isConnected) return;
    if (document.hidden || eventType === 'blur') {
      this.setUserStatus('away');
    } else if (!document.hidden || eventType === 'focus') {
      this.setUserStatus('online');
    }
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch {
          // Error en listener de evento
        }
      });
    }
  }

  // Método para limpiar listeners
  removeAllListeners() {
    this.eventListeners.clear();
  }

  // Status methods
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  getReconnectStatus() {
    return {
      isReconnecting: this.isReconnecting,
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    };
  }

  // Método público para simular mensajes (para testing)
  simulateMessage(messageData) {
    // Simular un evento de mensaje WebSocket
    const mockEvent = {
      data: JSON.stringify({
        type: 'newMessage',
        payload: messageData
      })
    };
    this.handleMessage(mockEvent);
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
