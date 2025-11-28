import { useState, useEffect } from "react";
import {
  authAPI,
  productAPI,
  categoryAPI,
  incidenceAPI,
  appealAPI,
  userAPI,
  API_BASE_URL,
} from "../services/api";
import { useNavigate, Link } from "react-router-dom";
import {
  FiEye,
  FiEdit,
  FiTrash2,
  FiPlus,
  FiAlertCircle,
  FiAlertTriangle,
  FiX,
  FiSave,
  FiUpload,
  FiDollarSign,
  FiMapPin,
  FiTag,
  FiFileText,
} from "react-icons/fi";
import {
  HiDevicePhoneMobile,
  HiShoppingBag,
  HiHomeModern,
  HiTrophy,
  HiTruck,
} from "react-icons/hi2";
import { IoGameController } from "react-icons/io5";
// Mapeo de íconos para categorías principales (igual que en VenderPage)
const MAIN_CATEGORY_ICONS = {
  Electrónica: HiDevicePhoneMobile,
  Moda: HiShoppingBag,
  "Hogar y muebles": HiHomeModern,
  Deportes: HiTrophy,
  Vehículos: HiTruck,
  Gaming: IoGameController,
};
import LocationPicker from "../components/common/LocationPicker";

function MisProductosPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({
    show: false,
    type: "",
    message: "",
  });
  const [editModal, setEditModal] = useState({ show: false, product: null });
  const [editLoading, setEditLoading] = useState(false);
  const [appealModal, setAppealModal] = useState({
    show: false,
    product: null,
    incidenceId: null,
  });
  const [appealLoading, setAppealLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState("default"); // 'default', 'asc', 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 6;
  const navigate = useNavigate();

  useEffect(() => {
    const loadMyProducts = async () => {
      try {
        // Verificar autenticación
        if (!authAPI.isAuthenticated()) {
          navigate("/login");
          return;
        }

        // Obtener productos del usuario y todas las incidencias para enriquecer con descripciones
        const [productsResponse, incidencesResponse] = await Promise.all([
          productAPI.getMyProducts(),
          incidenceAPI.getAll(),
        ]);

        // Agrupar incidencias completas por productId para fácil acceso
        const incidencesByProduct = Array.isArray(incidencesResponse)
          ? incidencesResponse.reduce((acc, inc) => {
              const pid = String(inc.productId);
              (acc[pid] ||= []).push(inc);
              return acc;
            }, {})
          : {};

        // Mapear productos del backend al formato del frontend, enriqueciendo incidencias con descripción
        const mappedProducts = productsResponse.map((product) => {
          const reportsData = product.Reports || [];
          const baseIncidences = product.Incidences || [];
          const fullIncidences = incidencesByProduct[String(product.id)] || [];

          // Merge por id; si no hay coincidencia, usar las completas por productId
          const mergedIncidences = baseIncidences.length
            ? baseIncidences.map((inc) => {
                const match = fullIncidences.find(
                  (f) => String(f.id) === String(inc.id)
                );
                return {
                  ...inc,
                  description: match?.description ?? inc.description ?? null,
                  dateIncidence:
                    match?.dateIncidence ?? inc.dateIncidence ?? null,
                  userId: match?.userId ?? inc.userId ?? null,
                  productId: match?.productId ?? product.id,
                };
              })
            : fullIncidences;

          return {
            id: product.id,
            nombre: product.title,
            descripcion: product.description || "Sin descripción",
            precio: product.price,
            estado:
              product.status === "active"
                ? "Activo"
                : product.status === "sold"
                ? "Vendido"
                : product.status === "reserved"
                ? "Reservado"
                : "Inactivo",
            moderationStatus: product.moderationStatus || "active",
            incidenceId: product.incidenceId || null,
            appealStatus: product.appealStatus || null,
            hasResolvedIncidence: product.hasResolvedIncidence || false,
            incidenceResolution: product.incidenceResolution || null,
            reports: reportsData,
            incidences: mergedIncidences,
            visitas: 0,
            imagen:
              product.ProductPhotos && product.ProductPhotos.length > 0
                ? product.ProductPhotos[0].url.startsWith("http")
                  ? product.ProductPhotos[0].url
                  : `${API_BASE_URL}${product.ProductPhotos[0].url}`
                : "📦",
            fecha: product.createdAt || new Date().toISOString(),
          };
        });

        setProductos(mappedProducts);
      } catch (error) {
        console.error("Error cargando productos:", error);
        // Si hay error de autenticación, redirigir al login
        if (error.response?.status === 401) {
          navigate("/login");
        } else {
          // Para otros errores, mostrar productos vacíos
          setProductos([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadMyProducts();
  }, [navigate]);

  // Función para recargar productos (extraída para reutilización)
  const reloadProducts = async () => {
    try {
      setLoading(true);
      // Verificar autenticación
      if (!authAPI.isAuthenticated()) {
        navigate("/login");
        return;
      }
      // Obtener productos del usuario e incidencias completas para enriquecer con descripciones
      const [productsResponse, incidencesResponse] = await Promise.all([
        productAPI.getMyProducts(),
        incidenceAPI.getAll(),
      ]);

      const incidencesByProduct = Array.isArray(incidencesResponse)
        ? incidencesResponse.reduce((acc, inc) => {
            const pid = String(inc.productId);
            (acc[pid] ||= []).push(inc);
            return acc;
          }, {})
        : {};

      // Mapear productos del backend al formato del frontend, mostrando categoría y subcategoría si existen
      const mappedProducts = productsResponse.map((product) => {
        let categoria = "Sin categoría";
        if (product.Category) {
          categoria = product.Category.name;
          if (product.Subcategory && product.Subcategory.name) {
            categoria += " / " + product.Subcategory.name;
          }
        }
        // Enriquecer incidencias
        const baseIncidences = product.Incidences || [];
        const fullIncidences = incidencesByProduct[String(product.id)] || [];
        const mergedIncidences = baseIncidences.length
          ? baseIncidences.map((inc) => {
              const match = fullIncidences.find(
                (f) => String(f.id) === String(inc.id)
              );
              return {
                ...inc,
                description: match?.description ?? inc.description ?? null,
                dateIncidence:
                  match?.dateIncidence ?? inc.dateIncidence ?? null,
                userId: match?.userId ?? inc.userId ?? null,
                productId: match?.productId ?? product.id,
              };
            })
          : fullIncidences;

        return {
          id: product.id,
          nombre: product.title,
          descripcion: product.description || "Sin descripción",
          precio: product.price,
          estado:
            product.status === "active"
              ? "Activo"
              : product.status === "sold"
              ? "Vendido"
              : product.status === "reserved"
              ? "Reservado"
              : "Inactivo",
          moderationStatus: product.moderationStatus || "active",
          incidenceId: product.incidenceId || null,
          appealStatus: product.appealStatus || null,
          hasResolvedIncidence: product.hasResolvedIncidence || false,
          incidenceResolution: product.incidenceResolution || null,
          reports: product.Reports || [],
          incidences: mergedIncidences,
          visitas: 0,
          imagen:
            product.ProductPhotos && product.ProductPhotos.length > 0
              ? product.ProductPhotos[0].url.startsWith("http")
                ? product.ProductPhotos[0].url
                : `${API_BASE_URL}${product.ProductPhotos[0].url}`
              : "📦",
          categoria,
          fecha: product.createdAt || new Date().toISOString(),
        };
      });
      setProductos(mappedProducts);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login");
      } else {
        showNotification("error", "Error al recargar tus productos");
      }
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: "", message: "" });
    }, 5000);
  };

  const handleEliminar = async (id, nombre) => {
    if (
      window.confirm(
        `¿Estás seguro de eliminar "${nombre}"?\n\nEsta acción no se puede deshacer.`
      )
    ) {
      try {
        setLoading(true);
        // Llamar a la API para eliminar
        await productAPI.deleteProduct(id);
        // Actualizar el estado local
        setProductos((prev) => prev.filter((p) => p.id !== id));
        showNotification(
          "success",
          `Producto "${nombre}" eliminado exitosamente`
        );
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
        } else if (error.response?.status === 403) {
          showNotification(
            "error",
            "No tienes permisos para eliminar este producto"
          );
        } else {
          const errorMsg =
            error.response?.data?.message || "Error al eliminar el producto";
          showNotification("error", errorMsg);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditar = async (id) => {
    try {
      setLoading(true);
      // Obtener el producto completo del backend con todas sus fotos y datos
      const response = await productAPI.getMyProducts();
      const fullProduct = response.find((p) => p.id === id);
      if (fullProduct) {
        setEditModal({ show: true, product: fullProduct });
      }
    } catch {
      showNotification("error", "Error al cargar los datos del producto");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (updatedData) => {
    try {
      setEditLoading(true);
      // Mapear campos del frontend al backend
      const productData = {
        title: updatedData.nombre,
        description: updatedData.descripcion || "",
        price: parseFloat(updatedData.precio),
        categoryId: updatedData.subcategory || updatedData.category, // Usar subcategoría si existe, sino categoría principal
        location: updatedData.location || "",
        locationCoords: updatedData.locationCoords || { lat: null, lng: null },
        status:
          updatedData.estado === "Activo"
            ? "active"
            : updatedData.estado === "Vendido"
            ? "sold"
            : updatedData.estado === "Reservado"
            ? "reserved"
            : "inactive",
      };
      // Preparar todas las fotos para envío (existentes + nuevas)
      let allPhotos = null;
      // Verificar si tenemos fotos existentes o nuevas
      const hasExistingPhotos =
        updatedData.existingPhotos && updatedData.existingPhotos.length > 0;
      const hasNewPhotos = updatedData.images && updatedData.images.length > 0;
      if (hasExistingPhotos || hasNewPhotos) {
        allPhotos = [];
        // Agregar fotos existentes (necesitamos re-enviarlas para que no se eliminen)
        if (hasExistingPhotos) {
          for (const existingPhoto of updatedData.existingPhotos) {
            try {
              // Descargar la foto existente como blob para re-enviarla
              const response = await fetch(existingPhoto.photoUrl);
              const blob = await response.blob();
              const file = new File(
                [blob],
                `existing-${existingPhoto.id}.jpg`,
                { type: "image/jpeg" }
              );
              allPhotos.push(file);
            } catch {
              // Si no podemos obtener la foto existente, continúa sin ella
            }
          }
        }
        // Agregar fotos nuevas
        if (hasNewPhotos) {
          allPhotos.push(...updatedData.images);
        }
      }
      // Llamar a la API para actualizar con TODAS las fotos
      await productAPI.updateProduct(
        editModal.product.id,
        productData,
        allPhotos
      );
      // Cerrar modal y mostrar notificación
      setEditModal({ show: false, product: null });
      showNotification("success", "Producto actualizado exitosamente");
      // Recargar todos los productos para reflejar los cambios (especialmente las fotos actualizadas)
      await reloadProducts();
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login");
      } else if (error.response?.status === 403) {
        showNotification(
          "error",
          "No tienes permisos para editar este producto"
        );
      } else {
        const errorMsg =
          error.response?.data?.message || "Error al actualizar el producto";
        showNotification("error", errorMsg);
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleCloseEdit = () => {
    setEditModal({ show: false, product: null });
  };

  const handleApelar = async (producto) => {
    try {
      // Primero intentar usar las incidencias ya cargadas del producto
      let incidencia = null;

      if (producto.incidences && producto.incidences.length > 0) {
        // Buscar incidencia activa (pending o in_progress)
        incidencia = producto.incidences.find(
          (inc) => inc.status === "pending" || inc.status === "in_progress"
        );

        // Si no hay activa, tomar la más reciente
        if (!incidencia) {
          incidencia = producto.incidences[producto.incidences.length - 1];
        }
      } else {
        // Buscar en todas las incidencias como fallback
        const incidencias = await incidenceAPI.getAll();
        incidencia = incidencias.find(
          (inc) =>
            inc.productId === producto.id &&
            (inc.status === "pending" || inc.status === "in_progress")
        );
      }

      if (!incidencia) {
        showNotification(
          "error",
          "No se encontró una incidencia activa para este producto"
        );
        return;
      }

      // Verificar si ya existe una apelación para esta incidencia
      try {
        const apelaciones = await appealAPI.getAll();
        const apelacionExistente = apelaciones.find(
          (appeal) => appeal.incidenceId === incidencia.id
        );

        if (apelacionExistente) {
          showNotification(
            "warning",
            "Ya has enviado una apelación para este producto. Por favor espera la revisión del moderador."
          );
          return;
        }
      } catch (appealError) {
        console.error("Error verificando apelaciones:", appealError);
        showNotification("error", "Error al verificar apelaciones existentes");
        return;
      }

      setAppealModal({
        show: true,
        product: producto,
        incidenceId: incidencia.id,
      });
    } catch (error) {
      console.error("Error buscando incidencia:", error);
      showNotification(
        "error",
        "Error al cargar la información de la incidencia"
      );
    }
  };

  const handleSubmitAppeal = async (appealData) => {
    try {
      setAppealLoading(true);
      await appealAPI.create({
        incidenceId: appealModal.incidenceId,
        message: appealData.mensaje,
      });

      // Actualizar el estado local del producto para reflejar la apelación pendiente
      setProductos((prev) =>
        prev.map((p) =>
          p.id === appealModal.product.id
            ? { ...p, appealStatus: "pending" }
            : p
        )
      );

      setAppealModal({ show: false, product: null, incidenceId: null });
      showNotification(
        "success",
        "Apelación enviada exitosamente. Será revisada por un moderador."
      );

      // Recargar productos para actualizar el estado desde el servidor
      await reloadProducts();
    } catch (error) {
      console.error("Error enviando apelación:", error);
      showNotification(
        "error",
        error.response?.data?.message || "Error al enviar la apelación"
      );
    } finally {
      setAppealLoading(false);
    }
  };

  const handleCloseAppeal = () => {
    setAppealModal({ show: false, product: null, incidenceId: null });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="sb-container">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando productos...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ordenar productos según el filtro seleccionado
  let productosOrdenados = [...productos];
  if (sortOrder === "asc") {
    productosOrdenados.sort(
      (a, b) => (parseFloat(a.precio) || 0) - (parseFloat(b.precio) || 0)
    );
  } else if (sortOrder === "desc") {
    productosOrdenados.sort(
      (a, b) => (parseFloat(b.precio) || 0) - (parseFloat(a.precio) || 0)
    );
  }

  // Paginación
  const totalPages = Math.ceil(productosOrdenados.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = productosOrdenados.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="sb-container">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Mis Productos</h1>
            <p className="text-gray-600 mt-1">
              Gestiona tus publicaciones ({productos.length} productos)
            </p>
          </div>
          <Link
            to="/vender"
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold flex items-center gap-2 shadow-md"
          >
            <FiPlus className="text-xl" />
            Nuevo Producto
          </Link>
        </div>

        {/* Filtro de ordenamiento por precio */}
        <div className="mb-6 flex flex-row gap-4 items-center">
          <label className="font-semibold text-gray-700">
            Ordenar por precio:
          </label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
          >
            <option value="default">Sin ordenar</option>
            <option value="asc">Menor a mayor</option>
            <option value="desc">Mayor a menor</option>
          </select>
        </div>

        {paginatedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4">
              {paginatedProducts.map((producto) => (
                <div
                  key={producto.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Imagen del producto */}
                    <div className="w-full md:w-32 h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {producto.imagen && producto.imagen.startsWith("http") ? (
                        <img
                          src={producto.imagen}
                          alt={producto.nombre}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full flex items-center justify-center text-6xl ${
                          producto.imagen && producto.imagen.startsWith("http")
                            ? "hidden"
                            : ""
                        }`}
                      >
                        {producto.imagen && producto.imagen.startsWith("http")
                          ? "📦"
                          : producto.imagen}
                      </div>
                    </div>

                    {/* Información del producto */}
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-3">
                        <div>
                          <h3 className="font-bold text-xl text-gray-900 mb-1">
                            {producto.nombre}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {producto.categoria} • Publicado el{" "}
                            {new Date(producto.fecha).toLocaleDateString(
                              "es-EC"
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {/* Estado de moderación tiene prioridad */}
                          {producto.moderationStatus === "suspended" ? (
                            <span className="px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap bg-red-100 text-red-700">
                              Suspendido
                            </span>
                          ) : producto.moderationStatus === "flagged" ? (
                            <span className="px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap bg-red-100 text-red-700">
                              Bloqueado
                            </span>
                          ) : producto.moderationStatus === "review" ? (
                            <span className="px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap bg-orange-100 text-orange-700">
                              En revisión
                            </span>
                          ) : producto.moderationStatus === "block" ? (
                            <span className="px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap bg-red-100 text-red-700">
                              Bloqueado
                            </span>
                          ) : (
                            <span
                              className={`px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${
                                producto.estado === "Activo"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {producto.estado}
                            </span>
                          )}
                          {producto.appealStatus && (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                producto.appealStatus === "pending"
                                  ? "bg-blue-100 text-blue-700"
                                  : producto.appealStatus === "approved"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {producto.appealStatus === "pending"
                                ? "Apelación pendiente"
                                : producto.appealStatus === "approved"
                                ? "Apelación aprobada"
                                : "Apelación rechazada"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 mb-4 flex-wrap">
                        <span className="text-orange-600 font-bold text-2xl">
                          ${producto.precio}
                        </span>
                      </div>

                      {/* Mostrar reportes si el producto tiene incidencias */}
                      {["review", "block", "flagged"].includes(
                        producto.moderationStatus
                      ) &&
                        producto.reports &&
                        producto.reports.length > 0 && (
                          <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
                            <div className="flex items-start gap-2">
                              <FiAlertTriangle className="text-yellow-600 mt-1 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-semibold text-yellow-900 mb-2">
                                  Motivos de revisión:
                                </p>
                                <ul className="space-y-1 text-sm text-yellow-800">
                                  {producto.reports.map((report, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-start gap-2"
                                    >
                                      <span className="text-yellow-600">•</span>
                                      <span>
                                        <strong>{report.typeReport}:</strong>{" "}
                                        {report.description}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                      {/* Botones de acción */}
                      <div className="flex flex-wrap gap-3">
                        {/* Editar: solo si no está bloqueado/suspendido/flagged/en revisión */}
                        {!["block", "suspended", "flagged", "review"].includes(
                          producto.moderationStatus
                        ) && (
                          <button
                            onClick={() => handleEditar(producto.id)}
                            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-semibold"
                          >
                            <FiEdit />
                            Editar
                          </button>
                        )}
                        {/* Apelar: para productos en 'block' O 'review' (cuando hay incidencia activa) */}
                        {["block", "review"].includes(
                          producto.moderationStatus
                        ) &&
                          !producto.appealStatus &&
                          producto.incidences &&
                          producto.incidences.length > 0 && (
                            <button
                              onClick={() => handleApelar(producto)}
                              className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 font-semibold"
                            >
                              <FiFileText />
                              Apelar revisión
                            </button>
                          )}
                        {/* Eliminar: deshabilitado si está bloqueado/suspendido */}
                        <button
                          onClick={() =>
                            handleEliminar(producto.id, producto.nombre)
                          }
                          disabled={["block", "suspended", "flagged"].includes(
                            producto.moderationStatus
                          )}
                          className={`px-5 py-2 rounded-lg transition-colors flex items-center gap-2 font-semibold ${
                            ["block", "suspended", "flagged"].includes(
                              producto.moderationStatus
                            )
                              ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                              : "bg-red-600 text-white hover:bg-red-700"
                          }`}
                          title={
                            ["block", "suspended", "flagged"].includes(
                              producto.moderationStatus
                            )
                              ? "No puedes eliminar un producto bloqueado"
                              : ""
                          }
                        >
                          <FiTrash2 />
                          Eliminar
                        </button>
                        <Link
                          to={`/producto/${producto.id}`}
                          className="px-5 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 font-semibold"
                        >
                          <FiEye />
                          Ver publicación
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Controles de paginación */}
            <div className="flex justify-center mt-8 gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg font-semibold border-2 ${
                  currentPage === 1
                    ? "bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-4 py-2 rounded-lg font-semibold border-2 ${
                    currentPage === i + 1
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg font-semibold border-2 ${
                  currentPage === totalPages
                    ? "bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Siguiente
              </button>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              No tienes productos publicados
            </h3>
            <p className="text-gray-600 mb-6">
              Comienza a vender tus artículos ahora
            </p>
            <Link
              to="/vender"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
            >
              <FiPlus />
              Publicar mi primer producto
            </Link>
          </div>
        )}
      </div>

      {/* Modal de Edición */}
      {editModal.show && (
        <EditProductModal
          product={editModal.product}
          onSave={handleSaveEdit}
          onClose={handleCloseEdit}
          loading={editLoading}
        />
      )}

      {/* Modal de Apelación */}
      {appealModal.show && (
        <AppealModal
          product={appealModal.product}
          onSubmit={handleSubmitAppeal}
          onClose={handleCloseAppeal}
          loading={appealLoading}
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

  // Componente Modal de Edición Completo
  function EditProductModal({ product, onSave, onClose, loading }) {
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [categoriesLoaded, setCategoriesLoaded] = useState(false);
    const [backendCategories, setBackendCategories] = useState([]);
    const [formData, setFormData] = useState({
      nombre: "",
      descripcion: "",
      precio: "",
      category: "",
      subcategory: "",
      estado: "Activo",
      location: "",
      locationCoords: null,
      images: [],
    });

    const handleLocationSelect = (locationData) => {
      setFormData({
        ...formData,
        location: locationData.address,
        locationCoords: { lat: locationData.lat, lng: locationData.lng },
      });
    };

    const handleCategoryChange = (categoryValue) => {
      setFormData({
        ...formData,
        category: String(categoryValue),
        subcategory: "", // Reset subcategory cuando cambia la categoría
      });
    };

    const handleImageUpload = (e) => {
      const files = Array.from(e.target.files);
      const totalImages = formData.images.length + files.length;
      if (totalImages > 10) {
        const allowed = 10 - formData.images.length;
        let newImages = [];
        if (allowed > 0) {
          newImages = files.slice(0, allowed).map((file) => ({
            file: file,
            isExisting: false,
            name: file.name,
            preview: URL.createObjectURL(file),
          }));
          setFormData({
            ...formData,
            images: [...formData.images, ...newImages],
          });
        }
        if (typeof window.showNotification === "function") {
          window.showNotification(
            "error",
            "Solo puedes subir un máximo de 10 imágenes."
          );
        } else {
          alert("Solo puedes subir un máximo de 10 imágenes.");
        }
        return;
      }
      // Convertir archivos File a objetos con isExisting: false
      const newImages = files.map((file) => ({
        file: file,
        isExisting: false,
        name: file.name,
        preview: URL.createObjectURL(file),
      }));
      setFormData({ ...formData, images: [...formData.images, ...newImages] });
    };

    useEffect(() => {
      const loadData = async () => {
        try {
          // Cargar todas las categorías del backend (estructura plana)
          const allCategories = await categoryAPI.getAll();
          // Separar categorías principales (parentCategoryId === null) de subcategorías
          const mainCategories = allCategories.filter(
            (cat) => cat.parentCategoryId === null
          );
          const subcategories = allCategories.filter(
            (cat) => cat.parentCategoryId !== null
          );
          // Agrupar subcategorías por su categoría padre
          const categoriesWithSubs = mainCategories.map((mainCat) => ({
            ...mainCat,
            subcategories: subcategories.filter(
              (sub) => sub.parentCategoryId === mainCat.id
            ),
          }));
          setBackendCategories(categoriesWithSubs);
          setCategoriesLoaded(true);
          if (product && allCategories.length > 0) {
            // Determinar categoría y subcategoría basado en categoryId
            let selectedCategory = null;
            let selectedSubcategory = null;
            // Buscar la categoría del producto en todas las categorías (principales y subcategorías)
            const productCategory = allCategories.find(
              (cat) => String(cat.id) === String(product.categoryId)
            );
            if (productCategory) {
              if (productCategory.parentCategoryId) {
                // Es una subcategoría - usar parentCategoryId como categoría principal
                selectedSubcategory = String(productCategory.id);
                selectedCategory = String(productCategory.parentCategoryId);
              } else {
                // Es una categoría principal
                selectedCategory = String(productCategory.id);
                selectedSubcategory = "";
              }
            }
            // Parsear locationCoords si viene como string
            let locationCoords = null;
            if (product.locationCoords) {
              try {
                locationCoords =
                  typeof product.locationCoords === "string"
                    ? JSON.parse(product.locationCoords)
                    : product.locationCoords;
              } catch {
                // Si falla el parseo, dejar locationCoords como null
              }
            }
            // Actualizar formData con los datos del producto
            const newFormData = {
              nombre: product.title || "",
              descripcion: product.description || "",
              precio: product.price || "",
              category: selectedCategory || "",
              subcategory: selectedSubcategory || "",
              estado:
                product.status === "active"
                  ? "Activo"
                  : product.status === "sold"
                  ? "Vendido"
                  : product.status === "reserved"
                  ? "Reservado"
                  : "Inactivo",
              location: product.location || "",
              locationCoords: locationCoords,
              images: [],
            };
            setFormData(newFormData);
            // Cargar TODAS las fotos existentes directamente en el array de imágenes
            if (product.ProductPhotos && product.ProductPhotos.length > 0) {
              const existingImages = product.ProductPhotos.map((photo) => ({
                id: photo.id,
                photoUrl: photo.url.startsWith("http")
                  ? photo.url
                  : `${API_BASE_URL}${photo.url}`,
                isExisting: true,
                name: `existing-photo-${photo.id}.jpg`, // Nombre para mostrar
              }));
              // Cargar las fotos existentes directamente en el formData
              setFormData((prev) => ({ ...prev, images: existingImages }));
            }
          }
        } catch {
          // Si hay error cargando datos del modal, no hacer nada especial
        }
      };

      loadData();
    }, [product]);

    const handleSubmit = (e) => {
      e.preventDefault();

      // Validaciones básicas
      if (!formData.nombre.trim()) {
        showNotification(
          "error",
          "Por favor ingresa un nombre para el producto"
        );
        return;
      }
      if (!formData.precio || parseFloat(formData.precio) <= 0) {
        showNotification("error", "Por favor ingresa un precio válido");
        return;
      }

      // Separar fotos existentes de nuevas fotos
      const existingPhotos = formData.images.filter((img) => img.isExisting);
      const newPhotos = formData.images
        .filter((img) => !img.isExisting)
        .map((img) => img.file || img);

      onSave({
        nombre: formData.nombre,
        precio: parseFloat(formData.precio),
        estado: formData.estado,
        descripcion: formData.descripcion,
        category: formData.category,
        subcategory: formData.subcategory,
        location: formData.location,
        locationCoords: formData.locationCoords,
        images: newPhotos, // Solo las nuevas fotos
        existingPhotos: existingPhotos, // Las fotos que se mantienen
      });
    };

    const selectedCategoryData = backendCategories.find(
      (cat) => String(cat.id) === String(formData.category)
    );
    const subcategories = selectedCategoryData
      ? selectedCategoryData.subcategories
      : [];

    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop con efecto vidrioso */}
          <div
            className="absolute inset-0 backdrop-blur-sm bg-black/20"
            onClick={onClose}
          ></div>

          {/* Modal Content */}
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-3xl z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                Editar Producto
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiX className="text-xl text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              {/* Nombre del producto */}
              <div className="mb-6">
                <label className="block text-lg font-bold text-gray-900 mb-2">
                  Nombre del producto *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:outline-none transition-colors"
                  placeholder="Ej: iPhone 14 Pro Max..."
                />
              </div>

              {/* Descripción */}
              <div className="mb-6">
                <label className="block text-lg font-bold text-gray-900 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                  rows="4"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:outline-none transition-colors resize-none"
                  placeholder="Describe tu producto, estado, características..."
                />
              </div>

              {/* Precio y Estado en una fila */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Precio */}
                <div>
                  <label className="block text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <FiDollarSign className="text-orange-500" />
                    Precio *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.precio}
                    onChange={(e) =>
                      setFormData({ ...formData, precio: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:outline-none transition-colors"
                    placeholder="0.00"
                  />
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-lg font-bold text-gray-900 mb-2">
                    Estado del producto
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) =>
                      setFormData({ ...formData, estado: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:outline-none transition-colors"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Vendido">Vendido</option>
                    <option value="Reservado">Reservado</option>
                  </select>
                </div>
              </div>

              {/* Ubicación */}
              <div className="mb-6">
                <label className="block text-lg font-bold text-gray-900 mb-2">
                  Ubicación
                </label>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(true)}
                  className="w-full p-4 border-2 border-gray-300 rounded-xl text-left hover:border-orange-500 transition-colors flex items-center justify-between"
                >
                  <span className="text-gray-700">
                    {formData.location
                      ? formData.location
                      : "Seleccionar ubicación"}
                  </span>
                  <FiMapPin className="text-gray-400" />
                </button>
              </div>

              {/* Categoría */}
              <div className="mb-6">
                <label className="block text-lg font-bold text-gray-900 mb-4">
                  Categoría
                </label>
                {!categoriesLoaded ? (
                  <div className="text-center py-4 text-gray-500">
                    Cargando categorías...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {backendCategories.map((cat) => {
                      const Icon = MAIN_CATEGORY_ICONS[cat.name] || FiTag;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleCategoryChange(cat.id)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            formData.category === String(cat.id)
                              ? "border-orange-500 bg-orange-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <Icon className="text-2xl mx-auto mb-2 text-orange-500" />
                          <span className="text-sm font-semibold">
                            {cat.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Subcategoría */}
              {subcategories.length > 0 && (
                <div className="mb-6">
                  <label className="block text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <FiTag className="text-orange-500" />
                    Subcategoría
                  </label>
                  <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
                    <div className="flex flex-wrap gap-3">
                      {subcategories.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              subcategory: String(sub.id),
                            })
                          }
                          className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            formData.subcategory === String(sub.id)
                              ? "bg-orange-500 text-white"
                              : "bg-white border-2 border-gray-300 text-gray-700 hover:border-orange-300"
                          }`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Imágenes del producto */}
              <div className="mb-6">
                <label className="block text-lg font-bold text-gray-900 mb-2">
                  Imágenes del producto
                </label>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-orange-500 transition-colors">
                  <FiUpload className="text-4xl text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-3">
                    Arrastra tus imágenes aquí o haz clic para seleccionar
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload-edit"
                  />
                  <label
                    htmlFor="image-upload-edit"
                    className="inline-block px-6 py-2 bg-gray-900 text-white rounded-lg font-semibold cursor-pointer hover:bg-gray-800 transition-colors"
                  >
                    Seleccionar imágenes
                  </label>
                  {formData.images.length > 0 && (
                    <p className="mt-3 text-sm text-gray-600">
                      {formData.images.length} imagen(es) seleccionada(s)
                    </p>
                  )}
                </div>

                {/* Vista previa de imágenes (existentes y nuevas) */}
                {formData.images.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-md font-semibold text-gray-800 mb-3">
                      Fotos del producto ({formData.images.length}):
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {formData.images.map((image, index) => (
                        <div
                          key={
                            image.isExisting
                              ? `existing-${image.id}`
                              : `new-${index}`
                          }
                          className="relative group"
                        >
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={
                                image.isExisting
                                  ? image.photoUrl
                                  : image.preview ||
                                    URL.createObjectURL(image.file || image)
                              }
                              alt={`Foto ${index + 1}`}
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
                          {image.isExisting && (
                            <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                              Actual
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-4 pt-4 border-t border-gray-200">
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
                  className={`flex-1 px-6 py-3 text-white rounded-xl font-bold transition-opacity shadow-lg flex items-center justify-center gap-2 ${
                    loading
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:opacity-90"
                  }`}
                  style={{ backgroundColor: "#CF5C36" }}
                >
                  <FiSave />
                  {loading ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* LocationPicker Modal */}
        {showLocationPicker && (
          <LocationPicker
            onLocationSelect={handleLocationSelect}
            onClose={() => setShowLocationPicker(false)}
          />
        )}
      </>
    );
  }

  // Componente Modal de Apelación
  function AppealModal({ product, onSubmit, onClose, loading }) {
    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e) => {
      e.preventDefault();

      if (!mensaje.trim()) {
        setError(
          "Por favor, explica por qué consideras que el bloqueo es injusto"
        );
        return;
      }

      if (mensaje.trim().length < 20) {
        setError("El mensaje debe tener al menos 20 caracteres");
        return;
      }

      onSubmit({ mensaje: mensaje.trim() });
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 backdrop-blur-sm bg-black/20"
          onClick={onClose}
        ></div>

        {/* Modal Content */}
        <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Apelar Bloqueo
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Producto: {product.nombre}
              </p>

              <p className="text-sm text-gray-600 mt-1">
                {(() => {
                  const desc = product.incidences?.[0]?.description || "";
                  const tag = desc.match(/\(([^)]+)\)/)?.[1]; // extrae "producto_falso"
                  return `Tipo de Reporte: ${tag || "Sin descripción"}`;
                })()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiX className="text-xl text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Información */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
              <div className="flex items-start">
                <FiAlertCircle className="text-blue-500 text-xl mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">
                    Información sobre apelaciones
                  </h3>
                  <p className="text-sm text-blue-800">
                    Tu producto ha sido bloqueado por violar nuestras políticas.
                    Si consideras que este bloqueo es injusto, puedes presentar
                    una apelación explicando tu situación. Un moderador revisará
                    tu caso.
                  </p>
                  <p className="text-sm text-blue-900 font-semibold mt-2">
                    ⚠️ Solo puedes enviar UNA apelación por producto. Asegúrate
                    de explicar claramente tu caso.
                  </p>
                </div>
              </div>
            </div>

            {/* Campo de mensaje */}
            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-900 mb-2">
                Explica tu situación *
              </label>
              <textarea
                value={mensaje}
                onChange={(e) => {
                  setMensaje(e.target.value);
                  setError("");
                }}
                rows="6"
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-colors resize-none ${
                  error
                    ? "border-red-500 focus:border-red-500"
                    : "border-gray-300 focus:border-purple-500"
                }`}
                placeholder="Explica detalladamente por qué consideras que el bloqueo de tu producto es injusto. Incluye toda la información relevante que pueda ayudar al moderador a entender tu caso..."
              />
              {error && (
                <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                  <FiAlertCircle />
                  {error}
                </p>
              )}
              <p className="text-gray-500 text-sm mt-2">
                Mínimo 20 caracteres ({mensaje.length}/20)
              </p>
            </div>

            {/* Advertencia */}
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded">
              <div className="flex items-start">
                <FiAlertCircle className="text-yellow-600 text-xl mt-0.5 mr-3 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  <strong>Importante:</strong> Las apelaciones falsas o que no
                  cumplan con nuestras políticas pueden resultar en sanciones
                  adicionales. Sé honesto y específico en tu explicación.
                </p>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold transition-opacity shadow-lg flex items-center justify-center gap-2 ${
                  loading
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-purple-700"
                }`}
              >
                <FiFileText />
                {loading ? "Enviando..." : "Enviar Apelación"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}

export default MisProductosPage;
