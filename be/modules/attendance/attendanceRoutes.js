const express = require("express");
const router = express.Router();
const upload = require("../../config/multer");
const auth = require("../../middleware/authMiddleware");
const svc = require("./attendanceService");


router.post("/check-in",
 auth,
 upload.single("photo"),
 svc.checkIn
);

router.post("/check-out",
 auth,
 upload.single("photo"),
 svc.checkOut
);

router.get("/me/history", auth, async (req, res) => {
  const data = await svc.getMyHistory(req.user.id);
  res.json(data);
});

router.get("/me/:date", auth, async (req, res) => {
  const data = await svc.getMyAttendanceDetail(
    req.user.id,
    req.params.date
  );
  res.json(data);
});


module.exports = router;
