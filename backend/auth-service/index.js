   const express = require('express');
   const cors = require('cors');
   const authRoutes = require('./routes');

   const app = express();
   app.use(cors());
   app.use(express.json());
   app.use('/api/v1/auth', authRoutes);

   // Simple health-check route to confirm the server is alive
   app.get('/health', (req, res) => {
     res.json({ status: 'ok', service: 'auth-service' });
   });

   const PORT = process.env.PORT || 3001;
   app.listen(PORT, () => {
     console.log(`Auth Service running on http://localhost:${PORT}`);
   });