const router = require("express").Router();
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");
const adminService = require("./adminService");

// === USERS ===
router.post("/users", auth, role("admin"), adminService.createUser);
router.get("/dashboard", auth, role("admin"), async (req, res) => { 
    const data = await adminService.dashboardSummary(req.user.company_id); 
    res.json(data); 
});
router.put("/users/:id", auth, role("admin"), adminService.updateUser);
router.patch("/users/:id/reset-password", auth, role("admin"), adminService.resetPassword);
router.patch("/users/:id/disable", auth, role("admin"), adminService.disableUser);
router.patch("/users/:id/enable", auth, role("admin"), adminService.enableUser);
router.get("/users/all", auth, role("admin"), adminService.listUsers);
router.delete("/users/:id", auth, role("admin"), adminService.deleteUser);

// === COMPANIES ===
router.post("/companies", auth, role("admin"), adminService.createCompany); 
router.get("/companies", auth, role("admin"), adminService.listCompanies);
router.put("/companies/:id", auth, role("admin"), adminService.updateCompany);
router.patch("/companies/:id/status", auth, role("admin"), adminService.toggleCompanyStatus);
router.delete("/companies/:id", auth, role("admin"), adminService.deleteCompany);

// === OFFICE LOCATIONS ===
router.get("/office", auth, role("admin"), adminService.getOffice);
router.get("/office/:id", auth, role("admin"), adminService.getOfficeByCompany); 
router.post("/office", auth, role("admin"), adminService.setOffice); 

module.exports = router;