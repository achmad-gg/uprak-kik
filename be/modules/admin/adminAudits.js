const db = require("../../config/db");

exports.log = async ({
  adminId,
  action,
  targetTable = null,
  targetId = null,
  description = null
}) => {
  try {
    await db.query(
      `INSERT INTO admin_audits
       (admin_id, action, target_type, target_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, action, targetTable, targetId, description]
    );
  } catch (err) {
    console.error("AUDIT FAILED:", err.message);
    // sengaja DIABAIKAN
  }
};
