const hits = new Map();

module.exports = (req,res,next)=>{
 if(!req.user) return next();

 const key = req.user.id;
 const now = Date.now();

 if(!hits.has(key)){
   hits.set(key,{count:1,time:now});
   return next();
 }

 const e = hits.get(key);

 if(now - e.time > 60000){
   hits.set(key,{count:1,time:now});
   return next();
 }

 e.count++;
 if(e.count > 5) return res.status(429).send("Slow down");

 next();
};
