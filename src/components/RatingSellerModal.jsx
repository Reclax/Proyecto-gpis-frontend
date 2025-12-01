import { useState } from 'react';
import { FaStar } from 'react-icons/fa';
import { FiX, FiCheck } from 'react-icons/fi';

function RatingSellerModal({ isOpen, onClose, sellerId, sellerName, conversationId, onSubmit, hasRated = false }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) {
      setErrorMessage('Por favor selecciona una puntuación');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await onSubmit({
        conversationId,
        sellerId,
        score: rating,
        comment: null
      });
      
      // Mostrar éxito
      setSuccessModal(true);
      setTimeout(() => {
        setSuccessModal(false);
        onClose();
      }, 1800);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Error al guardar la calificación. Intenta de nuevo.';
      setErrorMessage(msg);
      console.error('Error en calificación:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setRating(0);
    setHoveredRating(0);
    setErrorMessage('');
    onClose();
  };

  return (
    <>
      {/* Modal Principal de Calificación */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleCancel}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header con fondo esmeralda */}
          <div className="sticky top-0 bg-gradient-to-r from-emerald-100 to-teal-100 border-b border-emerald-200 px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaStar className="text-3xl text-emerald-600" />
              <div>
                <h2 className="text-2xl font-black text-gray-900">Calificar vendedor</h2>
                <p className="text-sm text-gray-600 mt-1">{sellerName}</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-emerald-200 rounded-full transition-colors"
            >
              <FiX className="text-2xl text-gray-600" />
            </button>
          </div>

          {/* Contenido */}
          <div className="p-8 space-y-6">
            {hasRated ? (
              <>
                {/* Mensaje de ya calificado */}
                <div className="text-center py-8">
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                      <FiCheck className="text-5xl text-emerald-600" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">¡Gracias por tu calificación!</h3>
                  <p className="text-gray-600 mb-4">
                    Tu opinión es muy valiosa para nosotros.
                  </p>
                  <button
                    onClick={onClose}
                    className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Pregunta */}
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">
                    ¿Cómo fue tu experiencia con este vendedor?
                  </p>
                </div>

                {/* Estrellas */}
                <div className="flex gap-3 justify-center">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= (hoveredRating || rating);
                    return (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="transition-transform transform hover:scale-125 focus:outline-none"
                        disabled={isSubmitting}
                        type="button"
                      >
                        <FaStar
                          size={50}
                          className={`transition-colors ${
                            isFilled ? 'text-yellow-400 drop-shadow-lg' : 'text-gray-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Mostrar feedback basado en rating */}
                {rating > 0 && (
                  <div className="text-center py-4 bg-emerald-50 rounded-2xl border-2 border-emerald-200">
                    <p className="text-lg font-bold text-emerald-900">
                      {rating === 5 && '¡Excelente! 👏'}
                      {rating === 4 && 'Muy bueno 😊'}
                      {rating === 3 && 'Bueno 👍'}
                      {rating === 2 && 'Aceptable 🤔'}
                      {rating === 1 && 'Necesita mejorar 😞'}
                    </p>
                  </div>
                )}

                {/* Mensaje de Error */}
                {errorMessage && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                    <p className="text-red-900 font-semibold text-sm">{errorMessage}</p>
                  </div>
                )}

                {/* Botones de Acción */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || rating === 0}
                    className={`flex-1 px-6 py-3 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                      isSubmitting || rating === 0
                        ? 'opacity-50 cursor-not-allowed bg-emerald-400'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin">⌛</span>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <FiCheck />
                        Enviar
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Éxito */}
      {successModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                <FiCheck className="text-5xl text-emerald-600" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">¡Calificación enviada!</h3>
            <p className="text-gray-600 mb-6">
              Gracias por tu calificación al vendedor.
            </p>
            <div className="w-full bg-emerald-600 text-white rounded-xl py-1 text-xs font-bold animate-pulse">
              ✓ Completado
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default RatingSellerModal;
