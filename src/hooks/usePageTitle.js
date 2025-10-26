import { useEffect } from 'react';

/**
 * Hook para cambiar el título de la página dinámicamente
 * @param {string} title - El título específico de la página
 * @param {string} suffix - Sufijo opcional (por defecto: "Shop&Buy")
 */
export const usePageTitle = (title, suffix = 'Shop&Buy') => {
  useEffect(() => {
    const previousTitle = document.title;
    
    if (title) {
      document.title = `${title} - ${suffix}`;
    } else {
      document.title = `🛒 ${suffix} - Compra y Vende Fácil`;
    }

    // Cleanup: restaurar título anterior al desmontar
    return () => {
      document.title = previousTitle;
    };
  }, [title, suffix]);
};

export default usePageTitle;