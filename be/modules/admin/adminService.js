const bcrypt = require("bcrypt");
const db = require("../../config/db");

exports.createUser = async (req, res) => {
  const { name, email, password, role, company_id } = req.body;

  if (!email || !password || !company_id)
    return res.status(400).send("Invalid data");

  const hash = await bcrypt.hash(password, 10);

  await db.query(
    `
    INSERT INTO users(name,email,password_hash,role,company_id)
    VALUES($1,$2,$3,$4,$5)
    `,
    [name, email, hash, role || "intern", company_id],
  );

  res.send({ success: true });
};

exports.setOffice = async (req, res) => {
  const { company_id, latitude, longitude, radius } = req.body;

  await db.query(
    `
    INSERT INTO office_locations(company_id,latitude,longitude,radius,active)
    VALUES($1,$2,$3,$4,true)
    ON CONFLICT (company_id)
    DO UPDATE SET latitude=$2, longitude=$3, radius=$4, active=true
    `,
    [company_id, latitude, longitude, radius],
  );

  res.send({ success: true });
};

exports.listUsers = async (req, res) => {
  const { company_id } = req.query;

  let sql = `
    SELECT
  u.id,
  u.name,
  u.email,
  u.role,
  u.company_id,
  c.name AS company_name,
  a.status,
  a.check_in,
  a.check_out
FROM users u
JOIN companies c ON c.id = u.company_id
LEFT JOIN attendances a
  ON a.user_id = u.id
  AND a.date = CURRENT_DATE
WHERE u.role = 'intern'
ORDER BY u.created_at DESC;

  `;
  const params = [];

  if (company_id) {
    sql += " AND u.company_id=$1";
    params.push(company_id);
  }

  const r = await db.query(sql, params);
  res.json(r.rows);
};

// ================== Dashboard Summary ===================
exports.dashboardSummary = async (companyId) => {
  const r = await db.query(
    `
    SELECT
  COUNT(u.id) FILTER (WHERE u.role = 'intern')             AS total_users,

  COUNT(a.id) FILTER (
    WHERE a.date = CURRENT_DATE AND a.check_in IS NOT NULL
  )                                                        AS present_today,

  COUNT(u.id) FILTER (
    WHERE u.role = 'intern'
      AND NOT EXISTS (
        SELECT 1 FROM attendances a2
        WHERE a2.user_id = u.id
          AND a2.date = CURRENT_DATE
      )
  )                                                        AS absent_today,

  COUNT(a.id) FILTER (
    WHERE a.date = CURRENT_DATE AND a.check_out IS NOT NULL
  )                                                        AS checked_out_today,

  (SELECT COUNT(*) FROM office_locations WHERE active=true)
                                                           AS active_offices
FROM users u
LEFT JOIN attendances a
  ON a.user_id = u.id AND a.date = CURRENT_DATE
WHERE u.company_id = $1;

  `,
    [companyId],
  );

  return r.rows[0];
};
