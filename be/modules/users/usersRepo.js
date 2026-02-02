const db = require('../../config/db');

exports.findByEmail = async (email) => {
  return db.query(
    `SELECT 
       u.*, 
       c.is_active AS company_is_active 
     FROM users u
     LEFT JOIN companies c ON u.company_id = c.id
     WHERE u.email = $1`,
    [email]
  ).then(res => res.rows[0]);
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

  if (phone_number) {
    const cleanPhone = phone_number.replace(/[-\s]/g, '');
    if (!/^08\d{8,13}$/.test(cleanPhone)) {
      throw new Error('Format Nomor Telepon tidak valid (Harus 08xxxxxxxxx).');
    }
    data.phone_number = cleanPhone; 
  }

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
