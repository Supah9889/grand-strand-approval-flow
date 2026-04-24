/**
 * Geolocation utilities for time clock punch tracking.
 * All functions are non-throwing — failures are returned as status strings.
 */

/**
 * Assemble a full formatted address string from structured job fields.
 * Falls back gracefully to whatever is available.
 * Returns null if nothing useful is present.
 */
export function assembleAddress(job) {
  if (!job) return null;
  const parts = [job.address, job.city, job.state && job.zip ? `${job.state} ${job.zip}` : (job.state || job.zip)].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Request the device's current position.
 * Returns { lat, lng, accuracy_meters, status }
 *   status: 'captured' | 'denied' | 'unavailable'
 */
export async function captureLocation() {
  if (!navigator.geolocation) {
    return { lat: null, lng: null, accuracy_meters: null, status: 'unavailable' };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_meters: Math.round(pos.coords.accuracy),
        status: 'captured',
      }),
      (err) => resolve({
        lat: null,
        lng: null,
        accuracy_meters: null,
        status: err.code === 1 ? 'denied' : 'unavailable',
      }),
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  });
}

/**
 * Geocode a job address string to { lat, lng } using the free Nominatim API.
 * Returns null if geocoding fails.
 */
export async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // Ignore geocoding failures
  }
  return null;
}

/**
 * Haversine distance between two lat/lng points.
 * Returns distance in miles, rounded to 2 decimal places.
 */
export function calculateDistanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Full punch geo check:
 *   1. Capture location
 *   2. Geocode job address
 *   3. Calculate distance
 *   4. Determine if outside threshold
 *
 * Returns geo payload to merge into TimeEntry update/create:
 * {
 *   [prefix]_lat, [prefix]_lng, [prefix]_accuracy_meters,
 *   [prefix]_location_status,  // 'captured' | 'denied' | 'unavailable'
 *   [prefix]_distance_miles,   // null if not available
 *   [prefix]_flagged,          // true if outside threshold
 * }
 */
export async function runPunchGeoCheck(jobAddress, thresholdMiles, prefix = 'punch_in') {
  const loc = await captureLocation();

  const payload = {
    [`${prefix}_lat`]: loc.lat,
    [`${prefix}_lng`]: loc.lng,
    [`${prefix}_accuracy_meters`]: loc.accuracy_meters,
    [`${prefix}_location_status`]: loc.status,
    [`${prefix}_distance_miles`]: null,
    [`${prefix}_flagged`]: false,
  };

  if (loc.status !== 'captured' || !jobAddress) return payload;

  const jobCoords = await geocodeAddress(jobAddress);
  if (!jobCoords) return payload;

  const dist = calculateDistanceMiles(loc.lat, loc.lng, jobCoords.lat, jobCoords.lng);
  payload[`${prefix}_distance_miles`] = dist;
  payload[`${prefix}_flagged`] = dist > (thresholdMiles || 0.25);

  return payload;
}

/**
 * Send an out-of-range alert email via the base44 SendEmail integration.
 */
export async function sendGeoAlert({ base44Client, toEmail, employeeName, punchType, jobAddress, distanceMiles, timestamp }) {
  if (!toEmail) return;
  const timeStr = new Date(timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const subject = `⚠️ Out-of-Range Punch — ${employeeName} (${punchType})`;
  const body = `
<p>A punch was recorded outside the allowed distance from the job site.</p>
<table style="border-collapse:collapse;font-size:14px;">
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Employee</td><td><strong>${employeeName}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Event</td><td>${punchType}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Date / Time</td><td>${timeStr}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Job Site</td><td>${jobAddress || '—'}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Distance from Job</td><td><strong style="color:#dc2626;">${distanceMiles} miles</strong></td></tr>
</table>
<p style="color:#999;font-size:12px;margin-top:16px;">Review this entry in the Time Entries section of the app.</p>
  `.trim();

  await base44Client.integrations.Core.SendEmail({
    to: toEmail,
    subject,
    body,
  });
}