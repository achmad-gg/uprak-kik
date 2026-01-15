const router = require('express').Router();
const svc = require('./authService');

router.post('/register', svc.register);
router.post('/login', svc.login);

module.exports = router;
