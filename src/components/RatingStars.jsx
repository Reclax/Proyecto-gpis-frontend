import { useState } from 'react';
import { FaStar } from 'react-icons/fa';

export const RatingStars = ({ onSubmit, onCancel, sellerId, conversationId }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Por favor selecciona una puntuación');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        conversationId,
        sellerId,
        score: rating,
        comment: comment.trim() || null
      });
    } catch (error) {
      alert(`Error al guardar la calificación: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl border-2 border-orange-200 shadow-md">
      {/* Título */}
      <h3 className="text-lg font-bold text-gray-900 mb-2">¿Cómo fue tu experiencia?</h3>
      <p className="text-sm text-gray-600 mb-4">Califica al vendedor</p>

      {/* Estrellas */}
      <div className="flex gap-2 mb-6">
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
                size={40}
                className={`transition-colors ${
                  isFilled ? 'text-yellow-400 drop-shadow-lg' : 'text-gray-300'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Mostrar texto basado en rating */}
      {rating > 0 && (
        <p className="text-sm font-semibold text-gray-700 mb-4">
          {rating === 5 && '¡Excelente! 👏'}
          {rating === 4 && 'Muy bueno 😊'}
          {rating === 3 && 'Bueno 👍'}
          {rating === 2 && 'Aceptable 🤔'}
          {rating === 1 && 'Necesita mejorar 😞'}
        </p>
      )}

      {/* Campo de comentario opcional */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comparte tu opinión (opcional)"
        maxLength={200}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-4 resize-none"
        disabled={isSubmitting}
      />

      {/* Contador de caracteres */}
      <p className="text-xs text-gray-500 mb-4">{comment.length}/200</p>

      {/* Botones */}
      <div className="flex gap-3 w-full">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className={`flex-1 px-4 py-2 rounded-lg text-white font-semibold transition-colors ${
            isSubmitting || rating === 0
              ? 'bg-orange-400 cursor-not-allowed opacity-50'
              : 'bg-orange-600 hover:bg-orange-700'
          }`}
        >
          {isSubmitting ? 'Guardando...' : 'Enviar Calificación'}
        </button>
      </div>
    </div>
  );
};

export default RatingStars;
