
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiChevronRight, FiTrendingUp } from 'react-icons/fi';
import { HiDevicePhoneMobile, HiShoppingBag, HiHomeModern, HiTrophy, HiTruck } from 'react-icons/hi2';
import { IoGameController } from 'react-icons/io5';
import { categoryAPI } from '../services/api';

function CategoriasPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const backendCategories = await categoryAPI.getMain();
        // Mapeo de categorías principales con íconos
        const MAIN_CATEGORY_CONFIG = [
          { name: 'Electrónica', Icon: HiDevicePhoneMobile },
          { name: 'Moda', Icon: HiShoppingBag },
          { name: 'Hogar y muebles', Icon: HiHomeModern },
          { name: 'Deportes', Icon: HiTrophy },
          { name: 'Vehículos', Icon: HiTruck },
          { name: 'Gaming', Icon: IoGameController },
        ];
        const mappedCategories = MAIN_CATEGORY_CONFIG
          .map(cfg => {
            const cat = backendCategories.find(cat => cat.name.trim().toLowerCase() === cfg.name.trim().toLowerCase());
            return cat ? { ...cat, Icon: cfg.Icon } : null;
          })
          .filter(Boolean);
        setCategories(mappedCategories);
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Simuladas, puedes reemplazar por trending real si lo tienes
  const trendingCategories = [
    { name: 'Celulares iPhone', count: 2345 },
    { name: 'Laptops Gaming', count: 1890 },
    { name: 'Muebles de Sala', count: 1567 },
    { name: 'Bicicletas', count: 1234 },
    { name: 'PlayStation', count: 1123 },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EEE5E9' }}>
      {/* Hero Section */}
      <section className="bg-white py-16">
        <div className="sb-container text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full mb-6">
            <FiTrendingUp className="text-xl" style={{ color: '#CF5C36' }} />
            <span className="text-sm font-bold" style={{ color: '#CF5C36' }}>EXPLORA POR CATEGORÍA</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            Todas las categorías
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Encuentra exactamente lo que buscas navegando por nuestras categorías populares
          </p>
        </div>
      </section>

      {/* Categorías Principales */}
      <section className="py-16">
        <div className="sb-container">
          {loading ? (
            <div className="text-center text-gray-500 text-xl py-20">Cargando categorías...</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="group bg-white rounded-3xl p-8 shadow-sm hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
                >
                  <div className="flex items-start gap-6 mb-6">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform bg-orange-50"
                    >
                      {category.Icon ? (
                        <category.Icon className="text-4xl text-orange-500" />
                      ) : (
                        <FiTrendingUp className="text-4xl" style={{ color: '#CF5C36' }} />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black text-gray-900 mb-2 group-hover:scale-105 transition-transform">
                        {category.name}
                      </h3>
                      <p className="text-sm font-medium text-orange-600">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {category.subcategories && category.subcategories.length > 0 && category.subcategories.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => navigate(`/productos?categoryId=${category.id}&subcategory=${sub.id}`)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => navigate(`/productos?categoryId=${category.id}`)}
                    className="inline-flex items-center gap-2 text-sm font-bold group-hover:gap-3 transition-all text-orange-600"
                  >
                    Ver productos
                    <FiChevronRight className="text-lg" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Categorías Trending */}
      <section className="py-16 bg-white">
        <div className="sb-container">
          <h2 className="text-3xl font-black text-gray-900 mb-8 text-center">
            🔥 Categorías más buscadas
          </h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {trendingCategories.map((cat, index) => (
              <Link
                key={index}
                to={`/productos?search=${encodeURIComponent(cat.name)}`}
                className="group bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-6 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <p className="font-bold text-gray-900 mb-2 group-hover:scale-105 transition-transform">
                  {cat.name}
                </p>
                <p className="text-sm text-gray-600">{cat.count} productos</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16">
        <div className="sb-container">
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 rounded-3xl p-12 text-center text-white">
            <h2 className="text-3xl lg:text-4xl font-black mb-4">
              ¿No encuentras lo que buscas?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Publica tu producto de forma gratuita y llegá a miles de compradores
            </p>
            <Link
              to="/vender"
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 font-bold rounded-2xl hover:shadow-2xl transition-all transform hover:-translate-y-1"
            >
              Publicar gratis
              <FiChevronRight className="text-xl" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CategoriasPage;
