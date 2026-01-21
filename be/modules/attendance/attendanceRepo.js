const db = require("../../config/db");
const geo = require("./attendanceGeo");
const risk = require("./attendanceRisk");

exports.getOffice = async (companyId) => {
  const r = await db.query(
    `SELECT * FROM office_locations WHERE company_id=$1 AND active=true`,
    [companyId],
  );
  return r.rows[0];
};

exports.findToday = async (userId) => {
  const r = await db.query(
    `SELECT * FROM attendances WHERE user_id=$1 AND date=CURRENT_DATE`,
    [userId],
  );
  return r.rows[0];
};

exports.processCheckIn = async (
  user,
  office,
  lat,
  lng,
  screen,
  ip,
  ua,
  photoPath,
) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const score = await risk.calculate(
      ip,
      ua,
      screen,
      0, // distance sudah dicek di controller
      office.radius,
    );

    const att = await client.query(
      `
      INSERT INTO attendances(
        user_id,
        date,
        check_in_at,
        ip_address,
        user_agent,
        screen_size,
        risk_flag
      )
      VALUES($1,CURRENT_DATE,NOW(),$2,$3,$4,$5)
      RETURNING id
      `,
      [user.id, ip, ua, screen, score],
    );

    await client.query(
      `
      INSERT INTO attendance_photos(
        attendance_id,
        type,
        photo_path,
        latitude,
        longitude
      )
      VALUES($1,'IN',$2,$3,$4)
      `,
      [att.rows[0].id, photoPath, lat, lng],
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23505") {
      throw new Error("Already checked in today");
    }
    throw e;
  } finally {
    client.release();
  }
};

exports.processCheckOut = async (
  user,
  attendanceId,
  lat,
  lng,
  screen,
  ip,
  ua,
  photoPath,
  riskScore,
) => {
  // 🛑 HARD VALIDATION (jangan percaya layer atas)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("INVALID_COORDINATES");
  }

  if (!attendanceId || isNaN(attendanceId)) {
    throw new Error("INVALID_ATTENDANCE_ID");
  }

  if (!Number.isInteger(riskScore)) {
    throw new Error("INVALID_RISK_SCORE");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ lock & verify attendance milik user
    const r = await client.query(
      `
      SELECT id, check_out_at
      FROM attendances
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [attendanceId, user.id],
    );

    const att = r.rows[0];
    if (!att) throw new Error("ATTENDANCE_NOT_FOUND");
    if (att.check_out_at) throw new Error("ALREADY_CHECKED_OUT");

    // 2️⃣ simpan foto (lat/lng DOUBLE)
    await client.query(
      `
      INSERT INTO attendance_photos(
        attendance_id,
        type,
        photo_path,
        latitude,
        longitude
      )
      VALUES ($1,'OUT',$2,$3,$4)
      `,
      [attendanceId, photoPath, lat, lng],
    );

    // 3️⃣ update attendance
    await client.query(
      `
      UPDATE attendances
      SET check_out_at = NOW(),
          status = 'OUT',
          risk_flag = risk_flag | $2
      WHERE id = $1
      `,
      [attendanceId, riskScore],
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

// Mengambil detail kehadiran pengguna pada tanggal tertentu
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
