const router = require("express").Router();
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");
const adminService = require("./adminService");

router.post("/users", auth, role("admin"), adminService.createUser);
router.post("/office", auth, role("admin"), adminService.setOffice);
router.get("/dashboard", auth, role("admin"), async (req, res) => {
  const data = await adminService.dashboardSummary(req.user.company_id);
  res.json(data);
});
router.put("/users/:id", auth, role("admin"), adminService.updateUser);
router.patch(
  "/users/:id/reset-password",
  auth,
  role("admin"),
  adminService.resetPassword,
);
router.patch(
  "/users/:id/disable",
  auth,
  role("admin"),
  adminService.disableUser,
);
router.patch("/users/:id/enable", auth, role("admin"), adminService.enableUser);
router.get("/users/all", auth, role("admin"), adminService.listUsers);
router.delete("/users/:id", auth, role("admin"), adminService.deleteUser);

// companies
router.post("/create/company", auth, role("admin"), adminService.createCompany);

router.get("/companies", auth, role("admin"), adminService.listCompanies);

router.put("/companies/:id", auth, role("admin"), adminService.updateCompany);

router.delete(
  "/companies/:id",
  auth,
  role("admin"),
  adminService.deleteCompany,
);

router.put(
  "/company/:id/office",
  auth,
  role("admin"),
  adminService.setOffice,
);

// Audit Logs
// router.get("/audits", auth, role("admin"), adminService.getAudits);

module.exports = router;
