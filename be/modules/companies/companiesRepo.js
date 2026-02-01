const db = require("../../config/db");

exports.createCompany = (name) => {
  return db.query(
    `INSERT INTO companies (name, is_active)
     VALUES ($1, true)
     RETURNING *`,
    [name]
  );
};

exports.getAllCompanies = () => {
  return db.query(`
    SELECT 
      c.*, 
      CASE WHEN o.id IS NOT NULL THEN true ELSE false END as has_office,
      o.address as office_address,
      o.active as office_is_active,
      o.radius as office_radius
    FROM companies c
    LEFT JOIN office_locations o ON o.company_id = c.id
    ORDER BY c.created_at DESC
  `);
};

exports.getCompanyById = (id) => {
  return db.query(`SELECT * FROM companies WHERE id=$1`, [id]);
};

exports.updateCompany = (id, name) => {
  return db.query(
    `UPDATE companies
     SET name=$1
     WHERE id=$2
     RETURNING *`,
    [name, id]
  );
};

exports.toggleStatus = (id) => {
  return db.query(
    `UPDATE companies 
     SET is_active = NOT is_active 
     WHERE id=$1 
     RETURNING is_active`, 
    [id]
  );
};

exports.deleteCompany = async (id) => {
  return db.query(`DELETE FROM companies WHERE id=$1`, [id]);
};