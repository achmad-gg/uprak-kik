const router = require('express').Router();
const auth = require('../../middleware/authMiddleware');
const role = require('../../middleware/roleMiddleware');
const svc = require('./auditService');

router.get('/daily', auth, role('admin'), svc.dailySummary);
router.get('/risks', auth, role('admin'), svc.riskList);
router.get('/user/:id', auth, role('admin'), svc.userAudit);

module.exports = router;
