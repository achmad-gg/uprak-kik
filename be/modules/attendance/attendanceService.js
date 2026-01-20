const attendanceRepo = require("./attendanceRepo");
const officeRepo = require("../companies/officesRepo");
const geo = require("./attendanceGeo");
const risk = require("./attendanceRisk");
const photoStorage = require("../utils/photoStorage");

exports.checkIn = async (req, res) => {
  if (!req.file) return res.status(400).send("Selfie required");

  const lat = Number(req.body.latitude);
  const lng = Number(req.body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).send("Invalid coordinates");
  }

  const office = await officeRepo.getOfficeByCompany(req.user.company_id);
  if (!office || !office.active) {
    return res.status(400).send("Office not configured");
  }

  const { inside } = geo.checkWithOffice(office, lat, lng);
  if (!inside) return res.status(403).send("Outside geofence");

  let photo;
  try {
    photo = await photoStorage.saveAttendancePhoto(
      "in",
      req.user.id,
      req.file.buffer,
    );

    await attendanceRepo.processCheckIn(
      req.user,
      office,
      lat,
      lng,
      req.headers["x-screen"] || null,
      req.ip,
      req.headers["user-agent"] || null,
      photo.relativePath,
    );

    return res.json({ success: true });
  } catch (e) {
    await photoStorage.deletePhoto(photo?.absolutePath);
    console.error("CHECK-IN ERROR:", e);
    return res.status(500).send("Check-in failed");
  }
};

exports.checkOut = async (req, res) => {
  if (!req.file) return res.status(400).send("Selfie required");

  const lat = Number(req.body.latitude);
  const lng = Number(req.body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).send("Invalid coordinates");
  }

  const att = await attendanceRepo.findToday(req.user.id);
  if (!att) return res.status(400).send("No check-in");
  if (att.check_out_at) return res.status(409).send("Already checked out");

  const mins = (Date.now() - new Date(att.check_in_at)) / 60000;
  if (mins < 1) return res.status(403).send("Presence too short");

  const office = await officeRepo.getOfficeByCompany(req.user.company_id);
  if (!office || !office.active) {
    return res.status(400).send("Office not configured");
  }

  const { inside, distance } = geo.checkWithOffice(office, lat, lng);
  if (!inside) return res.status(403).send("Outside geofence");

  const riskScore = await risk.calculate(
    req.ip,
    req.headers["user-agent"] || null,
    req.headers["x-screen"] || null,
    distance,
    office.radius,
  );

  let photo;
  try {
    photo = await photoStorage.saveAttendancePhoto(
      "out",
      req.user.id,
      req.file.buffer,
    );

    await attendanceRepo.processCheckOut(
      req.user,
      att.id,
      lat,
      lng,
      req.headers["x-screen"] || null,
      req.ip,
      req.headers["user-agent"] || null,
      photo.relativePath,
      riskScore,
    );

    return res.json({ success: true });
  } catch (e) {
    await photoStorage.deletePhoto(photo?.absolutePath);
    console.error("CHECK-OUT ERROR:", e);
    return res.status(500).send("Check-out failed");
  }
};

// history
exports.getMyHistory = async (userId) => {
  if (!userId) throw new Error("USER_ID_REQUIRED");
  return attendanceRepo.getUserHistory(userId);
};

exports.getMyAttendanceDetail = async (userId, date) => {
  if (!userId) throw new Error("USER_ID_REQUIRED");
  if (!date) throw new Error("DATE_REQUIRED");

  return attendanceRepo.getUserAttendanceDetail(userId, date);
};

