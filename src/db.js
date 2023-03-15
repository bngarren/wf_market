import * as dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();


// Use a local database for development and use a remote database for production
// i.e. for dev, use mac's local pgsql. for prod, use little jerry's pgsql


let conObject = {}

console.log(process.env)

if (process.env.NODE_ENV === "development") {
    conObject = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DB,
        port: process.env.DB_PORT,
    }
} else {
    conObject = {
        connectionString: process.env.DB_CONNECTION_STRING
    }
}

const pool = new Pool(conObject);

console.log(conObject)

export const query = async (text, params) => {
  try {
    const res = await pool.query(text, params);
    // console.log('executed query', { text, params: params });
    return res;
  } catch (error) {
    console.log(error.stack);
  }
};
