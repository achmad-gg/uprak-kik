module.exports = (role)=>{
 return (req,res,next)=>{
   if(!req.user) return res.sendStatus(401);
   if(req.user.role !== role) return res.sendStatus(403);
   next();
 };
};
