const db = require('../../config/db');

exports.getActive = (companyId)=>{
 return db.query(`
  SELECT * FROM office_locations
  WHERE company_id=$1 AND active=true LIMIT 1`,
  [companyId]).then(r=>r.rows[0]);
};
