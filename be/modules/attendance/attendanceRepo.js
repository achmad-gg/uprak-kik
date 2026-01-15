const db = require("../../config/db");
const geo = require("./attendanceGeo");
const risk = require("./attendanceRisk");

exports.processCheckIn = async (user, lat, lng, screen, ip, ua, photo) => {
  const today = await db.query(
    "SELECT 1 FROM attendances WHERE user_id=$1 AND date=CURRENT_DATE",
    [user.id]
  );
  if (today.rowCount) throw "Already checked in";

  const { office, dist } = await geo.validate(user.company_id, lat, lng);
  const score = await risk.calculate(ip, ua, screen, dist, office.radius);

  await db.query("BEGIN");
  const att = await db.query(
    `
  INSERT INTO attendances(user_id,date,check_in,status,ip_address,user_agent,screen_size,risk_flag)
  VALUES($1,CURRENT_DATE,NOW(),'IN',$2,$3,$4,$5) RETURNING id`,
    [user.id, ip, ua, screen, score]
  );
  await db.query(
    `
  INSERT INTO attendance_photos(attendance_id,type,photo_path,latitude,longitude)
  VALUES($1,'IN',$2,$3,$4)`,
    [att.rows[0].id, photo, lat, lng]
  );
  await db.query("COMMIT");
};

exports.processCheckOut = async (user, lat, lng, screen, ip, ua, photo) => {
  const att = await db.query(
    "SELECT * FROM attendances WHERE user_id=$1 AND date=CURRENT_DATE",
    [user.id]
  );
  if (!att.rowCount) throw "No check-in";
  if (att.rows[0].check_out) throw "Already checked out";

  const { office, dist } = await geo.validate(user.company_id, lat, lng);
  const mins = (Date.now() - new Date(att.rows[0].check_in)) / 60000;
  if (mins < 1) throw "Presence too short";

  const score =
    att.rows[0].risk_flag |
    (await risk.calculate(ip, ua, screen, dist, office.radius));

  await db.query("BEGIN");
  await db.query(
    `
  INSERT INTO attendance_photos(attendance_id,type,photo_path,latitude,longitude)
  VALUES($1,'OUT',$2,$3,$4)`,
    [att.rows[0].id, photo, lat, lng]
  );
  await db.query(
    `
  UPDATE attendances SET check_out=NOW(), status='OUT', risk_flag=$2 WHERE id=$1`,
    [att.rows[0].id, score]
  );
  await db.query("COMMIT");
};

exports.getOffice = (companyId)=>{
 return db.query(
  `SELECT latitude, longitude, radius
   FROM office_locations
   WHERE company_id=$1`,
  [companyId]
 ).then(r=>r.rows[0]);
};
