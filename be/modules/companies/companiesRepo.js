const db = require('../../config/db');

exports.create = (name)=>{
 return db.query(`INSERT INTO companies(name) VALUES($1)`,[name]);
};
