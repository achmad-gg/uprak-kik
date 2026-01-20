// modules/companies/companyRepo.js
const db = require("../../config/db");

exports.createCompany = (name) => {
  return db.query(
    `INSERT INTO companies (name)
     VALUES ($1)
     RETURNING *`,
    [name]
  );
};

exports.getAllCompanies = () => {
  return db.query(`
    SELECT * FROM companies
    ORDER BY name
  `);
};

exports.getCompanyById = (id) => {
  return db.query(
    `SELECT * FROM companies WHERE id=$1`,
    [id]
  );
};

exports.updateCompany = (id, name) => {
  return db.query(
    `UPDATE companies
     SET name=$1, updated_at=NOW()
     WHERE id=$2
     RETURNING *`,
    [name, id]
  );
};

exports.deleteCompany = (id) => {
  return db.query(
    `DELETE FROM companies WHERE id=$1`,
    [id]
  );
};
