const db = require("../../config/db");

exports.calculate = async (ip, ua, screen, dist, radius) => {
  let risk = 0;

  const ipCount = await db.query(
    `SELECT COUNT(DISTINCT user_id) FROM attendances WHERE ip_address=$1 AND date=CURRENT_DATE`,
    [ip]
  );
  if (ipCount.rows[0].count > 3) risk |= 1;

  const devCount = await db.query(
    `SELECT COUNT(DISTINCT user_id) FROM attendances WHERE user_agent=$1 AND screen_size=$2 AND date=CURRENT_DATE`,
    [ua, screen]
  );
  if (devCount.rows[0].count > 2) risk |= 2;

  if (dist > radius * 0.9) risk |= 4;

  return risk;
};
