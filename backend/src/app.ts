import authRoutes from './routes/auth.routes.js';
import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';
import loanRoutes from './routes/loan.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/loans', loanRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/db-health', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database'
    );

    res.json({
      status: 'connected',
      database: result.rows[0].database
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

export default app;
