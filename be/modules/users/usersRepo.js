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

exports.findByEmail = async (email) => {
  const r = await db.query(`SELECT * FROM users WHERE email=$1`, [email]);
  return r.rows[0];
};

exports.findById = async (id) => {
  const r = await db.query(
    `SELECT id, name, email, role, company_id, 
            profile_picture, phone_number, bio, address
     FROM users 
     WHERE id = $1`,
    [id]
  );
  return r.rows[0];
};

exports.updateProfile = async (id, data) => {
  const { name, email, phone_number, bio, address, profile_picture } = data;

  const r = await db.query(
    `UPDATE users SET 
      name = COALESCE($1, name),
      email = COALESCE($2, email), 
      phone_number = COALESCE($3, phone_number),
      bio = COALESCE($4, bio),
      address = COALESCE($5, address),
      profile_picture = COALESCE($6, profile_picture)
     WHERE id = $7
     RETURNING id, name, email, role, company_id, profile_picture, phone_number, bio, address`,
    [name, email, phone_number, bio, address, profile_picture, id]
  );

  return r.rows[0];
};
