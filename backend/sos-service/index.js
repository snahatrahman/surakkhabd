   const express = require('express');
   const cors = require('cors');
       const sosRoutes = require('./routes');

   const app = express();
   app.use(cors());
   app.use(express.json());
       app.use('/api/v1/sos', sosRoutes);

   app.get('/health', (req, res) => {
     res.json({ status: 'ok', service: 'sos-service' });
   });

   const PORT = process.env.PORT || 3002;
   app.listen(PORT, () => {
     console.log(`SOS Service running on http://localhost:${PORT}`);
   });