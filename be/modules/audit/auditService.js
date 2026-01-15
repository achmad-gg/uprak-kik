const repo = require('./auditRepo');

exports.dailySummary = async (req,res)=>{
 res.json(await repo.daily());
};

exports.riskList = async (req,res)=>{
 res.json(await repo.risky());
};

exports.userTimeline = async (req,res)=>{
 res.json(await repo.timeline(req.params.id));
};
