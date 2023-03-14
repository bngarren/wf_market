import pkg from "pg";
const {Pool} = pkg;

const pool = new Pool({
    user: 'bngarren',
    host: 'localhost',
    database: 'wf_market',
    password: 'bng2113!',
    port: 5432,
});

export const query = async (text, params) => {
    try {
        const res = await pool.query(text, params)
        // console.log('executed query', { text, params: params });
        return res;
    } catch (error) {
        console.log(error.stack)
        
    }
}