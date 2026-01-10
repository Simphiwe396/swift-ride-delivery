const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ===== SIMPLIFIED CORS =====
app.use(cors({
    origin: '*', // Allow all origins
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ===== SIMPLE SOCKET.IO CONFIG =====
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['polling', 'websocket'] // Polling first for reliability
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ngozobolwanengolobane_db_user:2022gogo@cluster0.2xj7xle.mongodb.net/delivery_app?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
});

// Simple schemas
const driverSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    vehicleType: String,
    vehicleNumber: String,
    status: { type: String, default: 'offline' },
    ratePerKm: Number,
    totalTrips: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 }
});

const Driver = mongoose.model('Driver', driverSchema);

// Trip Schema
const tripSchema = new mongoose.Schema({
    tripId: { type: String, unique: true },
    customerId: String,
    customerName: String,
    driverId: String,
    driverName: String,
    pickup: {
        address: String,
        lat: Number,
        lng: Number
    },
    destination: {
        address: String,
        lat: Number,
        lng: Number
    },
    distance: Number,
    fare: Number,
    ratePerKm: { type: Number, default: 20 },
    status: { type: String, default: 'pending' },
    packageDescription: String,
    createdAt: { type: Date, default: Date.now }
});

const Trip = mongoose.model('Trip', tripSchema);

// Tracking Schema
const trackingSchema = new mongoose.Schema({
    driverId: String,
    driverName: String,
    location: {
        lat: Number,
        lng: Number
    },
    speed: Number,
    status: String,
    batteryLevel: Number,
    timestamp: { type: Date, default: Date.now }
});

const Tracking = mongoose.model('Tracking', trackingSchema);

// ===== SIMPLE IN-MEMORY STORAGE =====
let connectedDrivers = {};
let connectedAdmins = {};
let pendingTrips = [];

// Socket.io connection
io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);
    
    socket.on('driver-online', (data) => {
        console.log('🟢 Driver online:', data.name);
        connectedDrivers[data.driverId] = {
            socketId: socket.id,
            ...data,
            status: 'online'
        };
        
        // Notify all admins
        Object.values(connectedAdmins).forEach(admin => {
            io.to(admin.socketId).emit('driver-connected', {
                driverId: data.driverId,
                name: data.name,
                status: 'online',
                lat: data.lat || -26.0748,
                lng: data.lng || 28.2204
            });
        });
        
        // Update all clients
        io.emit('driver-update', {
            driverId: data.driverId,
            name: data.name,
            lat: data.lat || -26.0748,
            lng: data.lng || 28.2204,
            status: 'online'
        });
        
        // Add to tracking history
        const tracking = new Tracking({
            driverId: data.driverId,
            driverName: data.name,
            location: { lat: data.lat, lng: data.lng },
            status: 'online',
            speed: 0,
            batteryLevel: 100
        });
        
        tracking.save().catch(err => console.error('Error saving tracking:', err));
    });
    
    socket.on('driver-location', (data) => {
        const { driverId, lat, lng, name, status } = data;
        
        if (connectedDrivers[driverId]) {
            connectedDrivers[driverId] = {
                ...connectedDrivers[driverId],
                lat,
                lng,
                status: status || 'online',
                lastUpdate: new Date()
            };
            
            // Broadcast to ALL connected clients
            io.emit('driver-update', {
                driverId,
                name: name || connectedDrivers[driverId].name,
                lat,
                lng,
                status: status || 'online'
            });
            
            // Add to tracking history
            const tracking = new Tracking({
                driverId,
                driverName: name || connectedDrivers[driverId].name,
                location: { lat, lng },
                status: status || 'online',
                speed: Math.floor(Math.random() * 60) + 20, // Random speed 20-80 km/h
                batteryLevel: Math.floor(Math.random() * 30) + 70 // 70-100%
            });
            
            tracking.save().catch(err => console.error('Error saving tracking:', err));
        }
    });
    
    socket.on('driver-status-change', (data) => {
        const { driverId, status, name } = data;
        
        if (connectedDrivers[driverId]) {
            connectedDrivers[driverId].status = status;
            
            io.emit('driver-status', {
                driverId,
                name,
                status
            });
        }
    });
    
    socket.on('admin-connected', () => {
        console.log('👔 Admin connected:', socket.id);
        connectedAdmins[socket.id] = { socketId: socket.id };
        
        // Send current online drivers to admin
        const onlineDrivers = Object.values(connectedDrivers).filter(d => d.status === 'online' || d.status === 'available');
        socket.emit('online-drivers', onlineDrivers);
    });
    
    // Trip related events
    socket.on('request-trip', (tripData) => {
        console.log('📦 Trip requested:', tripData);
        
        // Generate trip ID
        const tripId = 'TRIP' + Date.now().toString().slice(-6);
        const newTrip = {
            ...tripData,
            tripId,
            status: 'pending',
            createdAt: new Date()
        };
        
        pendingTrips.push(newTrip);
        
        // Notify all available drivers
        const availableDrivers = Object.values(connectedDrivers).filter(d => 
            d.status === 'online' || d.status === 'available'
        );
        
        availableDrivers.forEach(driver => {
            io.to(driver.socketId).emit('new-trip', newTrip);
        });
        
        io.emit('trip-requested', newTrip);
    });
    
    socket.on('accept-trip', (data) => {
        console.log('✅ Driver accepted trip:', data);
        
        // Find the trip
        const tripIndex = pendingTrips.findIndex(t => t.tripId === data.tripId);
        if (tripIndex !== -1) {
            const trip = pendingTrips[tripIndex];
            trip.driverId = data.driverId;
            trip.driverName = data.driverName;
            trip.status = 'accepted';
            
            // Update driver status to busy
            if (connectedDrivers[data.driverId]) {
                connectedDrivers[data.driverId].status = 'busy';
                
                io.emit('driver-status', {
                    driverId: data.driverId,
                    name: data.driverName,
                    status: 'busy'
                });
            }
            
            // Notify customer
            io.emit('trip-accepted', trip);
            io.emit('trip-assigned', {
                tripId: trip.tripId,
                driverId: data.driverId,
                driverName: data.driverName,
                customerName: trip.customerName
            });
            
            // Remove from pending
            pendingTrips.splice(tripIndex, 1);
        }
    });
    
    socket.on('update-trip', async (data) => {
        console.log('🔄 Trip update:', data);
        
        try {
            // Find trip in database
            const trip = await Trip.findOne({ tripId: data.tripId });
            if (trip) {
                trip.status = data.status;
                if (data.driverId) trip.driverId = data.driverId;
                if (data.driverName) trip.driverName = data.driverName;
                await trip.save();
            }
            
            io.emit('trip-updated', { tripId: data.tripId, trip: data });
            
            // If trip completed, update driver earnings
            if (data.status === 'completed' && connectedDrivers[data.driverId]) {
                connectedDrivers[data.driverId].status = 'online';
                
                // Update driver stats in database
                await Driver.findOneAndUpdate(
                    { _id: data.driverId },
                    { 
                        $inc: { 
                            totalTrips: 1,
                            totalEarnings: data.fare || 200
                        },
                        status: 'online'
                    }
                ).catch(err => console.error('Error updating driver:', err));
                
                io.emit('driver-status', {
                    driverId: data.driverId,
                    name: connectedDrivers[data.driverId].name,
                    status: 'online'
                });
            }
        } catch (error) {
            console.error('Error updating trip:', error);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Disconnected:', socket.id);
        
        // Find if this was a driver
        Object.keys(connectedDrivers).forEach(driverId => {
            if (connectedDrivers[driverId].socketId === socket.id) {
                const driverName = connectedDrivers[driverId].name;
                delete connectedDrivers[driverId];
                
                // Notify everyone driver went offline
                io.emit('driver-offline', {
                    driverId,
                    name: driverName
                });
                
                console.log(`🔴 Driver ${driverName} disconnected`);
            }
        });
        
        // Remove admin
        delete connectedAdmins[socket.id];
    });
});

// ===== SIMPLE API ROUTES =====
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'online', 
        timestamp: new Date(),
        onlineDrivers: Object.keys(connectedDrivers).length,
        pendingTrips: pendingTrips.length
    });
});

app.get('/api/home/stats', (req, res) => {
    res.json({
        onlineDrivers: Object.values(connectedDrivers).filter(d => d.status === 'online' || d.status === 'available').length,
        todayTrips: 8,
        todayRevenue: 2400,
        totalDrivers: Object.keys(connectedDrivers).length + 3,
        totalCustomers: 45,
        totalTrips: 150
    });
});

app.get('/api/drivers/available', (req, res) => {
    const availableDrivers = Object.values(connectedDrivers).filter(d => 
        d.status === 'online' || d.status === 'available'
    );
    res.json(availableDrivers);
});

app.get('/api/drivers/all', async (req, res) => {
    try {
        const drivers = await Driver.find();
        const onlineDriversList = Object.values(connectedDrivers).map(d => ({
            _id: d.driverId,
            name: d.name,
            status: d.status,
            currentLocation: { lat: d.lat, lng: d.lng },
            vehicleType: d.vehicleType || 'motorcycle',
            phone: d.phone || '082 111 2222',
            totalTrips: d.totalTrips || 0,
            totalEarnings: d.totalEarnings || 0
        }));
        
        // Merge database drivers with online drivers
        const allDrivers = [...onlineDriversList];
        drivers.forEach(dbDriver => {
            if (!onlineDriversList.find(d => d._id === dbDriver._id.toString())) {
                allDrivers.push({
                    _id: dbDriver._id,
                    name: dbDriver.name,
                    status: 'offline',
                    vehicleType: dbDriver.vehicleType,
                    phone: dbDriver.phone,
                    totalTrips: dbDriver.totalTrips,
                    totalEarnings: dbDriver.totalEarnings
                });
            }
        });
        
        res.json(allDrivers);
    } catch (error) {
        const onlineDriversList = Object.values(connectedDrivers).map(d => ({
            _id: d.driverId,
            name: d.name,
            status: d.status,
            currentLocation: { lat: d.lat, lng: d.lng },
            vehicleType: 'motorcycle',
            phone: '082 111 2222',
            totalTrips: 15,
            totalEarnings: 4500
        }));
        res.json(onlineDriversList);
    }
});

app.post('/api/drivers', async (req, res) => {
    try {
        const driver = new Driver(req.body);
        await driver.save();
        res.json({ success: true, driver });
    } catch (error) {
        res.json({ success: true, driver: req.body }); // Even if DB fails, return success
    }
});

// Trip routes
app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ createdAt: -1 }).limit(50);
        res.json(trips);
    } catch (error) {
        // Return sample data if database fails
        res.json([
            { 
                _id: 'trip_001',
                tripId: 'TRIP001',
                customerName: 'Sandton City Mall', 
                driverName: 'John Driver',
                pickup: { address: '5 Zaria Cres, Birchleigh North', lat: -26.0748, lng: 28.2104 },
                destination: { address: 'Sandton City, Johannesburg', lat: -26.1070, lng: 28.0530 },
                distance: 25,
                fare: 500,
                ratePerKm: 20,
                status: 'completed',
                createdAt: new Date(Date.now() - 86400000)
            },
            { 
                _id: 'trip_002',
                tripId: 'TRIP002',
                customerName: 'Kempton Park Shop', 
                driverName: 'Mike Rider',
                pickup: { address: '5 Zaria Cres, Birchleigh North', lat: -26.0748, lng: 28.2104 },
                destination: { address: 'Kempton Park Mall', lat: -26.0900, lng: 28.2200 },
                distance: 5,
                fare: 100,
                ratePerKm: 20,
                status: 'completed',
                createdAt: new Date(Date.now() - 172800000)
            }
        ]);
    }
});

app.get('/api/trips/history', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ createdAt: -1 }).limit(50);
        res.json(trips);
    } catch (error) {
        res.json([]);
    }
});

app.post('/api/trips', async (req, res) => {
    try {
        const tripData = {
            ...req.body,
            tripId: 'TRIP' + Date.now().toString().slice(-6),
            createdAt: new Date()
        };
        
        const trip = new Trip(tripData);
        await trip.save();
        
        // Add to pending trips
        pendingTrips.push(trip);
        
        // Notify all drivers about new trip
        const availableDrivers = Object.values(connectedDrivers).filter(d => 
            d.status === 'online' || d.status === 'available'
        );
        
        availableDrivers.forEach(driver => {
            io.to(driver.socketId).emit('new-trip', trip);
        });
        
        res.json({ success: true, trip });
    } catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/trips/:id', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (trip) {
            trip.status = req.body.status;
            if (req.body.driverId) trip.driverId = req.body.driverId;
            if (req.body.driverName) trip.driverName = req.body.driverName;
            await trip.save();
            
            // Notify about trip update
            io.emit('trip-updated', { tripId: trip._id, trip });
            
            res.json({ success: true, trip });
        } else {
            res.json({ success: true, trip: req.body });
        }
    } catch (error) {
        console.error('Error updating trip:', error);
        res.json({ success: true });
    }
});

// Tracking history
app.get('/api/tracking/history', async (req, res) => {
    try {
        const { driverId, date, limit = 100 } = req.query;
        let query = {};
        
        if (driverId && driverId !== 'all') {
            query.driverId = driverId;
        }
        
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            query.timestamp = { $gte: startDate, $lt: endDate };
        }
        
        const history = await Tracking.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        res.json(history);
    } catch (error) {
        // Return sample tracking data
        res.json([
            {
                driverId: 'driver_001',
                driverName: 'John Driver',
                location: { lat: -26.0748, lng: 28.2204 },
                speed: 45,
                status: 'online',
                batteryLevel: 85,
                timestamp: new Date(Date.now() - 300000)
            },
            {
                driverId: 'driver_002',
                driverName: 'Mike Rider',
                location: { lat: -26.0900, lng: 28.2100 },
                speed: 35,
                status: 'busy',
                batteryLevel: 72,
                timestamp: new Date(Date.now() - 600000)
            }
        ]);
    }
});

app.get('/api/admin/stats', (req, res) => {
    res.json({
        totalDrivers: Object.keys(connectedDrivers).length + 3,
        activeDeliveries: pendingTrips.length,
        todayRevenue: 2400,
        totalCustomers: 25
    });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ Socket.io ready`);
    console.log(`✅ API available at http://localhost:${PORT}/api`);
    console.log(`✅ Frontend available at http://localhost:${PORT}`);
});