exports.daily = async () => {
  return db
    .query(
      `
  SELECT date,
         COUNT(*) total,
         COUNT(*) FILTER (WHERE risk_flag > 0) risky,
         COUNT(*) FILTER (WHERE status='OUT') completed
  FROM attendances
  GROUP BY date
  ORDER BY date DESC
 `
    )
    .then((r) => r.rows);
};

exports.risky = async () => {
  return db
    .query(
      `
  SELECT u.name, u.email, a.date, a.risk_flag,
         a.ip_address, a.user_agent
  FROM attendances a
  JOIN users u ON u.id = a.user_id
  WHERE a.risk_flag > 0
  ORDER BY a.date DESC, a.risk_flag DESC
 `
    )
    .then((r) => r.rows);
};

exports.timeline = async (id) => {
  return db
    .query(
      `
  SELECT a.date,
         a.check_in, a.check_out,
         a.risk_flag,
         p.type, p.photo_path, p.latitude, p.longitude
  FROM attendances a
  LEFT JOIN attendance_photos p ON p.attendance_id = a.id
  WHERE a.user_id=$1
  ORDER BY a.date DESC, p.type
 `,
      [id]
    )
    .then((r) => r.rows);
};

exports.dailyByDate = (date) => {
  return db
    .query(
      `
  SELECT u.name, a.date, a.check_in, a.check_out, a.risk_flag
  FROM attendances a
  JOIN users u ON u.id = a.user_id
  WHERE a.date=$1`,
      [date]
    )
    .then((r) => r.rows);
};
