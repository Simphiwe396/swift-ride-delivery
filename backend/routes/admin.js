const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Admin API is working' 
  });
});

module.exports = router;