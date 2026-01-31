const officeRepo = require("../companies/officesRepo");


/**
 * Menghitung jarak antara dua titik koordinat (Haversine Formula)
 * @returns {Object} { inside: boolean, distance: number (meters) }
 */
exports.checkWithOffice = (office, userLat, userLng) => {
  if (!office || typeof office.latitude !== 'number' || typeof office.longitude !== 'number') {
    throw new Error("Data lokasi kantor tidak valid");
  }

  const R = 6371e3;
  const toRad = (val) => (val * Math.PI) / 180;

  const lat1 = toRad(office.latitude);
  const lat2 = toRad(userLat);
  const dLat = toRad(userLat - office.latitude);
  const dLon = toRad(userLng - office.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return {
    inside: distance <= office.radius,
    distance: Math.round(distance),
  };
};

// function haversine(lat1, lon1, lat2, lon2) {
//   const R = 6371000;
//   const toRad = x => x * Math.PI / 180;
//   const dLat = toRad(lat2 - lat1);
//   const dLon = toRad(lon2 - lon1);
//   const a =
//     Math.sin(dLat/2)**2 +
//     Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//   return R * c;
// }
