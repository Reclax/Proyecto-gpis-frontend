import React from 'react';

const MessageStatusIcon = ({ status, isOwn }) => {
  // Solo mostrar estados en mensajes propios
  if (!isOwn) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return (
          <div className="flex items-center text-gray-400 text-xs">
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        );
      case 'sent':
        return (
          <div className="text-gray-400 text-xs" title="Enviado">
            ✓
          </div>
        );
      case 'delivered':
        return (
          <div className="text-gray-500 text-xs" title="Entregado">
            ✓✓
          </div>
        );
      case 'read':
        return (
          <div className="text-blue-500 text-xs" title="Visto">
            ✓✓
          </div>
        );
      case 'failed':
        return (
          <div className="text-red-500 text-xs" title="Error al enviar">
            ⚠️
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-end mt-1">
      {getStatusIcon()}
    </div>
  );
};

export default MessageStatusIcon;