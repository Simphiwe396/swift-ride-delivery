const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swiftride';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('⚠️ Using mock data mode');
    });

// Simple schemas
const driverSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    vehicleType: { type: String, default: 'motorcycle' },
    currentLocation: { lat: Number, lng: Number },
    status: { type: String, default: 'offline' },
    ratePerKm: { type: Number, default: 10 },
    lastActive: { type: Date, default: Date.now }
});

const tripSchema = new mongoose.Schema({
    tripId: { type: String, default: () => `TRIP${Date.now()}` },
    customerId: String,
    customerName: String,
    driverId: String,
    driverName: String,
    pickup: { address: String, lat: Number, lng: Number },
    destination: { address: String, lat: Number, lng: Number },
    distance: Number,
    fare: Number,
    status: { type: String, default: 'pending' },
    driverLocation: { lat: Number, lng: Number },
    createdAt: { type: Date, default: Date.now },
    completedAt: Date
});

const Driver = mongoose.model('Driver', driverSchema);
const Trip = mongoose.model('Trip', tripSchema);

// Mock data fallback
let mockDrivers = [
    { _id: 'driver1', name: 'John Driver', status: 'available', currentLocation: { lat: -26.195246, lng: 28.034088 } },
    { _id: 'driver2', name: 'Mike Rider', status: 'available', currentLocation: { lat: -26.205246, lng: 28.044088 } },
    { _id: 'driver3', name: 'David Biker', status: 'busy', currentLocation: { lat: -26.185246, lng: 28.024088 } }
];

let mockTrips = [];
let connectedDrivers = new Map();
let connectedUsers = new Map();

// Socket.io
io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);
    
    socket.on('user-connected', (data) => {
        connectedUsers.set(socket.id, data);
        console.log(`👤 ${data.userType} connected: ${data.name}`);
    });
    
    socket.on('driver-location', async (data) => {
        const { driverId, lat, lng, status } = data;
        
        try {
            await Driver.findByIdAndUpdate(driverId, {
                currentLocation: { lat, lng },
                status: status || 'available',
                lastActive: new Date()
            }, { upsert: true });
        } catch (error) {
            // Mock data
            let driver = mockDrivers.find(d => d._id === driverId);
            if (!driver) {
                driver = { _id: driverId, name: `Driver ${driverId.substring(0, 5)}` };
                mockDrivers.push(driver);
            }
            driver.currentLocation = { lat, lng };
            driver.status = status || 'available';
            driver.lastActive = new Date();
        }
        
        connectedDrivers.set(driverId, { socketId: socket.id, location: { lat, lng }, status });
        
        io.emit('driver-update', {
            driverId,
            lat,
            lng,
            status: status || 'available',
            timestamp: new Date()
        });
    });
    
    socket.on('request-trip', async (data) => {
        const { customerId, pickup, destination, distance, customerName, rate = 10 } = data;
        const fare = Math.max(20, distance * rate);
        
        try {
            const trip = new Trip({
                customerId,
                customerName: customerName || 'Customer',
                pickup,
                destination,
                distance,
                fare,
                status: 'pending'
            });
            
            await trip.save();
            
            const drivers = await Driver.find({ status: 'available' });
            if (drivers.length > 0) {
                const driver = drivers[0];
                const driverSocket = connectedDrivers.get(driver._id.toString());
                if (driverSocket) {
                    io.to(driverSocket.socketId).emit('new-trip', {
                        tripId: trip._id,
                        pickup,
                        destination,
                        distance,
                        fare,
                        customerId,
                        customerName: customerName || 'Customer'
                    });
                }
                
                trip.driverId = driver._id;
                trip.driverName = driver.name;
                trip.status = 'assigned';
                await trip.save();
                
                socket.emit('trip-assigned', {
                    tripId: trip._id,
                    driverId: driver._id,
                    driverName: driver.name,
                    eta: '10 mins'
                });
            } else {
                socket.emit('trip-assigned', {
                    tripId: trip._id,
                    driverId: 'mock_driver_1',
                    driverName: 'Test Driver',
                    eta: '5 mins'
                });
            }
        } catch (error) {
            const mockTrip = {
                _id: `mock_${Date.now()}`,
                tripId: `TRIP${Date.now()}`,
                customerId,
                customerName: customerName || 'Customer',
                pickup,
                destination,
                distance,
                fare,
                status: 'assigned',
                driverId: 'mock_driver_1',
                driverName: 'Test Driver',
                createdAt: new Date()
            };
            mockTrips.push(mockTrip);
            
            socket.emit('trip-assigned', {
                tripId: mockTrip._id,
                driverId: mockTrip.driverId,
                driverName: mockTrip.driverName,
                eta: '5 mins'
            });
        }
    });
    
    socket.on('accept-trip', async (data) => {
        const { tripId, driverId } = data;
        
        try {
            await Trip.findByIdAndUpdate(tripId, { status: 'accepted', driverId });
        } catch (error) {
            const trip = mockTrips.find(t => t._id === tripId);
            if (trip) trip.status = 'accepted';
        }
        
        io.emit('trip-accepted', { tripId, driverId, status: 'accepted' });
    });
    
    socket.on('update-trip', async (data) => {
        const { tripId, status, location } = data;
        
        try {
            const updateData = { status };
            if (location) updateData.driverLocation = location;
            if (status === 'completed') updateData.completedAt = new Date();
            
            await Trip.findByIdAndUpdate(tripId, updateData);
        } catch (error) {
            const trip = mockTrips.find(t => t._id === tripId);
            if (trip) {
                trip.status = status;
                if (location) trip.driverLocation = location;
                if (status === 'completed') trip.completedAt = new Date();
            }
        }
        
        io.emit('trip-updated', { tripId, status, location });
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Disconnected:', socket.id);
        
        for (let [driverId, driver] of connectedDrivers) {
            if (driver.socketId === socket.id) {
                connectedDrivers.delete(driverId);
                io.emit('driver-offline', { driverId });
                break;
            }
        }
        
        connectedUsers.delete(socket.id);
    });
});

// API Routes
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'online', 
        connectedUsers: connectedUsers.size,
        connectedDrivers: connectedDrivers.size,
        timestamp: new Date() 
    });
});

app.get('/api/drivers/available', async (req, res) => {
    try {
        const drivers = await Driver.find({ status: 'available' });
        res.json(drivers);
    } catch (error) {
        res.json(mockDrivers.filter(d => d.status === 'available'));
    }
});

app.get('/api/drivers/all', async (req, res) => {
    try {
        const drivers = await Driver.find();
        res.json(drivers);
    } catch (error) {
        res.json(mockDrivers);
    }
});

app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ createdAt: -1 });
        res.json(trips);
    } catch (error) {
        res.json(mockTrips);
    }
});

app.get('/api/trips/history', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ createdAt: -1 }).limit(50);
        res.json(trips);
    } catch (error) {
        res.json(mockTrips.slice(0, 50));
    }
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        const drivers = await Driver.find();
        const trips = await Trip.find({
            createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        });
        
        res.json({
            totalDrivers: drivers.length,
            activeDeliveries: trips.filter(t => ['pending', 'accepted', 'in_progress'].includes(t.status)).length,
            todayRevenue: trips.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.fare || 0), 0),
            totalCustomers: connectedUsers.size
        });
    } catch (error) {
        res.json({
            totalDrivers: mockDrivers.length,
            activeDeliveries: 3,
            todayRevenue: 1250.50,
            totalCustomers: connectedUsers.size
        });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log(`📡 Socket.io: ws://localhost:${PORT}`);
    console.log(`📊 Mock drivers: ${mockDrivers.length}`);
});