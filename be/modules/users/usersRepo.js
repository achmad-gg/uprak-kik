const db = require('../../config/db');
const bcrypt = require('bcrypt');

exports.create = async (name, email, password, company_id) => {
  const hash = bcrypt.hashSync(password, 10);
  
  return db.query(
    `INSERT INTO users (name, email, password_hash, role, company_id)
     VALUES ($1, $2, $3, 'intern', $4)`,
    [name, email, hash, company_id]
  );
};

exports.findByEmail = (email) => {
  return db.query(`SELECT * FROM users WHERE email=$1`, [email])
           .then(r => r.rows[0]);
};