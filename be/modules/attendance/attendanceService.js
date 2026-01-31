const repo = require("./attendanceRepo");
const officeRepo = require("../companies/officesRepo");
const holidaysRepo = require("../holidays/holidaysRepo");
const geo = require("./attendanceGeo");
const risk = require("./attendanceRisk");
const fs = require("fs");

const cleanupFile = (req) => {
  if (req.file && req.file.path) {
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      console.error("Gagal hapus file sampah:", e.message);
    }
  }
};

/* ===========================
   CHECK-IN
=========================== */
exports.checkIn = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const isHoliday = await holidaysRepo.checkDate(todayStr);
    if (isHoliday) {
      cleanupFile(req);
      return res.status(403).json({ 
        message: `Absen Ditolak: Hari ini libur nasional (${isHoliday.name}).` 
      });
    }

    const existingAtt = await repo.findToday(req.user.id);
    if (existingAtt) {
      cleanupFile(req);
      return res.status(400).json({ message: "Anda sudah melakukan check-in hari ini." });
    }

    if (!req.file) return res.status(400).json({ message: "Foto selfie wajib diupload" });
    
    const lat = parseFloat(req.body.latitude);
    const lng = parseFloat(req.body.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      cleanupFile(req);
      return res.status(400).json({ message: "Koordinat GPS tidak valid" });
    }

    const office = await officeRepo.getByCompanyId(req.user.company_id);
    if (!office) {
      cleanupFile(req);
      return res.status(400).json({ message: "Lokasi kantor belum diatur oleh Admin" });
    }

    const geoCheck = geo.checkWithOffice(office, lat, lng);
    if (!geoCheck.inside) {
      cleanupFile(req);
      return res.status(403).json({ 
        message: `Jarak terlalu jauh (${geoCheck.distance}m). Maksimal ${office.radius}m.` 
      });
    }

    const riskScore = await risk.calculate(
      req.ip,
      req.headers["user-agent"],
      req.headers["x-screen"] || "",
      geoCheck.distance,
      office.radius
    );


    const currentHour = new Date().getHours();
    const isLate = currentHour >= 9; // Anggap telat jika check-in jam 9 ke atas

    // 5. EKSEKUSI DATABASE
    const photoPath = `/uploads/attendance/${req.file.filename}`;
    
    await repo.processCheckIn({
      user: req.user,
      office,
      lat, 
      lng,
      screen: req.headers["x-screen"] || "",
      ip: req.ip,
      ua: req.headers["user-agent"],
      photoPath,
      riskScore,
      isLate
    });

    res.json({ 
      success: true, 
      message: isLate ? "Check-in berhasil (Terlambat)." : "Check-in berhasil! Selamat bekerja." 
    });

  } catch (err) {
    cleanupFile(req); 
    console.error("Check-In Error:", err);
    
    if (err.message === "ALREADY_CHECKED_IN") {
       return res.status(400).json({ message: "Anda sudah check-in sebelumnya." });
    }
    res.status(500).json({ message: "Terjadi kesalahan server." });
  }
};

/* ===========================
   CHECK-OUT
=========================== */
exports.checkOut = async (req, res) => {
  try {
    const lat = parseFloat(req.body.latitude);
    const lng = parseFloat(req.body.longitude);

    if (!req.file) return res.status(400).json({ message: "Foto selfie wajib diupload" });
    if (isNaN(lat) || isNaN(lng)) {
      cleanupFile(req);
      return res.status(400).json({ message: "Koordinat GPS tidak valid" });
    }

    const todayAtt = await repo.findToday(req.user.id);
    if (!todayAtt) {
      cleanupFile(req);
      return res.status(400).json({ message: "Anda belum check-in hari ini." });
    }
    if (todayAtt.check_out_at) {
      cleanupFile(req);
      return res.status(400).json({ message: "Anda sudah check-out sebelumnya." });
    }

    const office = await officeRepo.getByCompanyId(req.user.company_id);
    if (!office) {
       cleanupFile(req);
       return res.status(400).json({ message: "Lokasi kantor hilang." });
    }

    const geoCheck = geo.checkWithOffice(office, lat, lng);
    if (!geoCheck.inside) {
      cleanupFile(req);
      return res.status(403).json({ 
        message: `Gagal Check-out: Posisi anda diluar kantor (${geoCheck.distance}m).` 
      });
    }

    const riskScore = await risk.calculate(
      req.ip,
      req.headers["user-agent"],
      req.headers["x-screen"],
      geoCheck.distance,
      office.radius
    );

    const photoPath = `/uploads/attendance/${req.file.filename}`;
    
    await repo.processCheckOut({
      user: req.user,
      attendanceId: todayAtt.id,
      lat,
      lng,
      photoPath,
      riskScore
    });

    res.json({ success: true, message: "Check-out berhasil. Hati-hati di jalan!" });

  } catch (err) {
    cleanupFile(req);
    console.error("Check-Out Error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server saat check-out." });
  }
};

exports.getMyHistory = async (userId) => {
    return repo.getUserHistory(userId);
};
  
exports.getMyAttendanceDetail = async (userId, date) => {
    return repo.getUserAttendanceDetail(userId, date);
};
  
exports.getMonthlyRecap = async (req, res) => {
    try {
      const { month, year } = req.query;
      if (!month || !year) return res.status(400).json({ message: "Bulan dan Tahun wajib diisi" });
      
      const data = await repo.getMonthlyRecap(req.user.id, month, year);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
};

exports.getMyOffice = async (req, res) => {
  try {
    const office = await officeRepo.getByCompanyId(req.user.company_id);
    if (!office) return res.status(404).json({ message: "Kantor tidak ditemukan" });
    
    res.json({
      success: true,
      data: {
        latitude: office.latitude,
        longitude: office.longitude,
        radius: office.radius,
        address: office.address
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};