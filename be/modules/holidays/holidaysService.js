const repo = require("./holidaysRepo");
const axios = require('axios');

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

exports.syncExternalHolidays = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const apiUrl = `https://api-harilibur.vercel.app/api?year=${currentYear}`;
    
    const response = await axios.get(apiUrl);
    const externalHolidays = response.data; 

    let addedCount = 0;

    for (const h of externalHolidays) {

      const date = h.holiday_date; 
      const name = h.holiday_name;
      
      const existing = await repo.checkDate(date);
      
      if (!existing && h.is_national_holiday) {
        await repo.create(date, name, 'Libur Nasional (Auto Sync)');
        addedCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Sinkronisasi selesai. ${addedCount} hari libur baru ditambahkan.`,
      data: { added: addedCount }
    });

  } catch (err) {
    console.error("Sync Error:", err);
    res.status(500).json({ message: "Gagal mengambil data dari API eksternal" });
  }
};