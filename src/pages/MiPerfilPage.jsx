import { useState, useEffect } from 'react';
import { authAPI, userAPI, API_BASE_URL } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiPhone, FiMapPin, FiCamera } from 'react-icons/fi';

function MiPerfilPage() {
  const [userData, setUserData] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    lastname: '',
    email: '',
    phone: '',
    address: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [previewImage, setPreviewImage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authAPI.isAuthenticated()) {
      navigate('/login');
      return;
    }
    const user = authAPI.getUserData();
    setUserData(user);
    setFormData({
      name: user?.name || '',
      lastname: user?.lastname || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || ''
    });
  }, [navigate]);

  const getAvatarUrl = (user) => {
    // Si hay una imagen en preview, mostrarla
    if (previewImage) return previewImage;
    
    if (!user) return null;
    
    // Crear cache buster basado en el timestamp del usuario para evitar regeneración constante
    const cacheBuster = user.updatedAt ? `?v=${new Date(user.updatedAt).getTime()}` : `?v=${Date.now()}`;
    
    if (user.avatarUrl?.startsWith('data:')) return user.avatarUrl;
    if (user.avatarUrl?.startsWith(API_BASE_URL)) {
      return user.avatarUrl.includes('?') ? user.avatarUrl : `${user.avatarUrl}${cacheBuster}`;
    }
    if (user.avatarUrl?.startsWith('/')) {
      return `${API_BASE_URL}${user.avatarUrl}${cacheBuster}`;
    }
    if (user.dni) return `${API_BASE_URL}/uploads/users/${user.dni}/${user.dni}.jpg${cacheBuster}`;
    return `${API_BASE_URL}/uploads/common/user-common.png${cacheBuster}`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: '', message: '' });
    }, 5000);
  };

  const validatePasswordChange = () => {
    if (!passwordData.currentPassword) {
      showNotification('error', 'Por favor ingresa tu contraseña actual');
      return false;
    }
    if (passwordData.newPassword.length < 6) {
      showNotification('error', 'La nueva contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showNotification('error', 'Las nuevas contraseñas no coinciden');
      return false;
    }
    return true;
  };

  const handleConfirmSave = () => {
    // Validar si se quiere cambiar contraseña
    if (showPasswordFields && !validatePasswordChange()) {
      return;
    }
    setShowConfirmModal(true);
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      setShowConfirmModal(false);
      
      // Actualizar perfil en el backend (solo los campos soportados)
      await userAPI.updateProfile(userData.id, {
        name: formData.name,
        lastname: formData.lastname,
        phone: formData.phone
      });
      
      // Si se quiere cambiar contraseña, hacerlo también
      if (showPasswordFields) {
        await userAPI.changePassword({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        });
        
        // Limpiar campos de contraseña
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setShowPasswordFields(false);
      }
      
      // Obtener datos frescos del usuario desde el backend para asegurar sincronización
      const freshUserData = await userAPI.whoAmI();
      
      // Actualizar datos en las cookies y estado local con datos frescos
      if (freshUserData) {
        const token = authAPI.getAuthToken();
        if (token) {
          authAPI.saveAuthData(token, freshUserData);
        }
        setUserData(freshUserData);
        setFormData({
          name: freshUserData?.name || '',
          lastname: freshUserData?.lastname || '',
          email: freshUserData?.email || '',
          phone: freshUserData?.phone || '',
          address: freshUserData?.address || ''
        });
      }
      
      showNotification('success', 'Perfil actualizado exitosamente');
      setIsEditing(false);
    } catch (error) {
      // Error al actualizar perfil
      showNotification('error', `Error al actualizar el perfil: ${error.response?.data?.message || error.message || 'Inténtalo de nuevo'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: userData?.name || '',
      lastname: userData?.lastname || '',
      email: userData?.email || '',
      phone: userData?.phone || '',
      address: userData?.address || ''
    });
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswordFields(false);
    setIsEditing(false);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Validar tipo de archivo
        if (!file.type.startsWith('image/')) {
          showNotification('error', 'Por favor selecciona un archivo de imagen válido.');
          return;
        }
        
        // Validar tamaño del archivo (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
          showNotification('error', 'La imagen debe ser menor a 5MB.');
          return;
        }

        // Crear preview de la imagen
        const reader = new FileReader();
        reader.onload = (event) => {
          setPreviewImage(event.target.result);
        };
        reader.readAsDataURL(file);

        setIsUploadingImage(true);
        
        // Actualizar avatar en el backend
        await userAPI.updateAvatar(userData.id, file);
        
        // Obtener datos frescos del usuario desde el backend para asegurar sincronización
        const freshUserData = await userAPI.whoAmI();
        
        // Actualizar datos en las cookies y estado local con datos frescos
        if (freshUserData) {
          const token = authAPI.getAuthToken();
          if (token) {
            authAPI.saveAuthData(token, freshUserData);
          }
          setUserData(freshUserData);
        }

        // Limpiar preview después de confirmar la actualización
        setPreviewImage(null);
        
        showNotification('success', 'Avatar actualizado exitosamente');
      } catch (error) {
        // Error al actualizar avatar
        showNotification('error', `Error al actualizar el avatar: ${error.response?.data?.message || error.message || 'Inténtalo de nuevo'}`);
        // Limpiar preview si hay error
        setPreviewImage(null);
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="sb-container">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-gray-900">Mi Perfil</h1>
          <p className="text-gray-600 mt-1">Gestiona tu información personal</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-100 border-4 border-orange-100">
                  {getAvatarUrl(userData) ? (
                    <img
                      src={getAvatarUrl(userData)}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl text-gray-400">
                      👤
                    </div>
                  )}
                </div>
                <label className={`absolute bottom-2 right-2 w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-orange-700 transition-colors shadow-lg ${isUploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {isUploadingImage ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <FiCamera className="text-white text-xl" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isUploadingImage}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                {isUploadingImage ? 'Subiendo imagen...' : 'Click en la cámara para cambiar'}
              </p>
            </div>

            {/* Información del usuario */}
            <div className="flex-1 w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FiUser className="text-orange-600" />
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FiUser className="text-orange-600" />
                    Apellido
                  </label>
                  <input
                    type="text"
                    name="lastname"
                    value={formData.lastname}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FiMail className="text-orange-600" />
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={true} // Temporalmente deshabilitado - backend no soporta actualizar email
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FiPhone className="text-orange-600" />
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="0987654321"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
               
              </div>

              {/* Sección de cambio de contraseña */}
              {isEditing && (
                <div className="mt-8 border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-700">Cambiar contraseña</h3>
                    <button
                      type="button"
                      onClick={() => setShowPasswordFields(!showPasswordFields)}
                      className="text-orange-600 hover:text-orange-700 font-medium text-sm"
                    >
                      {showPasswordFields ? 'Cancelar cambio' : 'Cambiar contraseña'}
                    </button>
                  </div>

                  {showPasswordFields && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Contraseña actual
                        </label>
                        <input
                          type="password"
                          name="currentPassword"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Nueva contraseña
                        </label>
                        <input
                          type="password"
                          name="newPassword"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Confirmar nueva contraseña
                        </label>
                        <input
                          type="password"
                          name="confirmPassword"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 flex gap-4">
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-8 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
                  >
                    Editar Perfil
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleConfirmSave}
                      disabled={isLoading}
                      className="px-8 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Guardando...
                        </>
                      ) : (
                        'Guardar cambios'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isLoading}
                      className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal de confirmación */}
        {showConfirmModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div 
              className="absolute inset-0"
              style={{ 
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
              }}
            ></div>
            <div className="relative bg-white rounded-xl p-6 m-4 max-w-md w-full shadow-2xl border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmar cambios</h3>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que quieres actualizar tu perfil? 
                {showPasswordFields && ' Esto incluye el cambio de contraseña.'}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Guardando...
                    </>
                  ) : (
                    'Confirmar'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notificaciones */}
        {notification.show && (
          <div className="fixed top-4 right-4 z-50">
            <div className={`max-w-sm w-full rounded-lg shadow-lg p-4 ${
              notification.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {notification.type === 'success' ? (
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {notification.message}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setNotification({ show: false, type: '', message: '' })}
                    className={`-mx-1.5 -my-1.5 rounded-lg p-1.5 hover:bg-gray-100 focus:outline-none ${
                      notification.type === 'success' ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    <span className="sr-only">Cerrar</span>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MiPerfilPage;
