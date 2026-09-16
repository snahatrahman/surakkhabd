   const express = require('express');
   const pool = require('./db/pool');
   const authenticate = require('./middleware/auth');

   const router = express.Router();

   router.post('/trigger', authenticate, async (req, res) => {
     const { latitude, longitude, emergencyType, triggerType } = req.body;
     const userId = req.user.userId;

     if (latitude === undefined || longitude === undefined) {
       return res.status(400).json({ error: true, message: 'latitude and longitude are required' });
     }

     try {
       const result = await pool.query(
         `INSERT INTO incidents (user_id, emergency_type, location, trigger_type)
          VALUES (
            $1,
            $2,
            ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
            $5
          )
          RETURNING id, emergency_type, status, created_at`,
         [userId, emergencyType || 'unknown', longitude, latitude, triggerType || 'manual']
       );

       const incident = result.rows[0];

       res.status(201).json({
         incidentId: incident.id,
         status: incident.status,
         emergencyType: incident.emergency_type,
         message: 'SOS received. Help is being processed.',
       });
     } catch (err) {
       console.error('SOS trigger error:', err);
       res.status(500).json({ error: true, message: 'Something went wrong. Please try again.' });
     }
   });

   module.exports = router;