const repo = require("./attendanceRepo");
const geo = require("./attendanceGeo");

exports.checkIn = async (req, res) => {
  if (!req.file) return res.status(400).send("Selfie required");

  const latitude = parseFloat(req.body.latitude);
  const longitude = parseFloat(req.body.longitude);

  const inside = await geo.validate(req);
  if (!inside) return res.status(403).send("Outside geofence");

  await repo.processCheckIn(
    req.user,
    latitude,
    longitude,
    screen_size,
    ip,
    ua,
    req.file.path
  );
  res.send({ success: true });
};

exports.checkOut = async (req, res) => {
  const userId = req.user.id;
  const photo = req.file;

  if (!photo) return res.status(400).send("Selfie photo required");

  const att = await attendanceRepo.findToday(userId);
  if (!att) return res.status(400).send("No check-in found");
  if (att.check_out) return res.status(409).send("Already checked out");

  const diff = (Date.now() - new Date(att.check_in).getTime()) / 60000;
  if (diff < 1) return res.status(403).send("Too fast to checkout");

  await attendanceRepo.checkOut(att.id, photo.path);

  res.send({ success: true });
};
