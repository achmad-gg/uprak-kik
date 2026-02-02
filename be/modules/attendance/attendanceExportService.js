// modules/attendance/attendanceExportService.js
const attendanceRepo = require('./attendanceRepo');
const audit = require('../admin/adminAudit');

exports.exportDaily = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: 'date is required' });

  const rows = await attendanceRepo.exportDaily(date);

  await audit.log({
    adminId: req.user.id,
    action: 'EXPORT_ATTENDANCE_DAILY',
    description: `Export attendance harian: ${date}`,
  });

  res.json({ success: true, data: rows });
};

exports.exportMonthly = async (req, res) => {
  const { month } = req.query;
  if (!/^\d{4}-\d{2}$/.test(month)) {
  return res.status(400).json({
    message: 'month must be in YYYY-MM format'
  })
}


  const rows = await attendanceRepo.exportMonthly(month);

  await audit.log({
    adminId: req.user.id,
    action: 'EXPORT_ATTENDANCE_MONTHLY',
    description: `Export attendance bulanan: ${month}`,
  });

  res.json({ success: true, data: rows });
};

exports.exportRange = async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ message: 'start & end required' });
  }

  const rows = await attendanceRepo.exportRange(start, end);

  await audit.log({
    adminId: req.user.id,
    action: 'EXPORT_ATTENDANCE_RANGE',
    description: `Export attendance ${start} s/d ${end}`,
  });

  res.json({ success: true, data: rows });
};
