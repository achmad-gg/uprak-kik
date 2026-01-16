const db = require('../../config/db');
const bcrypt = require('bcrypt');

exports.create = async (name, email, password, company_id, role = 'intern') => {
  const hash = bcrypt.hashSync(password, 10);
  
  return db.query(
    `INSERT INTO users (name, email, password_hash, role, company_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [name, email, hash, role, company_id]
  );
};

exports.findByEmail = (email) => {
  return db.query(`SELECT * FROM users WHERE email=$1`, [email])
           .then(r => r.rows[0]);
};