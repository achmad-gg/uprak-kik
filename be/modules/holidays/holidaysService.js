const repo = require("./holidaysRepo");

exports.listHolidays = async (_req, res) => {
  try {
    const data = await repo.getAll();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addHoliday = async (req, res) => {
  try {
    const { date, name, description } = req.body;
    if (!date || !name) {
      return res.status(400).json({ message: "Tanggal dan Nama wajib diisi" });
    }
    const data = await repo.create(date, name, description);
    res.json({ success: true, message: "Hari libur ditambahkan", data });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: "Tanggal tersebut sudah ada di daftar libur" });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.deleteHoliday = async (req, res) => {
  try {
    await repo.delete(req.params.id);
    res.json({ success: true, message: "Hari libur dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
