const attendanceRepo = require("./attendanceRepo");
const geo = require("./attendanceGeo");

exports.checkIn = async (req, res) => {
  if (!req.file) return res.status(400).send("Selfie required");

  const lat = parseFloat(req.body.latitude);
  const lng = parseFloat(req.body.longitude);
  const screen = req.headers["x-screen"];
  const ip = req.ip;
  const ua = req.headers["user-agent"];

  const { inside } = await geo.checkLocation(req.user.company_id, lat, lng);
  if (!inside) return res.status(403).send("Outside geofence");

  await attendanceRepo.processCheckIn(
    req.user,
    lat,
    lng,
    screen,
    ip,
    ua,
    req.file.path
  );

  res.send({ success: true });
};

exports.checkOut = async (req, res) => {
  if (!req.file) return res.status(400).send("Selfie required");

  const lat = parseFloat(req.body.latitude);
  const lng = parseFloat(req.body.longitude);
  const screen = req.headers["x-screen"];
  const ip = req.ip;
  const ua = req.headers["user-agent"];

  const att = await attendanceRepo.findToday(req.user.id);
  if (!att) return res.status(400).send("No check-in");
  if (att.check_out) return res.status(409).send("Already checked out");

  const mins = (Date.now() - new Date(att.check_in)) / 60000;
  if (mins < 1) return res.status(403).send("Presence too short");

  const { inside } = await geo.checkLocation(req.user.company_id, lat, lng);
  if (!inside) return res.status(403).send("Outside geofence");

  await attendanceRepo.processCheckOut(
    req.user,
    lat,
    lng,
    screen,
    ip,
    ua,
    req.file.path
  );

  res.send({ success: true });
};
