const Firebird = require('node-firebird');
require('dotenv').config();

const options = {
  host: process.env.FB_HOST,
  port: Number(process.env.FB_PORT),
  database: process.env.FB_DATABASE,
  user: process.env.FB_USER,
  password: process.env.FB_PASSWORD,
  lowercase_keys: false,
  role: null,
  pageSize: 4096,
};

function connectFirebird() {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

module.exports = { connectFirebird };
