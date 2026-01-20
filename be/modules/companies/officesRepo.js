// modules/companies/officeRepo.js
const db = require("../../config/db");

/* =======================
   OFFICE LOCATION
======================= */

// 1 company = 1 office (untuk sekarang)
exports.setOffice = (companyId, lat, lng, radius) => {
  return db.query(`
    INSERT INTO office_locations
      (company_id, latitude, longitude, radius)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (company_id)
    DO UPDATE SET
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      radius = EXCLUDED.radius,
      updated_at = NOW()
    RETURNING *
  `, [companyId, lat, lng, radius]);
};

exports.getOfficeByCompany = async (companyId) => {
  const r = await db.query(
    `SELECT * FROM office_locations 
     WHERE company_id = $1 AND active = true
     LIMIT 1`,
    [companyId]
  );

  return r.rows[0]; // 🔥 WAJIB
};


