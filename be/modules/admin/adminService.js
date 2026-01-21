const bcrypt = require("bcrypt");
const db = require("../../config/db");
const audit = require("./adminAudits");
const companyRepo = require("../companies/companiesRepo");
const officeRepo = require("../companies/officesRepo");

// ================== User Management ===================
exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "intern",
      company_id,
      phone_number = null,
      bio = null,
      address = null,
      profile_picture,
    } = req.body;

    if (!name || !email || !password || !company_id) {
      return res.status(400).json({ message: "Data wajib tidak lengkap" });
    }

    if (!["intern", "admin"].includes(role)) {
      return res.status(400).json({ message: "Role tidak valid" });
    }

    const exists = await db.query("SELECT 1 FROM users WHERE email=$1", [
      email,
    ]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: "Email sudah terdaftar" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await db.query(
      `
      INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        company_id,
        phone_number,
        bio,
        address,
        profile_picture,
        is_first_login,
        status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,true,true
      )
      `,
      [
        name,
        email,
        password_hash,
        role,
        company_id,
        phone_number,
        bio,
        address,
        profile_picture || "/uploads/profiles/default-guest.png",
      ],
    );

    res.json({ success: true, message: "User berhasil dibuat" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone_number, address, bio } = req.body;

    const result = await db.query(
      `UPDATE users SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        phone_number = COALESCE($4, phone_number),
        address = COALESCE($5, address),
        bio = COALESCE($6, bio)
       WHERE id = $7
       RETURNING *`,
      [name, email, role, phone_number, address, bio, id],
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "User not found" });
    res.json({
      success: true,
      message: "Data berhasil diperbarui",
      user: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal update user" });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await db.query("UPDATE users SET status=$1 WHERE id=$2", [status, id]);

    res.json({
      success: true,
      message: status ? "User diaktifkan" : "User dinonaktifkan",
    });
  } catch (err) {
    res.status(500).json({ message: "Gagal ubah status" });
  }
};

exports.setOffice = async (req, res) => {
  const { company_id, latitude, longitude, radius } = req.body;

  await db.query(
    `
    INSERT INTO office_locations(company_id,latitude,longitude,radius,active)
    VALUES($1,$2,$3,$4,true)
    ON CONFLICT (company_id)
    DO UPDATE SET latitude=$2, longitude=$3, radius=$4, active=true
    `,
    [company_id, latitude, longitude, radius],
  );

  await audit.log({
    adminId: req.user.id,
    action: "SET_OFFICE_LOCATION",
    targetTable: "office_locations",
    targetId: officeId,
    description: "Mengubah lokasi kantor perusahaan",
  });

  res.send({ success: true });
};

exports.listUsers = async (req, res) => {
  try {
    const { company_id, role, limit = 20, offset = 0 } = req.query;

    const params = [];
    const conditions = [];

    if (company_id) {
      params.push(company_id);
      conditions.push(`u.company_id = $${params.length}`);
    }

    if (role && role !== "all") {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    params.push(limit, offset);

    const sql = `
      SELECT 
        u.id, u.name, u.email, u.role, u.phone_number, 
        u.address, u.profile_picture, u.created_at, u.status,
        c.name AS company_name,
        a.check_in_at, a.check_out_at
      FROM users u
      JOIN companies c ON c.id = u.company_id
      LEFT JOIN attendances a ON a.user_id = u.id AND a.date = CURRENT_DATE
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.dashboardSummary = async (companyId) => {
  const r = await db.query(
    `
    SELECT
  COUNT(u.id) FILTER (WHERE u.role = 'intern')             AS total_users,

  COUNT(a.id) FILTER (
    WHERE a.date = CURRENT_DATE AND a.check_in IS NOT NULL
  )                                                        AS present_today,

  COUNT(u.id) FILTER (
    WHERE u.role = 'intern'
      AND NOT EXISTS (
        SELECT 1 FROM attendances a2
        WHERE a2.user_id = u.id
          AND a2.date = CURRENT_DATE
      )
  )                                                        AS absent_today,

  COUNT(a.id) FILTER (
    WHERE a.date = CURRENT_DATE AND a.check_out IS NOT NULL
  )                                                        AS checked_out_today,

  (SELECT COUNT(*) FROM office_locations WHERE active=true)
                                                           AS active_offices
FROM users u
LEFT JOIN attendances a
  ON a.user_id = u.id AND a.date = CURRENT_DATE
WHERE u.company_id = $1;

  `,
    [companyId],
  );

  return r.rows[0];
};

exports.resetPassword = async (req, res) => {
  const defaultPassword = "123456";
  const hash = await bcrypt.hash(defaultPassword, 10);

  await db.query(
    `
    UPDATE users
    SET password_hash=$1, is_first_login=true
    WHERE id=$2
    `,
    [hash, req.params.id],
  );

  res.send({ success: true, defaultPassword });
};

exports.disableUser = async (req, res) => {
  await db.query("UPDATE users SET status=false WHERE id=$1", [req.params.id]);

  res.send({ success: true });
};

exports.enableUser = async (req, res) => {
  await db.query("UPDATE users SET status=true WHERE id=$1", [req.params.id]);
  res.send({ success: true });
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const userCheck = await db.query("SELECT id FROM users WHERE id = $1", [
      id,
    ]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    await db.query("DELETE FROM users WHERE id = $1", [id]);

    res.json({ success: true, message: "User berhasil dihapus permanen" });
  } catch (err) {
    console.error(err);
    if (err.code === "23503") {
      return res
        .status(400)
        .json({
          message:
            "Gagal: User memiliki riwayat absensi. Nonaktifkan saja akun ini.",
        });
    }
    res.status(500).json({ message: "Gagal menghapus user" });
  }
};

/* =======================
  COMPANIES
======================= */
exports.createCompany = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Name required" });

  const result = await companyRepo.createCompany(name);
  res.json(result.rows[0]);
};

exports.listCompanies = async (req, res) => {
  const result = await companyRepo.getAllCompanies();
  res.json(result.rows);
};

exports.updateCompany = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const result = await companyRepo.updateCompany(id, name);
  res.json(result.rows[0]);
};

exports.deleteCompany = async (req, res) => {
  await companyRepo.deleteCompany(req.params.id);
  res.json({ message: "Company deleted" });
};

/* =======================
   OFFICE
======================= */

exports.setOffice = async (req, res) => {
  const { latitude, longitude, radius, updated_at } = req.body;
  const companyId = req.user.company_id;

  if (!latitude || !longitude || !radius) {
    return res.status(400).json({ message: "Incomplete office data" });
  }

  const result = await officeRepo.setOffice(
    companyId,
    latitude,
    longitude,
    radius,
    updated_at
  );

  res.json(result.rows[0]);
};