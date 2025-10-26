import { useEffect, useRef } from 'react';

export const useMessageVisibility = (messages, onMessageVisible) => {
  const observerRef = useRef(null);
  const messageRefs = useRef(new Map());

  useEffect(() => {
    if (!onMessageVisible) return;

    // Crear intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.dataset.messageId;
            const messageStatus = entry.target.dataset.messageStatus;
            
            // Solo marcar como visto mensajes que no son propios y que no están ya vistos
            if (messageId && messageStatus !== 'read') {
              onMessageVisible(messageId);
            }
          }
        });
      },
      {
        threshold: 0.5, // 50% del mensaje debe estar visible
        rootMargin: '0px'
      }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onMessageVisible]);

  // Función para registrar una referencia de mensaje
  const setMessageRef = (messageId, element) => {
    if (element) {
      messageRefs.current.set(messageId, element);
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    } else {
      // Limpiar referencia si el elemento se desmonta
      const oldElement = messageRefs.current.get(messageId);
      if (oldElement && observerRef.current) {
        observerRef.current.unobserve(oldElement);
      }
      messageRefs.current.delete(messageId);
    }
  };

  return { setMessageRef };
};

export default useMessageVisibility;