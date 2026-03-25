/**
 * PunchLocationMap — renders clock-in and/or clock-out pins on a Leaflet map.
 * Used inside TimeEntryDetail for admin users.
 */
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons broken by webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ positions }) {
  const map = useMap();
  React.useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], 15);
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [40, 40] });
    }
  }, [positions.join(',')]);
  return null;
}

export default function PunchLocationMap({ entry }) {
  const pins = [];
  if (entry.punch_in_lat && entry.punch_in_lng) {
    pins.push({ lat: entry.punch_in_lat, lng: entry.punch_in_lng, label: 'Clock In', icon: greenIcon, dist: entry.punch_in_distance_miles, flagged: entry.punch_in_flagged });
  }
  if (entry.punch_out_lat && entry.punch_out_lng) {
    pins.push({ lat: entry.punch_out_lat, lng: entry.punch_out_lng, label: 'Clock Out', icon: redIcon, dist: entry.punch_out_distance_miles, flagged: entry.punch_out_flagged });
  }

  if (pins.length === 0) return null;

  const center = pins[0] ? [pins[0].lat, pins[0].lng] : [34, -80];
  const positions = pins.map(p => [p.lat, p.lng]);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Punch Locations</p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Clock In</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Clock Out</span>
        </div>
      </div>
      <div style={{ height: 280 }}>
        <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          <FitBounds positions={positions} />
          {pins.map((p, i) => (
            <Marker key={i} position={[p.lat, p.lng]} icon={p.icon}>
              <Popup>
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold">{p.label}</p>
                  {p.dist != null && (
                    <p className={p.flagged ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {p.dist} mi from jobsite{p.flagged ? ' ⚠️' : ''}
                    </p>
                  )}
                  <p className="text-gray-400">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}