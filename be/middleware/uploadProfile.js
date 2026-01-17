const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: 'uploads/profiles',
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random()}${ext}`);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
});
