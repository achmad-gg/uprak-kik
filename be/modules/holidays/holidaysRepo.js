const db = require("../../config/db");

exports.getAll = async () => {
  const result = await db.query("SELECT * FROM holidays ORDER BY date ASC");
  return result.rows;
};

exports.create = async (date, name, description) => {
  const result = await db.query(
    `INSERT INTO holidays (date, name, description, is_active) 
     VALUES ($1, $2, $3, true) 
     RETURNING *`,
    [date, name, description]
  );
  return result.rows[0];
};

exports.delete = async (id) => {
  await db.query("DELETE FROM holidays WHERE id = $1", [id]);
};

exports.checkDate = async (date) => {
  const result = await db.query(
    `SELECT * FROM holidays WHERE date = $1 AND is_active = true`,
    [date]
  );
  return result.rows[0]; 
};