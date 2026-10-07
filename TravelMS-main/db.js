const mysql = require('mysql2/promise');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

function databaseOptions(database = process.env.DB_NAME || 'travelms') {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ...(database ? { database } : {}),
    dateStrings: true,
    decimalNumbers: true,
    connectionLimit: 10,
  };
}

module.exports = {
  databaseOptions,
  createPool: (database) => mysql.createPool(databaseOptions(database)),
};
