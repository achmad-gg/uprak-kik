const router = require('express').Router();
const svc = require('./authService');
const authMiddleware = require('../../middleware/authMiddleware');
const upload = require('../../middleware/uploadProfile');

router.post('/register', svc.register);
router.post('/login', svc.login);

router.get('/me', authMiddleware, svc.me);
router.put(
  '/update-profile',
  authMiddleware,
  upload.single('profile_picture'),
  svc.updateProfile
);

module.exports = router;
