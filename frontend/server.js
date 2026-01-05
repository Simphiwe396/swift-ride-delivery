const express = require('express');
const path = require('path');

const app = express();

// Serve all files from the current directory
app.use(express.static(__dirname));

// Handle all routes by serving index.html (for your SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Serving files from: ${__dirname}`);
});