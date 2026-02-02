const db = require("../../config/db");

exports.getOffice = async (companyId) => {
  const r = await db.query(
    `SELECT * FROM office_locations WHERE company_id=$1 AND active=true`,
    [companyId],
  );
  return r.rows[0];
};

exports.findToday = async (userId) => {
  const r = await db.query(
    `SELECT id, check_in_at, check_out_at, status 
     FROM attendances 
     WHERE user_id=$1 AND date=CURRENT_DATE`,
    [userId],
  );
  return r.rows[0];
};

exports.processCheckIn = async (payload) => {
  const {
    user,
    office,
    lat,
    lng,
    screen,
    ip,
    ua,
    photoPath,
    riskScore,
    isLate,
  } = payload;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    let finalRisk = riskScore;
    if (isLate) finalRisk |= 8;
    const att = await client.query(
      `INSERT INTO attendances(
        user_id, date, check_in_at, status, 
        ip_address, user_agent, screen_size, risk_flag
      )
      VALUES($1, CURRENT_DATE, NOW(), 'IN', $2, $3, $4, $5)
      RETURNING id`,
      [user.id, ip, ua, screen, finalRisk],
    );

    await client.query(
      `INSERT INTO attendance_photos(
        attendance_id, type, photo_path, latitude, longitude
      )
      VALUES($1, 'IN', $2, $3, $4)`,
      [att.rows[0].id, photoPath, lat, lng],
    );

    await client.query("COMMIT");
    return att.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23505") {
      throw new Error("ALREADY_CHECKED_IN");
    }
    throw e;
  } finally {
    client.release();
  }
};

exports.processCheckOut = async (payload) => {
  const { user, attendanceId, lat, lng, photoPath, riskScore } = payload;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const check = await client.query(
      `SELECT id, check_out_at FROM attendances WHERE id=$1 FOR UPDATE`,
      [attendanceId],
    );

    if (check.rowCount === 0) throw new Error("ATTENDANCE_NOT_FOUND");
    if (check.rows[0].check_out_at) throw new Error("ALREADY_CHECKED_OUT");

    await client.query(
      `UPDATE attendances
       SET check_out_at = NOW(),
           status = 'OUT',
           risk_flag = risk_flag | $2
       WHERE id = $1`,
      [attendanceId, riskScore],
    );

    await client.query(
      `INSERT INTO attendance_photos(
        attendance_id, type, photo_path, latitude, longitude
      )
      VALUES ($1, 'OUT', $2, $3, $4)`,
      [attendanceId, photoPath, lat, lng],
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

// Mengambil riwayat kehadiran pengguna
exports.getUserHistory = async (userId) => {
  const r = await db.query(
    `
    SELECT
      a.date,
      a.check_in_at AS check_in,
      a.check_out_at AS check_out,
      a.status,
      a.risk_flag
    FROM attendances a
    WHERE a.user_id = $1
    ORDER BY a.date DESC
    LIMIT 30
    `,
    [userId],
  );
  return r.rows;
};

exports.getUserAttendanceDetail = async (userId, date) => {
  const r = await db.query(
    `
    SELECT
      a.date,
      a.check_in_at AS check_in,
      a.check_out_at AS check_out,
      a.status,
      a.risk_flag,
      p.type,
      p.photo_path
    FROM attendances a
    LEFT JOIN attendance_photos p
      ON p.attendance_id = a.id
    WHERE a.user_id = $1
      AND a.date = $2
    `,
    [userId, date],
  );

  return r.rows;
};

exports.exportDaily = async (date) => {
  const sql = `
    SELECT
  a.id AS attendance_id,
  to_char(a.date, 'YYYY-MM-DD') AS date,
  a.check_in_at,
  a.check_out_at,
  CASE
    WHEN a.check_in_at IS NOT NULL THEN 'present'
    ELSE 'absent'
  END AS status,
  u.id AS user_id,
  u.name,
  u.email,
  c.name AS company_name
FROM attendances a
JOIN users u ON u.id = a.user_id
LEFT JOIN companies c ON c.id = u.company_id
WHERE a.date = $1
ORDER BY u.name ASC;

  `;
  const res = await db.query(sql, [date]);
  return res.rows;
};

exports.exportMonthly = async (month) => {
  const sql = `
    SELECT
      a.id AS attendance_id,
      to_char(a.date, 'YYYY-MM-DD') AS date,
      a.check_in_at,
      a.check_out_at,
      CASE
        WHEN a.check_in_at IS NOT NULL THEN 'present'
        ELSE 'absent'
      END AS status,
      u.id AS user_id,
      u.name,
      u.email,
      c.name AS company_name
    FROM attendances a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE a.date >= $1
      AND a.date < ($1 + INTERVAL '1 month')
    ORDER BY a.date ASC, u.name ASC
  `

  const startDate = `${month}-01` // ← INI KUNCI
  return (await db.query(sql, [startDate])).rows
}


exports.exportRange = async (start, end) => {
  const sql = `
    SELECT
      a.id AS attendance_id,
      a.date,
      a.check_in_at,
      a.check_out_at,
      CASE
        WHEN a.check_in_at IS NOT NULL THEN 'present'
        ELSE 'absent'
      END AS status,
      u.id AS user_id,
      u.name,
      u.email,
      c.name AS company_name
    FROM attendances a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE a.date BETWEEN $1 AND $2
    ORDER BY a.date ASC, u.name ASC
  `
  return (await db.query(sql, [start, end])).rows
}

