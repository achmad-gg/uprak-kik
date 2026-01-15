const repo = require("./attendanceRepo");

exports.checkLocation = async (companyId, lat, lng) => {
  console.log("CHECK GEO:", {
  companyId,
  lat,
  lng
});

  if (isNaN(lat) || isNaN(lng)) throw "Invalid coordinates";

  const office = await repo.getOffice(companyId);
  if (!office) throw "Office not found";

  const dist = haversine(lat, lng, office.latitude, office.longitude);

  return { office, dist, inside: dist <= office.radius * 1000 };
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
