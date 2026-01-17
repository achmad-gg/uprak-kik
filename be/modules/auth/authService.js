const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const users = require("../users/usersRepo");

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await users.findByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).send("Invalid credentials");

  const token = jwt.sign(
    { id: user.id, role: user.role, company_id: user.company_id },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
  res.send({
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      company_id: user.company_id,
    },
  });
};
