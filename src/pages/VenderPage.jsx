import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiDollarSign,
  FiMapPin,
  FiTag,
  FiUpload,
} from "react-icons/fi";
import {
  HiDevicePhoneMobile,
  HiHomeModern,
  HiShoppingBag,
  HiTrophy,
  HiTruck,
} from "react-icons/hi2";
import { IoGameController } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import LocationPicker from "../components/common/LocationPicker";

import {
  contienePalabrasProhibidas,
  PALABRAS_PROHIBIDAS,
} from "../config/roles";
import { authAPI, categoryAPI, productAPI } from "../services/api";

function VenderPage() {
  const navigate = useNavigate();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backendCategories, setBackendCategories] = useState([]);
  // Mapeo de íconos para categorías principales
  const MAIN_CATEGORY_ICONS = {
    Electrónica: HiDevicePhoneMobile,
    Moda: HiShoppingBag,
    "Hogar y muebles": HiHomeModern,
    Deportes: HiTrophy,
    Vehículos: HiTruck,
    Gaming: IoGameController,
  };
  const [notification, setNotification] = useState({
    show: false,
    type: "",
    message: "",
  });
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    subcategory: "",
    location: "",
    locationCoords: null,
    images: [],
  });
  const [blockedWords, setBlockedWords] = useState([]);

  // Verificar autenticación y cargar categorías
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        // Verificar autenticación
        if (!authAPI.isAuthenticated()) {
          navigate("/login");
          return;
        }

        // Cargar categorías del backend con subcategorías
        const categories = await categoryAPI.getMain();
        setBackendCategories(categories);
      } catch (error) {
        // Error cargando datos
        if (error.response?.status === 401) {
          navigate("/login");
        }
      }
    };

    checkAuthAndLoadData();
  }, [navigate]);

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: "", message: "" });
    }, 5000);
  };

  useEffect(() => {
    const fullText = `${formData.title} ${formData.description}`.toLowerCase();
    const matches = PALABRAS_PROHIBIDAS.filter((word) =>
      fullText.includes(word.toLowerCase())
    );
    setBlockedWords(matches);
  }, [formData.title, formData.description]);

  const handleCategoryChange = (categoryValue) => {
    setFormData({
      ...formData,
      category: parseInt(categoryValue), // Convertir a integer desde el inicio
      subcategory: "", // Reset subcategory cuando cambia la categoría
    });
  };

  const handleLocationSelect = (locationData) => {
    setFormData({
      ...formData,
      location: locationData.address,
      locationCoords: { lat: locationData.lat, lng: locationData.lng },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones básicas
    if (!formData.title.trim()) {
      showNotification("error", "Por favor ingresa un título para tu producto");
      return;
    }
    // Descripción es opcional, no necesita validación
    if (!formData.price || parseFloat(formData.price) <= 0) {
      showNotification("error", "Por favor ingresa un precio válido mayor a 0");
      return;
    }
    if (!formData.category) {
      showNotification("error", "Por favor selecciona una categoría");
      return;
    }

    // Si la categoría seleccionada tiene subcategorías, debe elegirse una subcategoría
    const selectedCategory = backendCategories.find(
      (cat) => cat.id === formData.category
    );
    if (selectedCategory?.subcategories?.length > 0 && !formData.subcategory) {
      showNotification("error", "Por favor selecciona una subcategoría");
      return;
    }
    if (formData.images.length === 0) {
      showNotification(
        "error",
        "Por favor agrega al menos una imagen de tu producto"
      );
      return;
    }

    if (
      blockedWords.length > 0 ||
      contienePalabrasProhibidas(`${formData.title} ${formData.description}`)
    ) {
      const listado =
        blockedWords.length > 0
          ? blockedWords
          : PALABRAS_PROHIBIDAS.filter((word) =>
              `${formData.title} ${formData.description}`
                .toLowerCase()
                .includes(word.toLowerCase())
            );
      showNotification(
        "error",
        `Tu anuncio contiene palabras prohibidas: ${listado.join(", ")}`
      );
      return;
    }

    setLoading(true);

    try {
      // Preparar datos del producto en el formato exacto esperado por el backend
      const productData = {
        // No enviamos sellerId - el backend lo obtiene del token
        title: formData.title.trim(),
        description: formData.description.trim() || "",
        location: formData.location
          ? typeof formData.location === "string"
            ? formData.location
            : `${formData.location.state || ""}, ${
                formData.location.city || ""
              }, ${formData.location.neighborhood || ""}`.replace(
                /^, |, $|, , /g,
                ""
              )
          : "",
        locationCoords: JSON.stringify({
          lat: formData.locationCoords?.lat || null,
          lng: formData.locationCoords?.lng || null,
        }), // Backend espera string JSON, no objeto
        price: parseFloat(formData.price),
        categoryId: formData.subcategory || formData.category, // Ya son integers
        status: "active",
      };

      // Validación adicional antes de enviar
      if (!productData.categoryId || isNaN(productData.categoryId)) {
        showNotification("error", "Error: Categoría inválida");
        return;
      }
      if (
        !productData.price ||
        isNaN(productData.price) ||
        productData.price <= 0
      ) {
        showNotification("error", "Error: Precio inválido");
        return;
      }
      if (!productData.title || productData.title.length < 3) {
        showNotification(
          "error",
          "Error: Título debe tener al menos 3 caracteres"
        );
        return;
      }

      await productAPI.createWithPhotos(productData, formData.images);
      // Producto creado: result

      showNotification("success", "¡Producto publicado exitosamente! 🎉");

      // Limpiar formulario
      setFormData({
        title: "",
        description: "",
        price: "",
        category: "",
        subcategory: "",
        location: "",
        locationCoords: null,
        images: [],
      });

      // Redirigir después de 2 segundos para que se vea la notificación
      setTimeout(() => {
        navigate("/mis-productos");
      }, 2000);
    } catch (error) {
      // Error al crear producto

      if (error.response?.status === 401) {
        navigate("/login");
      } else {
        const errorMsg =
          error.response?.data?.message ||
          "Error al publicar el producto. Intenta de nuevo.";
        showNotification("error", errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const totalImages = formData.images.length + files.length;
    if (totalImages > 10) {
      const allowed = 10 - formData.images.length;
      if (allowed > 0) {
        setFormData({
          ...formData,
          images: [...formData.images, ...files.slice(0, allowed)],
        });
      }
      if (typeof showNotification === "function") {
        showNotification(
          "error",
          "Solo puedes subir un máximo de 10 imágenes."
        );
      } else {
        alert("Solo puedes subir un máximo de 10 imágenes.");
      }
      return;
    }
    setFormData({ ...formData, images: [...formData.images, ...files] });
  };

  const selectedCategoryData = backendCategories.find(
    (cat) => parseInt(cat.id) === parseInt(formData.category)
  );
  const subcategories = selectedCategoryData
    ? selectedCategoryData.subcategories
    : [];

  return (
    <div className="min-h-screen py-12" style={{ backgroundColor: "#EEE5E9" }}>
      <div className="sb-container max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            Vende tu producto
          </h1>
          <p className="text-xl text-gray-600">
            Publica gratis y vende rápido a miles de compradores
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-xl p-8 lg:p-12"
        >
          {/* Categoría */}
          <div className="mb-8">
            <label className="block text-lg font-bold text-gray-900 mb-4">
              Categoría *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {backendCategories.map((cat) => {
                const Icon = MAIN_CATEGORY_ICONS[cat.name] || FiTag;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.category === parseInt(cat.id)
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="text-3xl mx-auto mb-2 text-orange-500" />
                    <span className="text-sm font-semibold">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subcategoría - Diseño mejorado con badges */}
          {subcategories.length > 0 && (
            <div className="mb-8">
              <label className="block text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FiTag className="text-orange-500" />
                Subcategoría *
              </label>
              <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
                <p className="text-sm text-gray-600 mb-4">
                  Selecciona la subcategoría que mejor describa tu producto:
                </p>
                <div className="flex flex-wrap gap-3">
                  {subcategories.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          subcategory: parseInt(sub.id),
                        })
                      }
                      className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                        formData.subcategory === parseInt(sub.id)
                          ? "bg-orange-500 text-white shadow-lg transform scale-105"
                          : "bg-white text-gray-700 border-2 border-gray-200 hover:border-orange-300 hover:shadow-md"
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
                {!formData.subcategory && (
                  <p className="text-sm text-orange-600 mt-3 flex items-center gap-1">
                    <FiTag className="text-xs" />
                    Por favor selecciona una subcategoría
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Título */}
          <div className="mb-6">
            <label className="block text-lg font-bold text-gray-900 mb-2">
              Título del producto *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Ej: iPhone 14 Pro Max 128GB en excelente estado"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition-colors"
            />
            {blockedWords.length > 0 && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-2">
                <FiAlertTriangle />
                Detectamos palabras no permitidas en el título o la descripción:{" "}
                {blockedWords.join(", ")}
              </p>
            )}
          </div>

          {/* Descripción */}
          <div className="mb-6">
            <label className="block text-lg font-bold text-gray-900 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe tu producto, incluye detalles importantes..."
              rows="5"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Precio */}
          <div className="mb-6">
            <label className="block text-lg font-bold text-gray-900 mb-2">
              Precio (USD) *
            </label>
            <div className="relative">
              <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                required
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Ubicación con Mapa */}
          <div className="mb-6">
            <label className="block text-lg font-bold text-gray-900 mb-2">
              Ubicación *
            </label>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowLocationPicker(true)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-orange-500 transition-colors text-left flex items-center gap-3"
              >
                <FiMapPin className="text-xl text-gray-400" />
                <span
                  className={
                    formData.location ? "text-gray-900" : "text-gray-400"
                  }
                >
                  {formData.location || "Selecciona tu ubicación en el mapa"}
                </span>
              </button>

              {formData.location && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                  <FiMapPin className="text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-900">
                      Ubicación confirmada
                    </p>
                    <p className="text-sm text-green-700">
                      {formData.location}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(true)}
                    className="text-sm text-green-600 hover:text-green-700 font-semibold"
                  >
                    Cambiar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Imágenes */}
          <div className="mb-8">
            <label className="block text-lg font-bold text-gray-900 mb-2">
              Imágenes del producto
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-orange-500 transition-colors">
              <FiUpload className="text-5xl text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                Arrastra tus imágenes aquí o haz clic para seleccionar
              </p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="inline-block px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold cursor-pointer hover:bg-gray-800 transition-colors"
              >
                Seleccionar imágenes
              </label>
              {formData.images.length > 0 && (
                <p className="mt-4 text-sm text-gray-600">
                  {formData.images.length} imagen(es) seleccionada(s)
                </p>
              )}
            </div>

            {/* Vista previa de imágenes */}
            {formData.images.length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-semibold text-gray-800 mb-3">
                  Vista previa:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {formData.images.map((image, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newImages = formData.images.filter(
                            (_, i) => i !== index
                          );
                          setFormData({ ...formData, images: newImages });
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        ×
                      </button>
                      {index === 0 && (
                        <div className="absolute bottom-1 left-1 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                          Principal
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-8 py-4 text-white rounded-xl font-bold transition-opacity shadow-lg ${
                loading ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"
              }`}
              style={{ backgroundColor: "#CF5C36" }}
            >
              {loading ? "Publicando..." : "Publicar producto"}
            </button>
          </div>
        </form>

        {/* Tips */}
        <div className="mt-8 bg-blue-50 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-3">
            💡 Tips para vender rápido:
          </h3>
          <ul className="space-y-2 text-gray-700">
            <li>✓ Usa fotos claras y de buena calidad</li>
            <li>✓ Describe detalladamente el estado del producto</li>
            <li>✓ Establece un precio justo y competitivo</li>
            <li>✓ Responde rápido a los mensajes de compradores</li>
          </ul>
        </div>
      </div>

      {/* Modal de selección de ubicación */}
      {showLocationPicker && (
        <LocationPicker
          onLocationSelect={handleLocationSelect}
          onClose={() => setShowLocationPicker(false)}
          initialPosition={formData.locationCoords}
        />
      )}

      {/* Notificación */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
          <div
            className={`rounded-lg shadow-lg p-4 border-l-4 ${
              notification.type === "success"
                ? "bg-green-50 border-green-500 text-green-800"
                : "bg-red-50 border-red-500 text-red-800"
            }`}
          >
            <div className="flex items-center">
              <span
                className={`mr-2 ${
                  notification.type === "success"
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {notification.type === "success" ? "✅" : "❌"}
              </span>
              <span className="font-medium">{notification.message}</span>
              <button
                onClick={() =>
                  setNotification({ show: false, type: "", message: "" })
                }
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VenderPage;
