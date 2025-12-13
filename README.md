# SwiftRide Delivery Service - Deployment Guide

## Quick Fix Steps:

1. **Update package.json** - Set `"type": "commonjs"`
2. **Update server.js** - Use CommonJS require() syntax
3. **Set MongoDB URI in Render Dashboard**:
   - Go to your Render dashboard
   - Select your web service
   - Click "Environment" tab
   - Add environment variable:
     - Key: `MONGODB_URI`
     - Value: `mongodb+srv://ngozobolwanengolobane_db_user:2022gogo@cluster0.mongodb.net/delivery_app?retryWrites=true&w=majority`

## MongoDB Setup Options:

### Option 1: MongoDB Atlas (Free Tier)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string
4. Update in Render environment variables

### Option 2: Use Mock Data (For Testing)
Replace `server.js` with minimal version without MongoDB:

```javascript
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Mock drivers data
let mockDrivers = [];

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  socket.on('driverLocation', (data) => {
    const { name, lat, lng } = data;
    
    // Update or add driver
    const existingIndex = mockDrivers.findIndex(d => d.name === name);
    if (existingIndex > -1) {
      mockDrivers[existingIndex] = { ...mockDrivers[existingIndex], lat, lng };
    } else {
      mockDrivers.push({ name, lat, lng, active: true });
    }
    
    io.emit('driverLocation', {
      driverId: socket.id,
      name,
      lat,
      lng,
      timestamp: new Date()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
  });
});

// API Routes
app.get('/api/drivers', (req, res) => {
  res.json(mockDrivers);
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'SwiftRide API (Mock Mode)',
    status: 'OK'
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});