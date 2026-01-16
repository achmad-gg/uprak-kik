const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const users = require('../users/usersRepo');

exports.register = async (req, res) => {
  const { name, email, password, company_id, role } = req.body; 

  try {
    await users.create(name, email, password, company_id, role);
    res.send({ success: true, message: `User registered as ${role || 'intern'}` });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await users.findByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).send("Invalid credentials");

  const token = jwt.sign(
    { id: user.id, role: user.role, company_id: user.company_id },
    process.env.JWT_SECRET, { expiresIn: '12h' }
  );
  res.send({ token });
};