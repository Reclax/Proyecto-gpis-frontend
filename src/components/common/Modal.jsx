import { FiX, FiAlertCircle, FiCheckCircle, FiInfo, FiHeart } from 'react-icons/fi';
import { HiOutlineExclamationTriangle } from 'react-icons/hi2';

function Modal({ isOpen, onClose, type = 'info', title, message, onConfirm, onCancel, confirmText = 'Aceptar', cancelText = 'Cancelar' }) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FiCheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <FiAlertCircle className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <HiOutlineExclamationTriangle className="w-6 h-6 text-amber-500" />;
      case 'confirm':
        return <HiOutlineExclamationTriangle className="w-6 h-6 text-orange-500" />;
      case 'login':
        return <FiHeart className="w-6 h-6 text-red-500" />;
      default:
        return <FiInfo className="w-6 h-6 text-blue-500" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          button: 'bg-green-600 hover:bg-green-700'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          button: 'bg-red-600 hover:bg-red-700'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          button: 'bg-amber-600 hover:bg-amber-700'
        };
      case 'confirm':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          button: 'bg-orange-600 hover:bg-orange-700'
        };
      case 'login':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          button: 'bg-red-600 hover:bg-red-700'
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          button: 'bg-blue-600 hover:bg-blue-700'
        };
    }
  };

  const colors = getColors();
  const isConfirmType = type === 'confirm' || type === 'login';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-full border-2 ${colors.border} transform transition-all duration-300 scale-100`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${colors.bg} px-6 py-4 rounded-t-2xl border-b ${colors.border} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            {getIcon()}
            <h3 className="text-lg font-bold text-gray-900">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-700 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          {isConfirmType && (
            <button
              onClick={() => {
                onCancel && onCancel();
                onClose();
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors font-semibold"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              if (isConfirmType && onConfirm) {
                onConfirm();
              }
              onClose();
            }}
            className={`px-6 py-2 text-white rounded-lg transition-colors font-semibold ${colors.button} shadow-lg hover:shadow-xl transform hover:scale-105`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;