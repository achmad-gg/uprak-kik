const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const users = require('../users/usersRepo');

exports.register = async (req,res)=>{
 const { name,email,password } = req.body;
 await users.create(name,email,password);
 res.send({success:true});
};

exports.login = async (req,res)=>{
 const { email,password } = req.body;
 const user = await users.findByEmail(email);
 if(!user || !bcrypt.compareSync(password,user.password_hash))
   return res.status(401).send("Invalid credentials");

 const token = jwt.sign(
   { id:user.id, role:user.role, company_id:user.company_id },
   process.env.JWT_SECRET, {expiresIn:'12h'}
 );
 res.send({token});
};

