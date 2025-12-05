import { useState } from 'react';
import { FiX, FiAlertTriangle, FiCheck } from 'react-icons/fi';
import Modal from './common/Modal';
import { authAPI, reportAPI } from '../services/api';

function ReportProductModal({ isOpen, onClose, productId, productTitle }) {
  const [reportData, setReportData] = useState({
    tipo_reporte: '',
    comentario: ''
  });
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const reportTypes = [
    { value: 'producto_falso', label: '🚫 Producto falso o engañoso' },
    { value: 'precio_incorrecto', label: '💰 Precio incorrecto' },
    { value: 'producto_dañado', label: '🔨 Producto dañado' },
    { value: 'producto_no_disponible', label: '❌ Producto no disponible' },
    { value: 'informacion_falsa', label: '📋 Información falsa' },
    { value: 'contenido_ofensivo', label: '⚠️ Contenido ofensivo' },
    { value: 'spam', label: '📧 Spam' },
    { value: 'otro', label: '📝 Otro' }
  ];

  const handleTypeChange = (type) => {
    setReportData({
      ...reportData,
      tipo_reporte: type
    });
    setErrorMessage('');
  };

  const handleCommentChange = (e) => {
    setReportData({
      ...reportData,
      comentario: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar que se haya seleccionado un tipo de reporte
    if (!reportData.tipo_reporte) {
      setErrorMessage('Por favor selecciona un tipo de reporte');
      return;
    }

    // Validar que haya comentario
    if (!reportData.comentario.trim()) {
      setErrorMessage('Por favor escribe un comentario con detalles del reporte');
      return;
    }

    // Validar longitud mínima del comentario
    if (reportData.comentario.trim().length < 10) {
      setErrorMessage('El comentario debe tener al menos 10 caracteres');
      return;
    }

    // Verificar autenticación y obtener userId del token/cookie
    if (!authAPI.isAuthenticated()) {
      setErrorMessage('Debes iniciar sesión para reportar.');
      return;
    }

    const user = authAPI.getUserData();
    const userId = user?.id ? parseInt(user.id) : null;
    if (!userId) {
      setErrorMessage('No se pudo obtener tu usuario. Vuelve a iniciar sesión.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: reportData.tipo_reporte,
        description: reportData.comentario,
        userId,
        productId: Number(productId),
        dateReport: new Date().toISOString()
      };

      await reportAPI.create(payload);

      // Éxito
      setSuccessModal(true);
      setReportData({ tipo_reporte: '', comentario: '' });
      setTimeout(() => {
        setSuccessModal(false);
        onClose();
      }, 1800);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Error al enviar el reporte. Intenta de nuevo.';
      setErrorMessage(msg);
      console.error('Error enviando reporte:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setReportData({
      tipo_reporte: '',
      comentario: ''
    });
    setErrorMessage('');
  };

  return (
    <>
      {/* Modal Principal de Reporte */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-200 px-8 py-6 flex items-center justify-between rounded-t-3xl">
            <div className="flex items-center gap-3">
              <FiAlertTriangle className="text-3xl text-red-500" />
              <div>
                <h2 className="text-2xl font-black text-gray-900">Reportar producto</h2>
                <p className="text-sm text-gray-600 mt-1">"{productTitle}"</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-100 rounded-full transition-colors"
            >
              <FiX className="text-2xl text-gray-600" />
            </button>
          </div>

          {/* Contenido */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Información */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
              <p className="text-sm text-blue-900">
                <strong>ℹ️ Nota:</strong> Tu reporte será revisado por nuestro equipo de moderación. Por favor sé lo más detallado posible.
              </p>
            </div>

            {/* Selector de Tipo de Reporte */}
            <div>
              <label className="block text-lg font-bold text-gray-900 mb-4">
                Tipo de reporte <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reportTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleTypeChange(type.value)}
                    className={`p-4 rounded-xl border-2 transition-all text-left font-semibold ${
                      reportData.tipo_reporte === type.value
                        ? 'bg-red-50 border-red-500 text-red-900 shadow-lg'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comentario */}
            <div>
              <label className="block text-lg font-bold text-gray-900 mb-3">
                Describe el problema <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reportData.comentario}
                onChange={handleCommentChange}
                placeholder="Cuéntanos por qué reportas este producto. Sé específico y detallado para que podamos ayudarte mejor..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-red-500 resize-none bg-gray-50 text-gray-900 placeholder-gray-500 font-medium"
                rows="5"
              />
              <p className="text-xs text-gray-500 mt-2">
                Mínimo 10 caracteres • Máximo 1000 caracteres
              </p>
            </div>

            {/* Mensaje de Error */}
            {errorMessage && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
                <FiAlertTriangle className="text-red-500 text-xl flex-shrink-0" />
                <p className="text-red-900 font-semibold">{errorMessage}</p>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 px-6 py-3 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  loading
                    ? 'opacity-50 cursor-not-allowed bg-red-400'
                    : 'bg-red-500 hover:bg-red-600 shadow-lg'
                }`}
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⌛</span>
                    Enviando...
                  </>
                ) : (
                  <>
                    <FiAlertTriangle />
                    Enviar reporte
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Éxito */}
      {successModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <FiCheck className="text-5xl text-green-500" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">¡Reporte enviado!</h3>
            <p className="text-gray-600 mb-6">
              Gracias por tu reporte. Nuestro equipo lo revisará pronto.
            </p>
            <div className="w-full bg-green-500 text-white rounded-xl py-1 text-xs font-bold animate-pulse">
              ✓ Completado
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ReportProductModal;
