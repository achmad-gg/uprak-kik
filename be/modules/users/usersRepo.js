const db = require("../../config/db");

exports.findByEmail = (email) => {
  return db
    .query(`SELECT * FROM users WHERE email=$1`, [email])
    .then((r) => r.rows[0]);
};
