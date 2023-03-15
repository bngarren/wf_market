// @ts-nocheck
import * as dotenv from "dotenv"
import pkg from "pg";
const {Pool} = pkg;

dotenv.config()

const pool = new Pool({connectionString: process.env.DB_CONNECTION_STRING});

export const query = async (text, params) => {
    try {
        const res = await pool.query(text, params)
        // console.log('executed query', { text, params: params });
        return res;
    } catch (error) {
        console.log(error.stack)
        
    }
}