
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { generateOtp, verifyOtp } from '../otp.js';

const router = Router();

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const phone = value.trim();

  // Accept an Indian mobile number, optionally prefixed by +91.
  if (!/^(?:\+91)?[6-9]\d{9}$/.test(phone)) return null;

  return phone.startsWith('+91') ? phone.slice(3) : phone;
}

router.post('/send-otp', (req, res) => {
  const phone = normalizePhone(req.body?.phone);

  if (!phone) {
    return res.status(400).json({
      error: 'Enter a valid Indian mobile number'
    });
  }

  generateOtp(phone);

  return res.json({
    message: 'Mock OTP generated. Check the backend terminal.'
  });
});

router.post('/verify-otp', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = req.body?.otp;

  if (!phone || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return res.status(400).json({
      error: 'Valid phone number and six-digit OTP are required'
    });
  }

  if (!verifyOtp(phone, code)) {
    return res.status(401).json({
      error: 'Invalid or expired OTP'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO users (phone)
       VALUES ($1)
       ON CONFLICT (phone)
       DO UPDATE SET phone = EXCLUDED.phone
       RETURNING id, phone`,
      [phone]
    );

    const user = result.rows[0];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('JWT_SECRET is missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const token = jwt.sign(
      { sub: String(user.id) },
      secret,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: String(user.id),
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('OTP verification failed:', error);
    return res.status(500).json({ error: 'Unable to complete login' });
  }
});

export default router;
