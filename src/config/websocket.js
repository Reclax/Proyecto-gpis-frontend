// Configuración WebSocket
export const websocketConfig = {
  // URL del servidor WebSocket
  // Cambia esto según tu configuración del backend
  url: import.meta.env.VITE_API_URL?.replace('http://', 'ws://').replace('https://', 'wss://') || 'ws://localhost:8080',
  
  // Configuraciones de conexión
  heartbeatInterval: 30000,     // 30 segundos
  reconnectBackoff: 2.0,        // Factor de backoff exponencial
  maxReconnectAttempts: 3,      // Máximo intentos de reconexión (reducido para evitar spam)
  connectionTimeout: 5000,      // 5 segundos timeout para conexión (más rápido)
  
  // Timeouts
  typingTimeout: 2000,          // 2 segundos para indicador de "escribiendo"
  
  // Configuraciones de desarrollo
  enableDebugLogs: true,        // Logs de debug en consola
  enableErrorReporting: true,   // Reportar errores
};

// También exportar como WEBSOCKET_CONFIG para compatibilidad
export const WEBSOCKET_CONFIG = websocketConfig;

// Detectar si estamos en desarrollo o producción
const isDevelopment = import.meta.env.MODE === 'development';

// URLs por ambiente
export const WEBSOCKET_URLS = {
  development: import.meta.env.VITE_API_URL?.replace('http://', 'ws://').replace('https://', 'wss://') || 'ws://localhost:8080',
  production: import.meta.env.VITE_API_URL?.replace('http://', 'wss://').replace('https://', 'wss://') || 'wss://tu-dominio.com',  // Cambiar por tu dominio en producción
};

// URL automática basada en el ambiente
export const getWebSocketUrl = () => {
  return isDevelopment ? WEBSOCKET_URLS.development : WEBSOCKET_URLS.production;
};