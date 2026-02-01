const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const users = require('../users/usersRepo');
const path = require('path');


exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await users.findByEmail(email);

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (user.company_is_active === false) {
    return res.status(403).json({ 
      message: 'Akses Ditolak: Perusahaan Anda telah dinonaktifkan oleh sistem. Silakan hubungi Administrator.' 
    });
  }

  if (user.status === false) {
    return res.status(403).json({ 
      message: 'Akun Anda telah dinonaktifkan. Hubungi Admin.' 
    });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      company_id: user.company_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
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

exports.me = async (req, res) => {
  try {
    const user = await users.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    delete user.password_hash;
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const data = { ...req.body };

    if (data.password) {
      if (data.password.length < 6) {
        return res
          .status(400)
          .json({ message: 'Password minimal 6 karakter' });
      }

      data.password_hash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }

    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
      return res.status(400).json({ message: 'Format email tidak valid' });
    }

    const updateData = {
        name: req.body.name || null,
        email: req.body.email || null,
        phone_number: req.body.phone_number || null,
        bio: req.body.bio || null,
        address: req.body.address || null,
    };

    if (req.file) {
      updateData.profile_picture = path.join('/uploads/profiles', req.file.filename);
    } else {
      updateData.profile_picture = null; 
    }

    const updatedUser = await users.updateProfile(req.user.id, updateData);
    
    if (!updatedUser) {
        return res.status(404).json({ message: 'User not found or update failed' });
    }

    delete updatedUser.password_hash;

    res.json(updatedUser);
  } catch (err) {
    console.error(err); 
    res.status(500).json({ message: err.message });
  }
};
