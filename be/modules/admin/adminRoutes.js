const router = require("express").Router();
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");
const adminService = require("./adminService");

router.post("/users", auth, role("admin"), adminService.createUser);

router.post("/office", auth, role("admin"), adminService.setOffice);

module.exports = router;
