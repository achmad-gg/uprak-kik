const express = require("express");
const router = express.Router();
const svc = require("./holidaysService");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware"); 

router.get("/", auth, svc.listHolidays);

router.post("/", auth, role("admin"), svc.addHoliday);
router.delete("/:id", auth, role("admin"), svc.deleteHoliday);

module.exports = router;
