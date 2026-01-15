const repo = require("./attendanceRepo");

exports.validate = async (req)=>{
  const lat = parseFloat(req.body.latitude);
  const lng = parseFloat(req.body.longitude);

  // cek NaN
  if(isNaN(lat) || isNaN(lng)) return false;

  const office = await repo.getOffice(req.user.company_id);
  if(!office) return false;

  // ===== DEBUG LOG DI SINI =====
  console.log("User lat/lng:", lat, lng);
  console.log("Office lat/lng/radius:", office.latitude, office.longitude, office.radius);

  const distance = haversine(lat,lng,office.latitude, office.longitude);

  // ===== DEBUG LOG JUGA DI SINI =====
  console.log("Distance (m):", distance, "Radius (m):", office.radius*1000);

  return distance <= (office.radius*1000); // office.radius sekarang dalam km
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meter
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}
