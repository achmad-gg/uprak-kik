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

exports.processCheckIn = async (user, lat, lng, screen, ip, ua, photo) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { office, dist } = await geo.checkLocation(user.company_id, lat, lng);
    const score = await risk.calculate(ip, ua, screen, dist, office.radius);

    const att = await client.query(
      `
      INSERT INTO attendances(
        user_id,
        company_id,
        date,
        check_in_at,
        ip_address,
        user_agent,
        screen_size,
        risk_flag
      )
      VALUES($1,$2,CURRENT_DATE,NOW(),$3,$4,$5,$6)
      RETURNING id
      `,
      [user.id, user.company_id, ip, ua, screen, score],
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
      [att.rows[0].id, photo, lat, lng],
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");

    // 🔒 KUNCI DOUBLE CHECK-IN
    if (e.code === "23505") {
      throw new Error("Already checked in today");
    }

    throw e;
  } finally {
    client.release();
  }
};

exports.processCheckOut = async (user, lat, lng, screen, ip, ua, photo) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const r = await client.query(
      `
      SELECT *
      FROM attendances
      WHERE user_id=$1 AND date=CURRENT_DATE
      FOR UPDATE
      `,
      [user.id],
    );

    const att = r.rows[0];
    if (!att) throw new Error("No check-in");
    if (att.check_out_at) throw new Error("Already checked out");

    const mins = (Date.now() - new Date(att.check_in_at)) / 60000;
    if (mins < 1) throw new Error("Presence too short");

    const { office, dist } = await geo.checkLocation(user.company_id, lat, lng);
    const score =
      att.risk_flag |
      (await risk.calculate(ip, ua, screen, dist, office.radius));

    await client.query(
      `
      INSERT INTO attendance_photos(
        attendance_id,type,photo_path,latitude,longitude
      )
      VALUES($1,'OUT',$2,$3,$4)
      `,
      [att.id, photo, lat, lng],
    );

    await client.query(
      `
      UPDATE attendances
      SET check_out_at=NOW(), risk_flag=$2
      WHERE id=$1
      `,
      [att.id, score],
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
      a.check_in,
      a.check_out,
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
      a.check_in,
      a.check_out,
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
    [userId, date]
  );

  return r.rows;
};
