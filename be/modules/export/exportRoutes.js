const router = require("express").Router();
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");
const svc = require("./exportService");

router.get("/daily/:date", auth, role("admin"), svc.daily);
router.get("/user/:id", auth, role("admin"), svc.user);

module.exports = router;
