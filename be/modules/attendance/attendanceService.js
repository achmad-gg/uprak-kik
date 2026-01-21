const attendanceRepo = require("./attendanceRepo");
const officeRepo = require("../companies/officesRepo"); // Pastikan path ini benar
const geo = require("./attendanceGeo");
const risk = require("./attendanceRisk"); // Jika tidak dipakai, boleh dihapus
const path = require("path");
const fs = require("fs");

/* ===========================
   CHECK-IN
=========================== */
exports.checkIn = async (req, res) => {
  try {
    // 🔥 FIX: Konversi ke Float agar dibaca sebagai Number oleh Repo
    const latitude = parseFloat(req.body.latitude);
    const longitude = parseFloat(req.body.longitude);
    const companyId = req.user.company_id;

    // 1. Validasi Input
    if (!req.file) {
      return res.status(400).json({ message: "Foto selfie wajib diupload" });
    }
    // Validasi NaN (Not a Number)
    if (isNaN(latitude) || isNaN(longitude)) {
      if (req.file.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Lokasi GPS tidak valid" });
    }

    // 2. Ambil Lokasi Kantor
    const office = await officeRepo.getByCompanyId(companyId);
    if (!office) {
      if (req.file.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Lokasi kantor belum diatur oleh Admin" });
    }

    // 3. Cek Radius (Geofencing)
    const check = geo.checkWithOffice(office, latitude, longitude);
    
    if (!check.inside) {
      if (req.file.path) fs.unlinkSync(req.file.path);
      return res.status(403).json({ 
        message: `Anda berada di luar radius kantor! Jarak: ${Math.round(check.distance)} meter.` 
      });
    }

    // 4. Simpan ke Database
    const photoPath = `/uploads/attendance/${req.file.filename}`;
    
    await attendanceRepo.processCheckIn(
      req.user,                     
      office,                       
      latitude,                     
      longitude,                    
      req.headers["x-screen"] || "",
      req.ip,                       
      req.headers["user-agent"],    
      photoPath                     
    );

    res.json({ success: true, message: "Check-in berhasil! Selamat bekerja." });

  } catch (err) {
    console.error("Check-In Error:", err);
    if (req.file && req.file.path) fs.unlinkSync(req.file.path); 
    
    if (err.message === "Already checked in today" || err.code === '23505') { 
        return res.status(400).json({ message: "Anda sudah melakukan check-in hari ini" });
    }
    
    res.status(500).json({ message: "Terjadi kesalahan server saat check-in" });
  }
};

/* ===========================
   CHECK-OUT
=========================== */
exports.checkOut = async (req, res) => {
  try {
    // 🔥 FIX: Konversi ke Float agar tidak dianggap INVALID_COORDINATES
    const latitude = parseFloat(req.body.latitude);
    const longitude = parseFloat(req.body.longitude);
    const userId = req.user.id;
    const companyId = req.user.company_id;

    if (!req.file) {
      return res.status(400).json({ message: "Foto selfie wajib diupload" });
    }
    if (isNaN(latitude) || isNaN(longitude)) {
      if (req.file.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Lokasi GPS tidak valid" });
    }

    // 1. Cek apakah sudah Check-In hari ini
    const todayAtt = await attendanceRepo.findToday(userId);
    if (!todayAtt) {
        if (req.file.path) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Anda belum melakukan Check-in hari ini." });
    }
    if (todayAtt.check_out_at) {
        if (req.file.path) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Anda sudah Check-out sebelumnya." });
    }

    // 2. Ambil Lokasi Kantor & Cek Radius
    const office = await officeRepo.getByCompanyId(companyId);
    if (!office) {
        if (req.file.path) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Lokasi kantor tidak ditemukan" });
    }

    const check = geo.checkWithOffice(office, latitude, longitude);
    if (!check.inside) {
      if (req.file.path) fs.unlinkSync(req.file.path);
      return res.status(403).json({ 
        message: `Gagal Check-out: Anda di luar kantor (${Math.round(check.distance)}m).` 
      });
    }

    // 3. Hitung Risk Score
    const riskScore = await risk.calculate(
      req.ip,
      req.headers["user-agent"],
      req.headers["x-screen"],
      check.distance,
      office.radius
    );

    // 4. Simpan Check-out
    const photoPath = `/uploads/attendance/${req.file.filename}`;
    
    await attendanceRepo.processCheckOut(
      req.user,                   
      todayAtt.id,                
      latitude,                   // Pastikan ini Float/Number
      longitude,                  // Pastikan ini Float/Number
      req.headers["x-screen"] || "",
      req.ip,
      req.headers["user-agent"],
      photoPath,
      riskScore                   
    );

    res.json({ success: true, message: "Check-out berhasil. Hati-hati di jalan!" });

  } catch (err) {
    console.error("Check-Out Error:", err);
    if (req.file && req.file.path) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Terjadi kesalahan server saat check-out" });
  }
};

exports.getMyHistory = async (userId) => {
  return await attendanceRepo.getUserHistory(userId);
  if (!userId) throw new Error("USER_ID_REQUIRED");
  return attendanceRepo.getUserHistory(userId);
};

exports.getMyAttendanceDetail = async (userId, date) => {
  return await attendanceRepo.getUserAttendanceDetail(userId, date);
  if (!userId) throw new Error("USER_ID_REQUIRED");
  if (!date) throw new Error("DATE_REQUIRED");

  return attendanceRepo.getUserAttendanceDetail(userId, date);
};