const express = require("express");
const router = express.Router();
const upload = require("../../config/multer");
const auth = require("../../middleware/authMiddleware");
const svc = require("./attendanceService");

router.post("/check-in", auth, upload.single("photo"), svc.checkIn);

router.post("/check-out", auth, upload.single("photo"), svc.checkOut);

router.get("/me/history", auth, async (req, res) => {
  try {
    const data = await svc.getMyHistory(req.user.id);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).send("Failed to get history");
  }
});

router.get("/me/recap", auth, svc.getMonthlyRecap);
router.get("/me/office", auth, svc.getMyOffice);
router.get("/me/:date", auth, async (req, res) => {
  try {
    const data = await svc.getMyAttendanceDetail(
      req.user.id,
      req.params.date
    );
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).send("Failed to get attendance detail");
  }
});
router.get('/test-wa', async (req, res) => {
  try {
    const result = await scheduler.runWAReminderJob();
    res.json({ 
      message: "Trigger WA Reminder Berhasil dijalankan!", 
      detail: result 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


module.exports = router;
