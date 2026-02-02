// modules/attendance/attendanceExportRoute.js
const router = require('express').Router();
const auth = require('../../middleware/authMiddleware');
const role = require('../../middleware/roleMiddleware');
const svc = require('./attendanceExportService');

router.get('/attendance/daily', auth, role('admin'), svc.exportDaily);
router.get('/attendance/monthly', auth, role('admin'), svc.exportMonthly);
router.get('/attendance/range', auth, role('admin'), svc.exportRange);

module.exports = router;
