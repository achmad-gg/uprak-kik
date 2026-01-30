const express = require("express");
const router = express.Router();
const svc = require("./leavesService");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");
const upload = require("../../config/multer"); // Pastikan config multer mendukung folder uploads/leaves

// User Routes
router.post("/request", auth, upload.single("attachment"), svc.createRequest);
router.get("/me", auth, svc.getMyRequests);

// Admin Routes
router.get("/all", auth, role("admin"), svc.getAllRequests);
router.put("/:id/approve", auth, role("admin"), svc.approveRequest);
router.put("/:id/reject", auth, role("admin"), svc.rejectRequest);

module.exports = router;
