import { useEffect, useState } from "react";
import {
  FiCheck,
  FiLock,
  FiMail,
  FiPhone,
  FiShield,
  FiUser,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import Modal from "../components/common/Modal";
import usePageTitle from "../hooks/usePageTitle";
import { authAPI } from "../services/api";
import { checkAdminAccess } from "../utils/rolePermissions";

function RegistroModeradorPage() {
  usePageTitle("Registrar Moderador");
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    cedula: "",
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    password: "",
    confirmPassword: "",
    avatarUrl: null,
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [modalData, setModalData] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  useEffect(() => {
    // Verificar que solo Admin pueda registrar moderadores
    const access = checkAdminAccess("registrar_moderadores");

    if (!access.isAllowed) {
      navigate(access.redirectPath || "/");
      return;
    }

    setIsAuthorized(true);
    setLoading(false);
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setModalData({
          isOpen: true,
          type: "error",
          title: "Error de Archivo",
          message:
            "La imagen es demasiado grande. Por favor, selecciona una imagen menor a 2MB.",
          confirmText: "Entendido",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);

      setFormData((prev) => ({
        ...prev,
        avatarUrl: file,
      }));
    } else {
      setAvatarPreview(null);
      setFormData((prev) => ({
        ...prev,
        avatarUrl: null,
      }));
    }
  };

  const validateForm = () => {
    // Validar cédula (10 dígitos)
    if (!/^\d{10}$/.test(formData.cedula)) {
      setModalData({
        isOpen: true,
        type: "error",
        title: "Error de Validación",
        message: "La cédula debe tener 10 dígitos",
        confirmText: "Entendido",
      });
      return false;
    }

    // Validar email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setModalData({
        isOpen: true,
        type: "error",
        title: "Error de Validación",
        message: "Por favor ingresa un email válido",
        confirmText: "Entendido",
      });
      return false;
    }

    // Validar contraseña fuerte
    if (formData.password.length < 8) {
      setModalData({
        isOpen: true,
        type: "error",
        title: "Contraseña Débil",
        message: "La contraseña debe tener al menos 8 caracteres",
        confirmText: "Entendido",
      });
      return false;
    }

    // Validar que coincidan las contraseñas
    if (formData.password !== formData.confirmPassword) {
      setModalData({
        isOpen: true,
        type: "error",
        title: "Error de Validación",
        message: "Las contraseñas no coinciden",
        confirmText: "Entendido",
      });
      return false;
    }

    // Validar campos requeridos según backend: nombre, apellido, telefono, email
    if (
      !formData.nombre ||
      !formData.apellido ||
      !formData.telefono ||
      !formData.email
    ) {
      setModalData({
        isOpen: true,
        type: "error",
        title: "Campos Requeridos",
        message: "Por favor completa todos los campos obligatorios",
        confirmText: "Entendido",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setModalData({
      isOpen: true,
      type: "confirm",
      title: "Confirmar Registro",
      message: `¿Estás seguro de registrar a ${formData.nombre} ${formData.apellido} como Moderador?`,
      onConfirm: async () => {
        setFormLoading(true);
        try {
          // Construir FormData en el mismo formato que RegisterPage
          const registerFormData = new FormData();
          registerFormData.append("dni", formData.cedula.toString());
          registerFormData.append("email", formData.email);
          registerFormData.append("name", formData.nombre);
          registerFormData.append("lastname", formData.apellido);
          registerFormData.append("password", formData.password);
          if (formData.telefono)
            registerFormData.append("phone", formData.telefono.toString());

          // roleId: 3 -> Moderador según tu backend
          registerFormData.append("roleId", "3");

          // Si hay archivo de imagen, agregarlo
          if (formData.avatarUrl && formData.avatarUrl instanceof File) {
            registerFormData.append("avatar", formData.avatarUrl);
          }

          // Llamar al endpoint público de registro (backend enviará verificación por email)
          await authAPI.register(registerFormData);

          setModalData({
            isOpen: true,
            type: "success",
            title: "Moderador Registrado",
            message: `${formData.nombre} ${formData.apellido} ha sido registrado exitosamente como Moderador. Se ha enviado un correo de verificación a ${formData.email}`,
            onConfirm: () => navigate("/admin/usuarios"),
            confirmText: "Ir a Usuarios",
          });

          // Limpiar formulario
          setFormData({
            cedula: "",
            nombre: "",
            apellido: "",
            email: "",
            telefono: "",
            password: "",
            confirmPassword: "",
          });
        } catch (error) {
          // Manejo de errores similar a RegisterPage
          let message =
            "Hubo un error al registrar el moderador. Por favor intenta nuevamente.";
          if (error.code === "ECONNABORTED") {
            message =
              "La operación tardó demasiado tiempo. El servidor puede estar sobrecargado.";
          } else if (error.response?.status === 400) {
            message =
              error.response.data?.message ||
              error.response.data?.error ||
              "Email, DNI ya registrado o rol no válido";
          } else if (error.response?.status === 500) {
            message =
              error.response.data?.message ||
              error.response.data?.error ||
              "Error interno del servidor";
          } else if (error.code === "ECONNREFUSED") {
            message =
              "No se puede conectar al servidor. Verifica que el backend esté corriendo.";
          } else {
            message =
              error.response?.data?.message ||
              error.response?.data?.error ||
              error.message ||
              message;
          }

          setModalData({
            isOpen: true,
            type: "error",
            title: "Error al Registrar",
            message,
            confirmText: "Entendido",
          });
        } finally {
          setFormLoading(false);
        }
      },
      confirmText: "Registrar",
      cancelText: "Cancelar",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="sb-container max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/admin")}
            className="text-orange-600 hover:text-orange-700 font-semibold mb-4 flex items-center gap-2"
          >
            ← Volver al Panel
          </button>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <FiShield className="text-purple-600" />
            Registrar Nuevo Moderador
          </h1>
          <p className="text-gray-600 mt-1">
            Completa la información para dar de alta un nuevo moderador
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
        >
          {/* Avatar Upload */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-purple-100 overflow-hidden bg-gray-100 flex items-center justify-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FiUser className="w-10 h-10 text-gray-400" />
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
                className="absolute bottom-0 right-0 bg-purple-600 text-white p-2 rounded-full cursor-pointer hover:bg-purple-700 transition-colors shadow-md"
                title="Subir foto"
              >
                <span className="text-xs">📷</span>
              </label>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Foto de perfil (Opcional)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cédula */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cédula <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="cedula"
                  value={formData.cedula}
                  onChange={handleChange}
                  placeholder="1234567890"
                  maxLength="10"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* (Campo 'Género' eliminado — no es requerido por el backend) */}

            {/* Nombre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Juan"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="moderador@shop.com"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Apellido */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Apellido <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="apellido"
                  value={formData.apellido}
                  onChange={handleChange}
                  placeholder="Pérez"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            {/* Teléfono */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="0987654321"
                  pattern="[0-9]{10}"
                  maxLength="10"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* (Se eliminó campo Dirección porque el backend no lo espera en /users/register) */}

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Mínimo 8 caracteres, incluye mayúsculas y números
              </p>
            </div>

            {/* Confirmar Contraseña (columna derecha) */}
            <div className="md:col-start-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Confirmar Contraseña <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repite la contraseña"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Información del Rol */}
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-3">
              <FiShield className="text-purple-600 text-xl mt-0.5" />
              <div>
                <h3 className="font-semibold text-purple-900">
                  Permisos de Moderador
                </h3>
                <ul className="text-sm text-purple-800 mt-2 space-y-1">
                  <li className="flex items-center gap-2">
                    <FiCheck className="text-purple-600" />
                    Gestionar incidencias y reportes
                  </li>
                  <li className="flex items-center gap-2">
                    <FiCheck className="text-purple-600" />
                    Suspender/Activar cuentas de usuarios
                  </li>
                  <li className="flex items-center gap-2">
                    <FiCheck className="text-purple-600" />
                    Aprobar o rechazar productos
                  </li>
                  <li className="flex items-center gap-2">
                    <FiCheck className="text-purple-600" />
                    Revisar apelaciones de vendedores
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="mt-8 flex gap-4 justify-end">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {formLoading ? (
                <>
                  <span className="animate-spin">⌛</span>
                  Registrando...
                </>
              ) : (
                <>
                  <FiShield />
                  Registrar Moderador
                </>
              )}
            </button>
          </div>
        </form>

        {/* Modal */}
        <Modal
          isOpen={modalData.isOpen}
          onClose={() => setModalData({ ...modalData, isOpen: false })}
          type={modalData.type}
          title={modalData.title}
          message={modalData.message}
          onConfirm={modalData.onConfirm}
          confirmText={modalData.confirmText}
          cancelText={modalData.cancelText}
        />
      </div>
    </div>
  );
}

export default RegistroModeradorPage;
