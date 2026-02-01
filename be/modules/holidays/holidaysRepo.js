const db = require("../../config/db");

exports.getPaginated = async (limit, offset) => {
  const dataQuery = `
    SELECT id, date, name, description
    FROM holidays
    ORDER BY date ASC
    LIMIT $1 OFFSET $2
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM holidays
  `;

  const [dataResult, countResult] = await Promise.all([
    db.query(dataQuery, [limit, offset]),
    db.query(countQuery),
  ]);

  return {
    rows: dataResult.rows,
    total: countResult.rows[0].total,
  };
};

exports.create = async (date, name, description) => {
  const result = await db.query(
    `INSERT INTO holidays (date, name, description, is_active) 
     VALUES ($1, $2, $3, true) 
     RETURNING *`,
    [date, name, description],
  );
  return result.rows[0];
};

exports.delete = async (id) => {
  await db.query("DELETE FROM holidays WHERE id = $1", [id]);
};

exports.checkDate = async (date) => {
  const result = await db.query(
    `SELECT * FROM holidays WHERE date = $1 AND is_active = true`,
    [date],
  );
  return result.rows[0];
};
