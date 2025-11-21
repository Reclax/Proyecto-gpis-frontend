import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

// Componentes
import Header from "./components/common/Header";
import Footer from "./components/common/Footer";
import ScrollToTop from "./components/common/ScrollToTop";
import ProtectedRoute from "./components/common/ProtectedRoute";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProductosPage from "./pages/ProductosPage";
import VenderPage from "./pages/VenderPage";
import CategoriasPage from "./pages/CategoriasPage";
import ProductoDetallePage from "./pages/ProductoDetallePage";
import ChatPage from "./pages/ChatPage";
import MiPerfilPage from "./pages/MiPerfilPage";
import MisProductosPage from "./pages/MisProductosPage";
import NotificacionesPage from "./pages/NotificacionesPage";
import FavoritosPage from "./pages/FavoritosPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import GestionUsuariosPage from "./pages/GestionUsuariosPage";
import GestionIncidenciasPage from "./pages/GestionIncidenciasPage";
import RegistroModeradorPage from "./pages/RegistroModeradorPage";
import GestionProductosPage from "./pages/GestionProductosPage";

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Main />
    </Router>
  );
}

function Main() {
  const location = useLocation();

  // Páginas donde no se muestra Header y Footer
  const excludedPages = ["/login", "/register"];

  // Ya no excluir chat del header y footer
  const shouldExcludeNavigation = excludedPages.includes(location.pathname);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header condicional */}
      {!shouldExcludeNavigation && <Header />}

      {/* Rutas */}
      <main>
        <Routes>
          {/* Rutas públicas - accesibles sin autenticación */}
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="/producto/:id" element={<ProductoDetallePage />} />
          <Route path="/categorias" element={<CategoriasPage />} />

          {/* Rutas protegidas - requieren autenticación */}
          <Route
            path="/vender"
            element={
              <ProtectedRoute>
                <VenderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute denyRoles={["Administrador", "Moderador"]}>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:vendorId"
            element={
              <ProtectedRoute denyRoles={["Administrador", "Moderador"]}>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mi-perfil"
            element={
              <ProtectedRoute>
                <MiPerfilPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mis-productos"
            element={
              <ProtectedRoute>
                <MisProductosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notificaciones"
            element={
              <ProtectedRoute>
                <NotificacionesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favoritos"
            element={
              <ProtectedRoute>
                <FavoritosPage />
              </ProtectedRoute>
            }
          />

          {/* Rutas de Administración - autenticación y rol Administrador requerido */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["Administrador", "Moderador"]}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["Administrador", "Moderador"]}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/usuarios"
            element={
              <ProtectedRoute allowedRoles={["Administrador", "Moderador"]}>
                <GestionUsuariosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/incidencias"
            element={
              <ProtectedRoute allowedRoles={["Administrador", "Moderador"]}>
                <GestionIncidenciasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/moderadores"
            element={
              <ProtectedRoute allowedRoles={["Administrador", "Moderador"]}>
                <RegistroModeradorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/productos"
            element={
              <ProtectedRoute allowedRoles={["Administrador", "Moderador"]}>
                <GestionProductosPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {/* Footer condicional */}
      {!shouldExcludeNavigation && <Footer />}
    </div>
  );
}

export default App;
