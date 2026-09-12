   const express = require('express');
   const bcrypt = require('bcrypt');
   const { v4: uuidv4 } = require('uuid');
   const pool = require('./db/pool');
   const jwt = require('jsonwebtoken');
   const crypto = require('crypto');

   const router = express.Router();

   
   router.post('/register', async (req, res) => {
     const { name, phone, password } = req.body;

     // Basic validation
     if (!name || !phone || !password) {
       return res.status(400).json({ error: true, message: 'name, phone, and password are required' });
     }
     if (password.length < 6) {
       return res.status(400).json({ error: true, message: 'Password must be at least 6 characters' });
     }

     try {
       const passwordHash = await bcrypt.hash(password, 12);
       const userId = uuidv4();

       await pool.query(
         `INSERT INTO users (id, name, phone, password_hash, created_at)
          VALUES ($1, $2, $3, $4, NOW())`,
         [userId, name, phone, passwordHash]
       );

       res.status(201).json({ userId, message: 'Account created successfully' });
     } catch (err) {
       if (err.code === '23505') {
         // PostgreSQL unique constraint violation (phone already exists)
         return res.status(409).json({ error: true, message: 'Phone number already registered' });
       }
       console.error('Register error:', err);
       res.status(500).json({ error: true, message: 'Something went wrong. Please try again.' });
     }
   });

     
   
   router.post('/login', async (req, res) => {
     const { phone, password } = req.body;

     if (!phone || !password) {
       return res.status(400).json({ error: true, message: 'phone and password are required' });
     }

     try {
       const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);

       if (result.rows.length === 0) {
         return res.status(401).json({ error: true, message: 'Invalid phone or password' });
       }

       const user = result.rows[0];
       const passwordMatches = await bcrypt.compare(password, user.password_hash);

       if (!passwordMatches) {
         return res.status(401).json({ error: true, message: 'Invalid phone or password' });
       }

       const accessToken = jwt.sign(
         { userId: user.id, role: user.role },
         process.env.JWT_SECRET,
         { expiresIn: '15m' }
       );

       const refreshToken = jwt.sign(
         { userId: user.id },
         process.env.JWT_REFRESH_SECRET,
         { expiresIn: '7d' }
       );

       res.status(200).json({
         accessToken,
         refreshToken,
         userId: user.id,
         name: user.name,
       });
     } catch (err) {
       console.error('Login error:', err);
       res.status(500).json({ error: true, message: 'Something went wrong. Please try again.' });
     }
   });


      router.post('/send-otp', async (req, res) => {
     const { phone } = req.body;

     if (!phone) {
       return res.status(400).json({ error: true, message: 'phone is required' });
     }

     try {
       const otp = crypto.randomInt(100000, 999999).toString();
       const otpHash = await bcrypt.hash(otp, 10);

       await pool.query(
         `INSERT INTO otp_verifications (phone, otp_hash) VALUES ($1, $2)`,
         [phone, otpHash]
       );

       // TODO: replace this with real SSL Wireless SMS API call once sandbox credentials are available
       console.log(`[DEV MODE] OTP for ${phone}: ${otp}`);

       res.status(200).json({ message: 'OTP sent (dev mode — check server terminal)' });
     } catch (err) {
       console.error('Send OTP error:', err);
       res.status(500).json({ error: true, message: 'Something went wrong. Please try again.' });
     }
   });


      router.post('/verify-otp', async (req, res) => {
     const { phone, otp } = req.body;

     if (!phone || !otp) {
       return res.status(400).json({ error: true, message: 'phone and otp are required' });
     }

     try {
       const result = await pool.query(
         `SELECT * FROM otp_verifications
          WHERE phone = $1 AND is_used = false AND expires_at > NOW()
          ORDER BY created_at DESC LIMIT 1`,
         [phone]
       );

       if (result.rows.length === 0) {
         return res.status(400).json({ error: true, message: 'OTP expired or not found. Please request a new one.' });
       }

       const otpRecord = result.rows[0];
       const otpMatches = await bcrypt.compare(otp, otpRecord.otp_hash);

       if (!otpMatches) {
         return res.status(400).json({ error: true, message: 'Incorrect OTP' });
       }

       // mark this OTP as used
       await pool.query('UPDATE otp_verifications SET is_used = true WHERE id = $1', [otpRecord.id]);

       // mark the user's phone as verified
       await pool.query('UPDATE users SET is_verified = true WHERE phone = $1', [phone]);

       res.status(200).json({ message: 'Phone number verified successfully' });
     } catch (err) {
       console.error('Verify OTP error:', err);
       res.status(500).json({ error: true, message: 'Something went wrong. Please try again.' });
     }
   });

   module.exports = router;