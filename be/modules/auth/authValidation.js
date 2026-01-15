exports.register = (req,res,next)=>{
 if(!req.body.email || !req.body.password) return res.sendStatus(400);
 next();
};
