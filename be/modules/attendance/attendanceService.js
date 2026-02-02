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
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const activeLeave = await leavesRepo.findActiveLeave(req.user.id, todayStr);
    if (activeLeave) {
      // Lempar error dengan format "LEAVE:TIPE_IZIN"
      throw new Error(`LEAVE:${activeLeave.type}`);
    }
    
    // 2. CEK LIBUR (HOLIDAY)
    const isHoliday = await holidaysRepo.checkDate(todayStr);
    if (isHoliday) {
      // Lempar error dengan format "HOLIDAY:NAMA_LIBUR"
      throw new Error(`HOLIDAY:${isHoliday.name}`);
    }

    // 3. CEK STATUS CHECK-IN (ALREADY CHECK-IN)
    const existingAtt = await repo.findToday(req.user.id);
    if (existingAtt) {
      if (!existingAtt.check_out_at) { 
        // User masih status check-in (lupa checkout)
        throw new Error("ALREADY_CHECKIN");
      }
      // Jika sudah check-out (berarti absen hari ini sudah selesai)
      throw new Error("ATTENDANCE_COMPLETED");
    }

    // --- Validasi Input Standar ---
    if (!req.file) throw new Error("Foto selfie wajib diupload");
    
    const lat = parseFloat(req.body.latitude);
    const lng = parseFloat(req.body.longitude);
    if (isNaN(lat) || isNaN(lng)) throw new Error("Koordinat GPS tidak valid");

    const office = await officeRepo.getByCompanyId(req.user.company_id);
    if (!office) throw new Error("Lokasi kantor belum diatur oleh Admin");

    // 4. CEK RADIUS (GEOFENCING)
    const geoCheck = geo.checkWithOffice(office, lat, lng);
    if (!geoCheck.inside) {
       // Lempar detail jarak agar frontend bisa menampilkan angka
       throw new Error(`OUT_OF_RANGE:${geoCheck.distance}:${office.radius}`);
    }

    // --- Hitung Risk & Proses Simpan ---
    const riskScore = await risk.calculate(
      req.ip,
      req.headers["user-agent"],
      req.headers["x-screen"] || "",
      geoCheck.distance,
      office.radius
    );

    const currentHour = new Date().getHours();
    const isLate = currentHour >= 9;
    const photoPath = `/uploads/attendance/${req.file.filename}`;
    
    await repo.processCheckIn({
      user: req.user,
      office,
      lat, lng,
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
    console.error("Check-In Logic Error:", err.message);
    
    const msg = err.message;

    // --- LOGIC HANDLING ERROR UNTUK FRONTEND ---
    
    // List error yang ingin kita kirim "mentah" ke frontend untuk di-parse
    if (
        msg.startsWith("LEAVE:") || 
        msg.startsWith("HOLIDAY:") || 
        msg.startsWith("OUT_OF_RANGE:") ||
        msg === "ALREADY_CHECKIN" ||
        msg === "ATTENDANCE_COMPLETED"
    ) {
        return res.status(400).json({ message: msg });
    }

    if (msg === "Foto selfie wajib diupload" || msg === "Koordinat GPS tidak valid") {
       return res.status(400).json({ message: msg });
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