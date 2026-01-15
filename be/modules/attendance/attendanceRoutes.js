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

module.exports = router;
