const db = require("../../config/db");

/* =======================
   OFFICE LOCATION
======================= */

exports.getByCompanyId = async (companyId) => {
  const result = await db.query(
    "SELECT * FROM office_locations WHERE company_id = $1 LIMIT 1",
    [companyId]
  );
  return result.rows[0] || null;
};

exports.upsert = async (companyId, data) => {
  const { latitude, longitude, radius, address } = data;

  const check = await db.query(
    "SELECT id FROM office_locations WHERE company_id = $1",
    [companyId]
  );

  if (check.rowCount > 0) {
    return db.query(
      `UPDATE office_locations 
       SET latitude=$1, longitude=$2, radius=$3, address=$4, active=true 
       WHERE company_id=$5 RETURNING *`,
      [latitude, longitude, radius || 100, address, companyId]
    );
  } else {
    // Insert baru
    return db.query(
      `INSERT INTO office_locations (company_id, latitude, longitude, radius, address, active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [companyId, latitude, longitude, radius || 100, address]
    );
  }
};

exports.toggleStatus = (companyId) => {
  return db.query(
    `UPDATE office_locations 
     SET active = NOT active 
     WHERE company_id=$1 
     RETURNING active`, 
    [companyId]
  );
};

exports.deleteByCompanyId = (companyId) => {
  return db.query("DELETE FROM office_locations WHERE company_id=$1", [companyId]);
};