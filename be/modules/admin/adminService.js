const bcrypt = require("bcrypt");
const axios = require("axios");
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
      role,
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
   COMPANY MANAGEMENT (DEBUGGED)
========================================= */

exports.listCompanies = async (req, res) => {
  try {
    const result = await companyRepo.getAllCompanies();
    res.json(result.rows);
  } catch (err) {
    console.error("❌ [LIST COMPANIES ERROR]:", err.message);
    res.status(500).json({ message: "Gagal load companies" });
  }
};

exports.createCompany = async (req, res) => {
  try {
    console.log("➡️ [CREATE COMPANY] Body:", req.body);
    const { name } = req.body;
    if (!name) {
        console.warn("⚠️ [CREATE COMPANY] Gagal: Nama kosong");
        return res.status(400).json({ message: "Name required" });
    }

    const result = await companyRepo.createCompany(name);
    console.log("✅ [CREATE COMPANY] Sukses ID:", result.rows[0].id);

    await audit.log({
      adminId: req.user.id,
      action: "CREATE_COMPANY",
      targetTable: "companies",
      targetId: result.rows[0].id,
      description: `Membuat perusahaan: ${name}`
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ [CREATE COMPANY ERROR]:", err); 
    res.status(500).json({ message: "Gagal membuat company" });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    await companyRepo.updateCompany(id, name);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ [UPDATE COMPANY ERROR]:", err);
    res.status(500).json({ message: "Gagal update company" });
  }
};

exports.toggleCompanyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`➡️ [TOGGLE COMPANY] ID: ${id}`);
    
    const result = await companyRepo.toggleStatus(id);
    const status = result.rows[0].is_active ? "Aktif" : "Non-Aktif";
    console.log(`✅ [TOGGLE COMPANY] Status baru: ${status}`);

    await audit.log({
      adminId: req.user.id,
      action: "TOGGLE_COMPANY",
      targetId: id,
      description: `Ubah status company jadi ${status}`,
    });
    res.json({ success: true, message: `Status: ${status}`, is_active: result.rows[0].is_active });
  } catch (err) {
    console.error("❌ [TOGGLE COMPANY ERROR]:", err);
    res.status(500).json({ message: "Gagal ubah status company" });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`➡️ [DELETE COMPANY] ID: ${id}`);

    await companyRepo.deleteCompany(id);
    console.log("✅ [DELETE COMPANY] Sukses");
    
    await audit.log({
      adminId: req.user.id,
      action: "DELETE_COMPANY",
      targetId: id,
      description: "Hapus company permanen",
    });
    
    res.json({ success: true, message: "Perusahaan dihapus" });
  } catch (err) {
    console.error("❌ [DELETE COMPANY ERROR]:", err.code);
    if (err.code === '23503') {
      console.warn("⚠️ Gagal hapus karena Foreign Key (User masih ada)");
      return res.status(400).json({ 
        message: "Gagal: Perusahaan masih memiliki karyawan. Hapus user terlebih dahulu." 
      });
    }
    res.status(500).json({ message: "Server Error" });
  }
};

/* =========================================
   OFFICE LOCATIONS (DEBUGGED)
========================================= */

exports.getOffice = async (req, res) => {
    // ... Logika getOffice lama ...
    try {
        const office = await officeRepo.getByCompanyId(req.user.company_id);
        res.json(office);
    } catch(e) { res.status(500).json({message:"err"}); }
};

exports.getOfficeByCompany = async (req, res) => {
    try {
        const office = await officeRepo.getByCompanyId(req.params.id);
        res.json(office);
    } catch(e) { res.status(500).json({message:"err"}); }
};

exports.setOffice = async (req, res) => {
  try {
    console.log("➡️ [SET OFFICE] Payload:", req.body); // LOG PENTING
    const { latitude, longitude, radius, address, company_id } = req.body;
    
    const targetCompanyId = company_id || req.user.company_id;

    if (!targetCompanyId) {
      console.warn("⚠️ [SET OFFICE] Gagal: Company ID hilang");
      return res.status(400).json({ message: "Target Company ID tidak ditemukan" });
    }

    // Validasi Lat/Long
    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      console.warn("⚠️ [SET OFFICE] Gagal: Lat/Long kosong/null. Data:", {latitude, longitude});
      return res.status(400).json({ message: "Latitude & Longitude wajib diisi" });
    }

    const result = await officeRepo.upsert(targetCompanyId, {
      latitude,
      longitude,
      radius,
      address,
    });
    console.log("✅ [SET OFFICE] Sukses. ID:", result.rows[0].id);

    await audit.log({
      adminId: req.user.id,
      action: "SET_OFFICE",
      targetTable: "office_locations",
      targetId: result.rows[0].id,
      description: `Set lokasi kantor untuk company ID: ${targetCompanyId}`,
    });

    res.json({ success: true, message: "Lokasi kantor disimpan", data: result.rows[0] });
  } catch (err) {
    console.error("❌ [SET OFFICE ERROR]:", err); // LOG ERROR
    res.status(500).json({ message: "Gagal simpan kantor: " + err.message });
  }
};

exports.toggleOfficeStatus = async (req, res) => {
  try {
    const { id } = req.params; // Ini adalah company_id
    console.log(`➡️ [TOGGLE OFFICE] Company ID: ${id}`);

    const result = await officeRepo.toggleStatus(id);
    
    if (result.rowCount === 0) {
      console.warn("⚠️ [TOGGLE OFFICE] Gagal: Data kantor tidak ditemukan di DB");
      return res.status(404).json({ message: "Lokasi kantor belum diset. Harap set lokasi dulu." });
    }

    const status = result.rows[0].active ? "Aktif" : "Non-Aktif";
    console.log(`✅ [TOGGLE OFFICE] Status baru: ${status}`);

    await audit.log({
      adminId: req.user.id,
      action: "TOGGLE_OFFICE",
      targetId: id, 
      description: `Ubah status kantor jadi ${status}`,
    });

    res.json({ success: true, message: `Lokasi kantor ${status}`, active: result.rows[0].active });
  } catch (err) {
    console.error("❌ [TOGGLE OFFICE ERROR]:", err);
    res.status(500).json({ message: "Gagal ubah status kantor" });
  }
};

exports.deleteOffice = async (req, res) => {
  try {
    const { id } = req.params; 
    console.log(`➡️ [DELETE OFFICE] Company ID: ${id}`);
    
    await officeRepo.deleteByCompanyId(id);
    console.log("✅ [DELETE OFFICE] Sukses");

    await audit.log({
      adminId: req.user.id,
      action: "DELETE_OFFICE",
      targetId: id,
      description: "Hapus/Reset lokasi kantor",
    });

    res.json({ success: true, message: "Lokasi kantor dihapus" });
  } catch (err) {
    console.error("❌ [DELETE OFFICE ERROR]:", err);
    res.status(500).json({ message: "Gagal hapus lokasi kantor" });
  }
};

/* =========================================
   NOMINATIM PROXY (SOLUSI CORS)
========================================= */

exports.proxySearchLocation = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: "Query kosong" });

    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        format: "json",
        q: q,
        limit: 5,
        addressdetails: 1
      },
      headers: {
        "User-Agent": "AbsensiSystem/1.0 (admin@yourcompany.com)" 
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error("Nominatim Proxy Error:", err.message);
    res.status(500).json({ message: "Gagal mengambil data lokasi" });
  }
};

exports.proxyReverseLocation = async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ message: "Lat/Lon kosong" });

    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: {
        format: "json",
        lat: lat,
        lon: lon,
        zoom: 18,
        addressdetails: 1
      },
      headers: {
        "User-Agent": "AbsensiSystem/1.0 (admin@yourcompany.com)"
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error("Nominatim Reverse Proxy Error:", err.message);
    res.status(500).json({ message: "Gagal reverse geocode" });
  }
};