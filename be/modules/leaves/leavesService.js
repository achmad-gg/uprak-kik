const repo = require("./leavesRepo");
const fs = require("fs");

exports.createRequest = async (req, res) => {
  try {
    const { type, start_date, end_date, reason } = req.body;
    const userId = req.user.id;
    let attachmentUrl = null;

    if (req.file) {
      attachmentUrl = `/uploads/leaves/${req.file.filename}`;
    } else {
        attachmentUrl = null; 
    }

    if (type === 'sakit' && !req.file) {
      return res.status(400).json({ message: "Bukti sakit (Surat Dokter) wajib diupload" });
    }

    if (!type || !start_date || !end_date || !reason) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Data formulir tidak lengkap" });
    }

    if (new Date(start_date) > new Date(end_date)) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Tanggal selesai tidak boleh sebelum tanggal mulai" });
    }

    const isOverlap = await repo.checkOverlap(userId, start_date, end_date);
    if (isOverlap) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(409).json({ message: "Anda sudah memiliki pengajuan pada tanggal tersebut" });
    }

    const result = await repo.createRequest(userId, type, start_date, end_date, reason, attachmentUrl);
    
    res.json({ success: true, message: "Pengajuan berhasil dikirim", data: result });

  } catch (err) {
    console.error(err);
    if (req.file && req.file.path) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Gagal membuat pengajuan" });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const data = await repo.findByUser(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const data = await repo.findAll(status);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    await repo.approveRequest(id, req.user.id);
    res.json({ success: true, message: "Pengajuan disetujui & Absensi tercatat otomatis" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menyetujui pengajuan" });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    
    await repo.rejectRequest(id, note || "Ditolak oleh admin", req.user.id);
    
    res.json({ success: true, message: "Pengajuan ditolak" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
