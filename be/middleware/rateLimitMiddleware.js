const limits = new Map();

/*
  Memory rate limiter (demo safe, production looking)
*/

module.exports = (req,res,next)=>{
 const ip = req.ip;
 const key = `${ip}:${req.path}`;
 const now = Date.now();

 if(!limits.has(key)){
   limits.set(key, {count:1, time:now});
   return next();
 }

 const entry = limits.get(key);

 if(now - entry.time > 60000){
   limits.set(key, {count:1, time:now});
   return next();
 }

 entry.count++;
 if(entry.count > 15) return res.status(429).send("Too many requests");

 next();
};
