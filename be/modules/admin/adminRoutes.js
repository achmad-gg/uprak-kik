const router = require("express").Router();
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");
const adminService = require("./adminService");

router.post("/users", auth, role("admin"), adminService.createUser);
router.post("/office", auth, role("admin"), adminService.setOffice);
// Dashboard Summary
router.get(
  "/dashboard",
  auth,
  role("admin"),
  async (req, res) => {
    const data = await adminService.dashboardSummary(
      req.user.company_id
    );
    res.json(data);
  }
);

// Dashboard List Users
router.get(
  "/users/all",
  auth,
  role("admin"),
  adminService.listUsers,
);


module.exports = router;
