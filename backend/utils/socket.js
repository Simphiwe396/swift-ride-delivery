function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const { Server } = require('socket.io');
let io;

module.exports = {
  init(server) {
    io = new Server(server, { cors: { origin: '*' } });
    
    // Make sure Driver model is available
    const Driver = require('./models/Driver'); // Adjust path as needed

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('driver:location', async (data) => {
        try {
          const { name, lat, lng } = data;
          
          if (!name || lat == null || lng == null) {
            console.log('Invalid location data received');
            return;
          }

          console.log(`Location update from ${name}: ${lat}, ${lng}`);

          const today = new Date().toISOString().split("T")[0];

          let driver = await Driver.findOne({ name });

          if (!driver) {
            // Create new driver record
            driver = new Driver({
              name,
              lastLat: lat,
              lastLng: lng,
              dailyDistance: 0,
              lastUpdateDate: today,
            });
            console.log(`New driver created: ${name}`);
          } else {
            // Check if date has changed (new day)
            if (driver.lastUpdateDate !== today) {
              driver.dailyDistance = 0; // reset daily distance
              driver.lastUpdateDate = today;
              console.log(`Daily distance reset for ${name}`);
            }

            // Calculate distance from last position
            if (driver.lastLat && driver.lastLng) {
              const distance = getDistance(
                driver.lastLat,
                driver.lastLng,
                lat,
                lng
              );
              driver.dailyDistance += distance;
              console.log(`Distance added for ${name}: ${distance.toFixed(2)}m`);
            }

            // Update location
            driver.lastLat = lat;
            driver.lastLng = lng;
          }

          await driver.save();

          // Prepare data for broadcast
          const driverData = {
            name,
            lat,
            lng,
            dailyDistance: Math.round(driver.dailyDistance),
            lastUpdateDate: driver.lastUpdateDate,
            timestamp: new Date().toISOString()
          };

          console.log(`Broadcasting update for ${name}, daily: ${driverData.dailyDistance}m`);

          // Broadcast to all connected clients
          io.emit('admin:driverUpdate', driverData);

        } catch (error) {
          console.error('Error processing driver location:', error);
          socket.emit('error', { message: 'Failed to update location' });
        }
      });

      // Optional: Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  },
  
  io() { return io; }
};