import { pool } from './config/db.js';

async function testConnection() {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database, NOW() AS server_time'
    );

    console.log('Connected to Neon successfully!');
    console.log(result.rows[0]);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();