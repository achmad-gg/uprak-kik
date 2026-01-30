const bcrypt = require("bcrypt");
const db = require("../../config/db");
const audit = require("./adminAudit");
const companyRepo = require("../companies/companiesRepo");
const officeRepo = require("../companies/officesRepo");

/* =========================================
   USER MANAGEMENT
========================================= */

exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "intern",
      company_id,
      phone_number,
      bio,
      address,
      profile_picture,
    } = req.body;

    if (!name || !email || !password || !company_id) {
      return res.status(400).json({ message: "Data wajib tidak lengkap" });
    }

    const exists = await db.query("SELECT 1 FROM users WHERE email=$1", [
      email,
    ]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: "Email sudah terdaftar" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await db.query(
      `INSERT INTO users (
        name, email, password_hash, role, company_id,
        phone_number, bio, address, profile_picture, is_first_login, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,true) RETURNING id`,
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

    await audit.log({
      adminId: req.user.id,
      action: "CREATE_USER",
      targetTable: "users",
      targetId: newUser.rows[0].id,
      description: `Membuat user baru: ${email}`,
    });

    res.json({ success: true, message: "User berhasil dibuat" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, company_id,phone_number, address, bio } = req.body;

    const result = await db.query(
      `UPDATE users SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        company_id = COALESCE($4, company_id),
        phone_number = COALESCE($5, phone_number),
        address = COALESCE($6, address),
        bio = COALESCE($7, bio)
       WHERE id = $8 RETURNING *`,
      [name, email, role, company_id, phone_number, address, bio, id],
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "User not found" });

    await audit.log({
      adminId: req.user.id,
      action: "UPDATE_USER",
      targetTable: "users",
      targetId: id,
      description: `Update data user: ${email}`,
    });

    res.json({
      success: true,
      message: "Data berhasil diperbarui",
      user: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ message: "Gagal update user" });
  }
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
            -- Pastikan dua baris di bawah ini ada:
            a.check_in_at AS check_in, 
            a.check_out_at AS check_out
          FROM users u
          JOIN companies c ON c.id = u.company_id
          -- Join khusus untuk mengambil data absen HARI INI
          LEFT JOIN attendances a ON a.user_id = u.id AND a.date = CURRENT_DATE
          ${whereClause}
          ORDER BY u.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}
        `;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.disableUser = async (req, res) => {
  await db.query("UPDATE users SET status=false WHERE id=$1", [req.params.id]);
  await audit.log({
    adminId: req.user.id,
    action: "DISABLE_USER",
    targetId: req.params.id,
    description: "Nonaktifkan user",
  });
  res.send({ success: true });
};

exports.enableUser = async (req, res) => {
  await db.query("UPDATE users SET status=true WHERE id=$1", [req.params.id]);
  await audit.log({
    adminId: req.user.id,
    action: "ENABLE_USER",
    targetId: req.params.id,
    description: "Aktifkan user",
  });
  res.send({ success: true });
};

exports.deleteUser = async (req, res) => {
  const client = await db.connect();
  
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const userCheck = await client.query("SELECT id, email FROM users WHERE id = $1", [id]);
    if (userCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    await client.query("DELETE FROM attendances WHERE user_id = $1", [id]);

    await client.query("DELETE FROM users WHERE id = $1", [id]);

    await client.query("COMMIT");

    await audit.log({
      adminId: req.user.id,
      action: "DELETE_USER",
      targetId: id,
      description: `Menghapus user permanen beserta riwayat absensi: ${userCheck.rows[0].email}`
    });

    res.json({ success: true, message: "User dan semua riwayat absensi berhasil dihapus permanen" });

  } catch (err) {
    if (err.code === "23503") {
      return res.status(400).json({ message: "Gagal: User memiliki riwayat absensi." });
    }
    res.status(500).json({ message: "Gagal menghapus user" });
  }
};

exports.resetPassword = async (req, res) => {
  const defaultPassword = "123456";
  const hash = await bcrypt.hash(defaultPassword, 10);
  await db.query(
    "UPDATE users SET password_hash=$1, is_first_login=true WHERE id=$2",
    [hash, req.params.id],
  );
  res.send({ success: true, defaultPassword });
};

exports.dashboardSummary = async (companyId) => {
  const r = await db.query(
    `SELECT
      COUNT(u.id) FILTER (WHERE u.role = 'intern') AS total_users,
      COUNT(a.id) FILTER (WHERE a.date = CURRENT_DATE AND a.check_in_at IS NOT NULL AND u.role = 'intern') AS present_today,
      COUNT(u.id) FILTER (WHERE u.role = 'intern' AND NOT EXISTS (SELECT 1 FROM attendances a2 WHERE a2.user_id = u.id AND a2.date = CURRENT_DATE)) AS absent_today,
      COUNT(a.id) FILTER (WHERE a.date = CURRENT_DATE AND a.check_out_at IS NOT NULL AND u.role = 'intern') AS checked_out_today,
      (SELECT COUNT(*) FROM office_locations WHERE active=true) AS active_offices
    FROM users u
    LEFT JOIN attendances a ON a.user_id = u.id AND a.date = CURRENT_DATE
    WHERE u.company_id = $1;`,
    [companyId],
  );
  return r.rows[0];
};

/* =========================================
   COMPANY MANAGEMENT
========================================= */

exports.listCompanies = async (req, res) => {
  try {
    const result = await companyRepo.getAllCompanies();
    res.json(result.rows);
  } catch (err) {
    console.error("❌ ERROR LIST COMPANIES:", err.message);
    res.status(500).json({ message: "Gagal load companies: " + err.message });
  }
};

exports.createCompany = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const result = await companyRepo.createCompany(name);
    
    // Audit Log (dibungkus try-catch agar tidak memblokir flow utama jika error)
    try {
        await audit.log({
          adminId: req.user.id,
          action: "CREATE_COMPANY",
          targetTable: "companies",
          targetId: result.rows[0].id,
          description: `Membuat perusahaan: ${name}`
        });
    } catch (auditErr) {
        console.error("Audit Log Error:", auditErr.message);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ CREATE COMPANY ERROR:", err); 
    res.status(500).json({ message: "Gagal membuat company: " + err.message });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const result = await companyRepo.updateCompany(id, name);

    await audit.log({
      adminId: req.user.id,
      action: "UPDATE_COMPANY",
      targetId: id,
      description: `Update nama company: ${name}`,
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Gagal update company" });
  }
};

exports.toggleCompanyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    await companyRepo.toggleStatus(id);
    await audit.log({
      adminId: req.user.id,
      action: "TOGGLE_COMPANY",
      targetId: id,
      description: "Ubah status company",
    });
    res.json({ success: true, message: "Status perusahaan diubah" });
  } catch (err) {
    res.status(500).json({ message: "Gagal ubah status" });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    await companyRepo.deleteCompany(id);
    await audit.log({
      adminId: req.user.id,
      action: "DELETE_COMPANY",
      targetId: id,
      description: "Hapus company",
    });
    res.json({ message: "Company deleted" });
  } catch (err) {
    res.status(500).json({ message: "Gagal hapus company" });
  }
};

/* =========================================
   OFFICE LOCATIONS
========================================= */

exports.getOffice = async (req, res) => {
  try {
    const office = await officeRepo.getByCompanyId(req.user.company_id);
    res.json(office);
  } catch (err) {
    res.status(500).json({ message: "Gagal load office" });
  }
};

exports.getOfficeByCompany = async (req, res) => {
  try {
    const office = await officeRepo.getByCompanyId(req.params.id);
    res.json(office);
  } catch (err) {
    res.status(500).json({ message: "Error fetching office" });
  }
};

exports.setOffice = async (req, res) => {
  try {
    const { latitude, longitude, radius, address, company_id } = req.body;

    const targetCompanyId = company_id || req.user.company_id;

    if (!targetCompanyId) {
      return res
        .status(400)
        .json({ message: "Target Company ID tidak ditemukan" });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Incomplete office data" });
    }

    const result = await officeRepo.upsert(targetCompanyId, {
      latitude,
      longitude,
      radius,
      address,
    });

    await audit.log({
      adminId: req.user.id,
      action: "SET_OFFICE",
      targetTable: "office_locations",
      targetId: result.rows[0].id,
      description: `Set lokasi kantor untuk company ID: ${targetCompanyId}`,
    });

    res.json({ success: true, message: "Lokasi kantor disimpan" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal simpan kantor" });
  }
};
