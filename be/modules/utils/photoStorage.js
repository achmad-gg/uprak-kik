const fs = require("fs");
const path = require("path");
const { UPLOAD_ROOT } = require("../../config/upload");

exports.saveAttendancePhoto = async (type, userId, buffer) => {
  if (!["in", "out"].includes(type)) {
    throw new Error("INVALID_PHOTO_TYPE");
  }

  const dir = path.join(UPLOAD_ROOT, "attendance");
  await fs.promises.mkdir(dir, { recursive: true });

  const filename = `${type}_${userId}_${Date.now()}.jpg`;
  const relativePath = `attendance/${filename}`;
  const absolutePath = path.join(UPLOAD_ROOT, relativePath);

  await fs.promises.writeFile(absolutePath, buffer);

  return { relativePath, absolutePath };
};

exports.deletePhoto = async (absolutePath) => {
  if (!absolutePath) return;
  await fs.promises.unlink(absolutePath).catch(() => {});
};
