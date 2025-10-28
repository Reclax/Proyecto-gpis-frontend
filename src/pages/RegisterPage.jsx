import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authAPI } from '../services/api';
import logo from '../assets/Logo de Shop&Buy.png';

function RegisterPage() {
  const [formData, setFormData] = useState({
    dni: '',
    email: '',
    name: '',
    lastname: '',
    password: '',
    confirmPassword: '',
    phone: '',
    avatarUrl: null,
    roleName: 'Usuario' 
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (error) setError('');
      if (success) setSuccess('');
      
      if (file.size > 2 * 1024 * 1024) {
        setError('La imagen es demasiado grande. Por favor, selecciona una imagen menor a 2MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target.result;
        setAvatarPreview(previewUrl);
      };
      reader.readAsDataURL(file);
      
      // Guardar el archivo original para enviar al backend
      setFormData(prev => ({
        ...prev,
        avatarUrl: file // Guardamos el File original
      }));
      
      
    } else {
      // Si no hay archivo, limpiar el preview
      setAvatarPreview(null);
      setFormData(prev => ({
        ...prev,
        avatarUrl: null
      }));
    }
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Email no válido');
      return false;
    }
    if (!formData.dni || !formData.name || !formData.lastname || !formData.phone || !formData.email) {
      setError('Todos los campos son requeridos');
      return false;
    }
    // Validar que el DNI tenga un formato válido (solo números)
    if (!/^\d+$/.test(formData.dni)) {
      setError('La cédula debe contener solo números');
      return false;
    }
    // Validar que el teléfono tenga un formato válido
    if (!/^\d+$/.test(formData.phone)) {
      setError('El teléfono debe contener solo números');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError('');

    try {
      // Crear FormData para envio multipart/form-data
      const registerFormData = new FormData();
      
      registerFormData.append('dni', formData.dni.toString());
      registerFormData.append('email', formData.email);
      registerFormData.append('name', formData.name);
      registerFormData.append('lastname', formData.lastname);
      registerFormData.append('password', formData.password);
      registerFormData.append('phone', formData.phone.toString());
      
      // roleId numérico: Usuario = 2, Administrador = 1
      const roleId = formData.roleName === 'Administrador' ? 1 : 2;
      registerFormData.append('roleId', roleId.toString());
      
      // Si hay archivo de imagen, agregarlo
      if (formData.avatarUrl && formData.avatarUrl instanceof File) {
        registerFormData.append('avatar', formData.avatarUrl);
      }

      // Enviando FormData con campos (debug solo en desarrollo)
      // for (let [key, value] of registerFormData.entries()) {
      //   key: value instanceof File ? `File(${value.name})` : value
      // }

  await authAPI.register(registerFormData);

      // Mostrar mensaje de éxito
      setSuccess('¡Cuenta creada exitosamente! Redirigiendo al login...');

      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      
    } catch (error) {
  // Error en registro: error
  // Error response: error.response?.data
  // Error code: error.code
  // Error message: error.message
      
      // Manejar diferentes tipos de errores
      if (error.code === 'ECONNABORTED') {
        setError('La operación tardó demasiado tiempo. El servidor puede estar sobrecargado o la imagen es muy grande.');
      } else if (error.response?.status === 400) {
        const errorMsg = error.response.data?.message || error.response.data?.error || 'Email ya registrado o datos inválidos';
        setError(errorMsg);
      } else if (error.response?.status === 500) {
        const errorMsg = error.response.data?.message || error.response.data?.error || 'Error interno del servidor';
        setError(errorMsg);
      } else if (error.code === 'ECONNREFUSED') {
        setError('No se puede conectar al servidor. Verifica que el backend esté corriendo.');
      } else {
        const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Error al crear la cuenta. Inténtalo de nuevo.';
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-2 sm:p-4" style={{ backgroundColor: '#EEE5E9' }}>
      {/* Partículas flotantes de fondo - reducidas */}
      <div className="floating-particles absolute inset-0 pointer-events-none">
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
      </div>

      {/* Elementos decorativos de fondo - más pequeños */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 w-6 h-6 sm:w-12 sm:h-12 rounded-full opacity-10 animate-morphing" style={{ backgroundColor: '#CF5C36' }}></div>
      <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 w-4 h-4 sm:w-8 sm:h-8 rounded-full opacity-10 animate-float" style={{ backgroundColor: '#EFC88B' }}></div>

      {/* Contenedor principal responsive */}
      <div className="w-full max-w-xs sm:max-w-sm lg:max-w-md mx-auto">
        {/* Tarjeta de registro compacta */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-5 glass-effect hover-elevate w-full max-h-[95vh] overflow-y-auto">
          {/* Header con logo compacto */}
          <div className="text-center mb-2 sm:mb-3">
            <div className="relative inline-block mb-1 sm:mb-2">
              <img
                src={logo}
                alt="Shop&Buy logo"
                className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 object-contain mx-auto animate-glow"
              />
              <div className="absolute inset-0 rounded-full border-2 border-dashed opacity-30 animate-spin" style={{ borderColor: '#CF5C36', animationDuration: '10s' }}></div>
            </div>
            <h1 className="text-base sm:text-lg lg:text-xl font-black mb-1" style={{ color: '#CF5C36' }}>
              ¡Únete a Shop&Buy!
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm">Crea tu cuenta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3">
            {/* Avatar upload compacto */}
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100 mx-auto">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm sm:text-base lg:text-lg">
                      👤
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  id="avatar"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="avatar"
                  className="absolute bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: '#CF5C36' }}
                >
                  <span className="text-white text-xs">📷</span>
                </label>
              </div>
            </div>

            {/* Nombres y Apellidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label htmlFor="name" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  Nombres
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 focus:outline-none transition-all glass-effect text-xs sm:text-sm"
                  placeholder="Juan"
                  required
                />
              </div>

              <div>
                <label htmlFor="lastname" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  Apellidos
                </label>
                <input
                  type="text"
                  id="lastname"
                  name="lastname"
                  value={formData.lastname}
                  onChange={handleInputChange}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 focus:outline-none transition-all glass-effect text-xs sm:text-sm"
                  placeholder="Pérez"
                  required
                />
              </div>
            </div>

            {/* Cédula y Celular */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label htmlFor="dni" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  Cédula
                </label>
                <input
                  type="text"
                  id="dni"
                  name="dni"
                  value={formData.dni}
                  onChange={handleInputChange}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 focus:outline-none transition-all glass-effect text-xs sm:text-sm"
                  placeholder="1234567890"
                  pattern="[0-9]{10}"
                  maxLength="10"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  Celular
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 focus:outline-none transition-all glass-effect text-xs sm:text-sm"
                  placeholder="0987654321"
                  pattern="[0-9]{10}"
                  maxLength="10"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 pr-7 sm:pr-9 rounded border border-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 focus:outline-none transition-all glass-effect text-xs sm:text-sm"
                  placeholder="tu@email.com"
                  required
                />
                <div className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs sm:text-sm">
                  📧
                </div>
              </div>
            </div>

            {/* Contraseñas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label htmlFor="password" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 pr-7 sm:pr-9 rounded border border-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 focus:outline-none transition-all glass-effect text-xs sm:text-sm"
                    placeholder="8+ chars"
                    minLength="8"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-xs sm:text-sm"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  Confirmar
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 pr-7 sm:pr-9 rounded border border-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 focus:outline-none transition-all glass-effect text-xs sm:text-sm"
                    placeholder="Repite"
                    minLength="8"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-xs sm:text-sm"
                  >
                    {showConfirmPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </div>

            {/* Términos y condiciones compacto */}
            <div>
              <label className="flex items-start gap-1.5 sm:gap-2">
                <input
                  type="checkbox"
                  className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 rounded border-gray-300 focus:ring-orange-500 flex-shrink-0"
                  style={{ accentColor: '#CF5C36' }}
                  required
                />
                <span className="text-xs sm:text-sm text-gray-600 leading-tight">
                  Acepto{' '}
                  <Link to="#" className="font-medium hover:underline" style={{ color: '#CF5C36' }}>
                    términos
                  </Link>
                  {' '}y{' '}
                  <Link to="#" className="font-medium hover:underline" style={{ color: '#CF5C36' }}>
                    privacidad
                  </Link>
                </span>
              </label>
            </div>

            {/* Mensaje de error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded text-xs">
                <div className="flex items-center">
                  <span className="mr-2">⚠️</span>
                  {error}
                </div>
              </div>
            )}

            {/* Mensaje de éxito */}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-3 py-2 rounded text-xs">
                <div className="flex items-center">
                  <span className="mr-2">✅</span>
                  {success}
                </div>
              </div>
            )}

            {/* Botón de registro compacto */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2 sm:py-2.5 px-3 sm:px-4 text-white font-bold rounded shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 text-xs sm:text-sm ${
                isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'hover:bg-orange-700'
              }`}
              style={{ backgroundColor: isLoading ? '#9CA3AF' : '#CF5C36' }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creando cuenta...
                </div>
              ) : (
                'Crear cuenta'
              )}
            </button>

            {/* Enlaces del footer compacto */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2 text-xs mt-2">
              <Link
                to="/login"
                className="font-semibold hover:underline order-1 sm:order-none"
                style={{ color: '#CF5C36' }}
              >
                ¿Ya tienes cuenta?
              </Link>

              <div className="inline-flex items-center gap-1 opacity-50 order-3 sm:order-none">
                <span className="text-green-500 text-xs">🛡️</span>
                <span className="text-xs font-medium text-gray-400">Seguro</span>
              </div>

              <Link
                to="/"
                className="text-gray-500 hover:text-gray-700 transition-colors order-2 sm:order-none"
              >
                ← Inicio
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
