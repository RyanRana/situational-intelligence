import { S } from './state.js';
import { hav } from './utils.js';

export function acquireLoc() {
  if (!navigator.geolocation || S.locWatch !== null) return;
  S.locWatch = navigator.geolocation.watchPosition(
    p => {
      S.myLoc = { lat: p.coords.latitude, lng: p.coords.longitude };
      document.getElementById('lT').textContent = `${S.myLoc.lat.toFixed(5)}, ${S.myLoc.lng.toFixed(5)}`;
      if (!S.hospital) findHosp();
      findStations();
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 120000, timeout: 15000 }
  );
}

async function findHosp() {
  if (!S.myLoc) return;
  try {
    const q = `[out:json];node["amenity"="hospital"](around:8000,${S.myLoc.lat},${S.myLoc.lng});out 1;`;
    const r = await (await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)).json();
    if (r.elements?.length) {
      const h = r.elements[0];
      S.hospital = { name: h.tags?.name || 'Hospital', lat: h.lat, lon: h.lon, dist: hav(S.myLoc.lat, S.myLoc.lng, h.lat, h.lon) };
      document.getElementById('hT').textContent = `⚕ ${S.hospital.name} (${S.hospital.dist.toFixed(1)}km)`;
    }
  } catch (e) { /* ignore */ }
}

async function findStations() {
  if (!S.myLoc || S.nearbyStations.fetched) return;
  S.nearbyStations.fetched = true;
  try {
    const q = `[out:json];(node["amenity"="fire_station"](around:10000,${S.myLoc.lat},${S.myLoc.lng});node["amenity"="police"](around:10000,${S.myLoc.lat},${S.myLoc.lng}););out 5;`;
    const r = await (await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)).json();
    r.elements?.forEach(e => {
      const type = e.tags?.amenity === 'fire_station' ? 'FIRE' : 'POLICE';
      if (!S.nearbyStations[type]) S.nearbyStations[type] = [];
      S.nearbyStations[type].push({ name: e.tags?.name || type + ' Station', lat: e.lat, lon: e.lon });
    });
    if (S.hospital) S.nearbyStations.EMS = [{ name: S.hospital.name, lat: S.hospital.lat, lon: S.hospital.lon }];
  } catch (e) { /* ignore */ }
}

export function locStr() {
  return S.myLoc ? `${S.myLoc.lat.toFixed(5)}, ${S.myLoc.lng.toFixed(5)}${S.hospital ? ' | ' + S.hospital.name : ''}` : '';
}
