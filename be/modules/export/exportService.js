const auditRepo = require('../audit/auditRepo');

exports.daily = async (req,res)=>{
 const rows = await auditRepo.dailyByDate(req.params.date);
 res.json(rows);
};

exports.user = async (req,res)=>{
 const rows = await auditRepo.timeline(req.params.id);
 res.json(rows);
};
