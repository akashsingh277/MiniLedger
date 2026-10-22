
import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

function getUserId(req: AuthRequest): string {
  return req.userId!;
}

// GET /loans — list the current user's loans
router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, friend_name AS "friendName", amount::float AS amount,
              TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate",
              is_repaid AS "isRepaid", repaid_at AS "repaidAt",
              created_at AS "createdAt"
       FROM loans
       WHERE user_id = $1
       ORDER BY due_date ASC, id DESC`,
      [getUserId(req)]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List loans failed:', error);
    res.status(500).json({ error: 'Unable to fetch loans' });
  }
});

// POST /loans — add a loan
router.post('/', async (req: AuthRequest, res) => {
  const { friendName, amount, dueDate } = req.body ?? {};
  const numericAmount = Number(amount);

  if (
    typeof friendName !== 'string' ||
    !friendName.trim() ||
    friendName.trim().length > 100 ||
    amount === '' ||
    amount === null ||
    amount === undefined ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate ?? '') ||
    !Number.isFinite(Date.parse(`${dueDate}T00:00:00Z`)) ||
    new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate
  ) {
    return res.status(400).json({
      error: 'Provide a friend name, positive amount, and valid due date (YYYY-MM-DD)'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO loans (user_id, friend_name, amount, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING id, friend_name AS "friendName", amount::float AS amount,
                 TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate",
                 is_repaid AS "isRepaid"`,
      [getUserId(req), friendName.trim(), numericAmount, dueDate]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add loan failed:', error);
    res.status(500).json({ error: 'Unable to create loan' });
  }
});

// PATCH /loans/:id/repay — mark an unpaid loan as repaid
router.patch('/:id/repay', async (req: AuthRequest, res) => {
  const id = req.params.id;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid loan ID' });
  }

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({ error: 'Invalid loan ID' });
  }

  try {
    const result = await pool.query(
      `UPDATE loans
       SET is_repaid = TRUE, repaid_at = NOW()
       WHERE id = $1 AND user_id = $2 AND is_repaid = FALSE
       RETURNING id, friend_name AS "friendName", amount::float AS amount,
                 TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate",
                 is_repaid AS "isRepaid", repaid_at AS "repaidAt"`,
      [id, getUserId(req)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Loan not found or already repaid'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Repay loan failed:', error);
    res.status(500).json({ error: 'Unable to mark loan as repaid' });
  }
});

// GET /loans/summary — totals for the current user
router.get('/summary', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(amount), 0)::float AS "totalLent",
         COALESCE(SUM(amount) FILTER (WHERE is_repaid), 0)::float AS "totalRepaid",
         COALESCE(SUM(amount) FILTER (
           WHERE NOT is_repaid AND due_date < CURRENT_DATE
         ), 0)::float AS "overdueAmount"
       FROM loans
       WHERE user_id = $1`,
      [getUserId(req)]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Summary failed:', error);
    res.status(500).json({ error: 'Unable to fetch summary' });
  }
});

export default router;
