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
    [name, email, hash, role || "intern", company_id]
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
    [company_id, latitude, longitude, radius]
  );

  res.send({ success: true });
};
