import { useState, useEffect } from 'react';
import { FiX, FiMail, FiSend, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { authAPI } from '../../services/api';

function RequestPasswordResetModal({ isOpen, initialEmail = '', onClose }) {
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail || '');
      setSuccessMessage('');
      setErrorMessage('');
      setSubmitting(false);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await authAPI.requestPasswordReset(email);
      setSuccessMessage('Si el correo existe, hemos enviado un enlace de restablecimiento. Revisa tu bandeja de entrada.');
    } catch (err) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;
      if (status === 429) {
        setErrorMessage(serverMessage || 'Demasiados intentos. Intenta de nuevo en unos minutos.');
      } else {
        setErrorMessage('No se pudo procesar la solicitud. Inténtalo nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FiMail /> Recuperar contraseña
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10"
            aria-label="Cerrar"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Correo electrónico</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="tu@email.com"
              />
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {successMessage && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
              <FiCheckCircle className="mt-0.5" />
              <p className="text-sm">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <FiAlertCircle className="mt-0.5" />
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 text-white rounded-lg transition font-semibold flex items-center gap-2 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}
            >
              <FiSend /> {submitting ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RequestPasswordResetModal;
