
# WebSocket Frontend - Documentación de Integración

## 🚀 ¿Qué hace este sistema?
Permite chat y notificaciones en tiempo real usando WebSocket, eliminando el polling HTTP. Incluye reconexión automática, heartbeat, indicadores de "escribiendo", y fallback a HTTP si el WebSocket falla.

---

## � Estructura y Archivos Clave

- `src/services/websocket.js`: Servicio singleton para conexión, reconexión, heartbeat y envío/recepción de eventos.
- `src/hooks/useWebSocket.js`: Hooks React para manejar conexión, mensajes y notificaciones en tiempo real.
- `src/pages/ChatPage.jsx`: Chat UI que consume el WebSocket y muestra mensajes/notificaciones en tiempo real.
- `src/pages/NotificacionesPage.jsx`: Notificaciones push en tiempo real.

---

## ⚙️ Configuración y Uso

### 1. Configuración de conexión
El WebSocket se conecta automáticamente usando el JWT y userId:

```js
const wsUrl = `${websocketConfig.url}?token=${token}&userId=${currentUser.id}`;
const ws = new WebSocket(wsUrl);
```

### 2. Eventos que el Frontend ENVÍA

```js
// Unirse a una conversación
{ type: 'joinConversation', payload: { conversationId } }
// Salir de una conversación
{ type: 'leaveConversation', payload: { conversationId } }
// Enviar mensaje
{ type: 'chat:send', conversationId, content }
// Marcar mensaje como leído
{ type: 'chat:read', messageId }
// Indicador escribiendo
{ type: 'startTyping', payload: { conversationId } }
{ type: 'stopTyping', payload: { conversationId } }
// Heartbeat
{ type: 'ping', payload: { timestamp } }
```

### 3. Eventos que el Frontend RECIBE

```js
// Nuevo mensaje
{ type: 'message' | 'newMessage', payload: { ... } }
// Confirmación de mensaje enviado
{ type: 'chat:sent', data: { ... } }
// Notificación push
{ type: 'notification:new', data: { ... } }
// Estado de lectura
{ type: 'chat:read:update', data: { ... } }
// Usuario escribiendo
{ type: 'typingStart', payload: { ... } }
// Usuario deja de escribir
{ type: 'typingStop', payload: { ... } }
// Estado online/offline
{ type: 'userOnline' | 'userOffline', payload: { ... } }
// Heartbeat respuesta
{ type: 'pong', payload: { timestamp } }
```

---

## 🛡️ Autenticación
- El backend debe aceptar el token y userId por query params.
- Validar el JWT antes de aceptar la conexión.

---

## 🔄 Reconexión y Heartbeat
- Reconexión automática hasta 5 intentos, con backoff exponencial.
- Heartbeat cada 30s para mantener la conexión viva.
- Si el WebSocket muere, el frontend puede seguir usando HTTP como fallback.

---

## 🧩 Ejemplo de Uso en React

```js
import { websocketService } from '../services/websocket';

// Escuchar mensajes nuevos
useEffect(() => {
  websocketService.on('newMessage', (msg) => {
    // Actualizar UI
  });
  return () => websocketService.off('newMessage');
}, []);

// Enviar mensaje
websocketService.sendMessage(conversationId, 'Hola!');
```

---

## � Notas Importantes
- El WebSocket NO reemplaza la API REST, solo el polling para mensajes/notificaciones.
- El envío real de mensajes puede seguir usando HTTP como respaldo.
- El sistema es compatible con el backend REST actual, solo requiere agregar WebSocket server.

---

## 🧪 Pruebas recomendadas
1. Abrir dos ventanas del chat y enviar mensajes: deben verse al instante.
2. Probar el indicador "escribiendo...".
3. Desconectar internet y verificar reconexión automática.
4. Cerrar sesión y verificar que el WebSocket se desconecta.

---

## � Roadmap (Próximas mejoras)
- Estado "en línea/desconectado" de usuarios
- Confirmaciones de lectura
- Notificaciones push del navegador
- Archivos multimedia en tiempo real
- Llamadas de voz/video (WebRTC)

---

¡Listo para producción! 🚀