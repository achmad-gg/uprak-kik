const db = require("../config/db");
const jwt = require("jsonwebtoken");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).send("No token");

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await db.query(
    `SELECT id, role, company_id FROM users WHERE id=$1`,
    [decoded.id]
  );

  if (!user.rowCount) return res.status(401).send("Invalid token");

  req.user = user.rows[0];
  next();
};
