import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FiMapPin, FiNavigation, FiX } from 'react-icons/fi';

// Fix para los iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Componente para actualizar el centro del mapa
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], 15, {
        animate: true,
        duration: 1
      });
    }
  }, [center, map]);
  return null;
}

// Componente para manejar clics en el mapa
function LocationMarker({ position, setPosition, setAddress }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      // Obtener dirección usando Nominatim (OpenStreetMap)
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}&zoom=18&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
          const address = data.address;
          let displayAddress = '';

          if (address.road) {
            displayAddress = address.road;
            if (address.house_number) displayAddress = `${address.road} ${address.house_number}`;
          } else if (address.neighbourhood) {
            displayAddress = address.neighbourhood;
          } else if (address.suburb) {
            displayAddress = address.suburb;
          }

          if (address.city) displayAddress += `, ${address.city}`;
          else if (address.town) displayAddress += `, ${address.town}`;
          else if (address.village) displayAddress += `, ${address.village}`;

          if (address.country) displayAddress += `, ${address.country}`;

          setAddress(displayAddress || data.display_name);
        })
        .catch(() => {
          // Error obteniendo dirección
          setAddress(`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
        });
    },
  });

  return position ? <Marker position={position} /> : null;
}

function LocationPicker({ onLocationSelect, onClose, initialPosition = null }) {
  const [position, setPosition] = useState(initialPosition || { lat: -0.1807, lng: -78.4678 }); // Quito por defecto
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState(initialPosition || { lat: -0.1807, lng: -78.4678 });

  const getCurrentLocation = () => {
    setLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          setPosition(newPos);
          setMapCenter(newPos);

          // Obtener dirección
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPos.lat}&lon=${newPos.lng}&zoom=18&addressdetails=1`)
            .then(res => res.json())
            .then(data => {
              const addr = data.address;
              let displayAddress = '';

              if (addr.road) {
                displayAddress = addr.road;
                if (addr.house_number) displayAddress = `${addr.road} ${addr.house_number}`;
              } else if (addr.neighbourhood) {
                displayAddress = addr.neighbourhood;
              } else if (addr.suburb) {
                displayAddress = addr.suburb;
              }

              if (addr.city) displayAddress += `, ${addr.city}`;
              else if (addr.town) displayAddress += `, ${addr.town}`;
              else if (addr.village) displayAddress += `, ${addr.village}`;

              setAddress(displayAddress || data.display_name);
              setLoading(false);
            })
            .catch(() => {
              setLoading(false);
            });
        },
        () => {
          // Error obteniendo ubicación
          alert('No se pudo obtener tu ubicación. Por favor, selecciona manualmente en el mapa.');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Tu navegador no soporta geolocalización');
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (position && address) {
      onLocationSelect({
        lat: position.lat,
        lng: position.lng,
        address: address
      });
      onClose();
    } else {
      alert('Por favor, selecciona una ubicación en el mapa');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Selecciona tu ubicación</h2>
            <p className="text-gray-600 mt-1">Haz clic en el mapa o usa tu ubicación actual</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="text-2xl text-gray-600" />
          </button>
        </div>

        {/* Dirección seleccionada */}
        {address && (
          <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex-shrink-0">
            <div className="flex items-start gap-3">
              <FiMapPin className="text-orange-500 text-xl mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">Ubicación seleccionada:</p>
                <p className="text-gray-700">{address}</p>
              </div>
            </div>
          </div>
        )}

        {/* Mapa */}
        <div className="flex-1 relative min-h-[400px]">
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={13}
            style={{ height: '100%', width: '100%', minHeight: '400px' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ChangeMapView center={mapCenter} />
            <LocationMarker position={position} setPosition={setPosition} setAddress={setAddress} />
          </MapContainer>

          {/* Botón de ubicación actual */}
          <button
            onClick={getCurrentLocation}
            disabled={loading}
            className="absolute top-4 right-4 bg-white p-3 rounded-xl shadow-lg hover:bg-gray-50 transition-colors z-[1000] disabled:opacity-50"
            title="Usar mi ubicación actual"
          >
            <FiNavigation className={`text-xl ${loading ? 'animate-spin' : ''}`} style={{ color: '#CF5C36' }} />
          </button>
        </div>

        {/* Footer con botones */}
        <div className="p-6 border-t border-gray-200 flex gap-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!position || !address}
            className="flex-1 px-6 py-3 text-white rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#CF5C36' }}
          >
            Confirmar ubicación
          </button>
        </div>
      </div>
    </div>
  );
}

export default LocationPicker;
