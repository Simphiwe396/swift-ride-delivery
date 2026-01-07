const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ===== CRITICAL FIX: Updated CORS and Socket.io Configuration =====
const io = socketIo(server, {
    cors: {
        origin: [
            "https://swift-ride-frontend.onrender.com", // Your frontend
            "https://swift-ride.onrender.com",          // Your backend (if serving frontend)
            "http://localhost:3000",                    // For local testing
            "http://localhost:10000"                    // For local testing
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// Middleware
app.use(cors({
    origin: [
        "https://swift-ride-frontend.onrender.com",
        "https://swift-ride.onrender.com",
        "http://localhost:3000",
        "http://localhost:10000"
    ],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swiftride';
console.log('Connecting to MongoDB...');

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
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
    vehicleNumber: String,
    currentLocation: { lat: Number, lng: Number },
    status: { type: String, default: 'offline' },
    ratePerKm: { type: Number, default: 10 },
    totalTrips: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
});

const tripSchema = new mongoose.Schema({
    tripId: { type: String, default: () => `TRIP${Date.now()}` },
    customerId: String,
    customerName: String,
    driverId: String,
    driverName: String,
    pickup: { 
        address: String, 
        lat: { type: Number, default: -26.0748 },
        lng: { type: Number, default: 28.2104 }
    },
    destination: { 
        address: String, 
        lat: { type: Number, default: -26.0748 },
        lng: { type: Number, default: 28.2104 }
    },
    distance: { type: Number, default: 0 },
    fare: { type: Number, default: 0 },
    status: { type: String, default: 'pending' },
    driverLocation: { lat: Number, lng: Number },
    packageDescription: String,
    createdAt: { type: Date, default: Date.now },
    completedAt: Date
});

const Driver = mongoose.model('Driver', driverSchema);
const Trip = mongoose.model('Trip', tripSchema);

// Mock data fallback
let mockDrivers = [
    { _id: 'driver1', name: 'John Driver', status: 'available', currentLocation: { lat: -26.0748, lng: 28.2204 }, vehicleType: 'van', phone: '0821112222' },
    { _id: 'driver2', name: 'Mike Rider', status: 'available', currentLocation: { lat: -26.0848, lng: 28.2004 }, vehicleType: 'truck', phone: '0823334444' },
    { _id: 'driver3', name: 'David Biker', status: 'busy', currentLocation: { lat: -26.0648, lng: 28.1904 }, vehicleType: 'motorcycle', phone: '0825556666' }
];

let mockTrips = [
    { 
        _id: 'trip1', 
        tripId: 'TRIP001',
        customerName: 'TV Stands Customer', 
        driverName: 'John Driver',
        pickup: { address: '5 Zaria Cres, Birchleigh North, Kempton Park', lat: -26.0748, lng: 28.2104 },
        destination: { address: 'Mall of Africa, Midrand', lat: -26.005246, lng: 28.124088 },
        distance: 25,
        fare: 500,
        status: 'completed',
        createdAt: new Date()
    },
    { 
        _id: 'trip2', 
        tripId: 'TRIP002',
        customerName: 'Office Supplies Co', 
        driverName: 'Mike Rider',
        pickup: { address: '5 Zaria Cres, Birchleigh North, Kempton Park', lat: -26.0748, lng: 28.2104 },
        destination: { address: 'Business Park, Sandton', lat: -26.105246, lng: 28.054088 },
        distance: 35,
        fare: 700,
        status: 'in_progress',
        createdAt: new Date()
    }
];

let connectedDrivers = new Map();
let connectedUsers = new Map();

// Socket.io
io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);
    
    socket.on('user-connected', (data) => {
        connectedUsers.set(socket.id, data);
        console.log(`👤 ${data.userType} connected: ${data.name} (${socket.id})`);
    });
    
    socket.on('driver-location', async (data) => {
        const { driverId, lat, lng, status } = data;
        console.log(`📍 Driver location update: ${driverId} at ${lat}, ${lng} (${status})`);
        
        try {
            await Driver.findByIdAndUpdate(driverId, {
                currentLocation: { lat, lng },
                status: status || 'available',
                lastActive: new Date()
            }, { upsert: true, new: true });
        } catch (error) {
            console.log('⚠️ Using mock driver data:', error.message);
            let driver = mockDrivers.find(d => d._id === driverId);
            if (!driver) {
                driver = { 
                    _id: driverId, 
                    name: `Driver ${driverId.substring(0, 5)}`,
                    status: 'available'
                };
                mockDrivers.push(driver);
            }
            driver.currentLocation = { lat, lng };
            driver.status = status || 'available';
            driver.lastActive = new Date();
        }
        
        connectedDrivers.set(driverId, { socketId: socket.id, location: { lat, lng }, status });
        
        // Broadcast to all clients
        io.emit('driver-update', {
            driverId,
            lat,
            lng,
            status: status || 'available',
            timestamp: new Date()
        });
    });
    
    socket.on('request-trip', async (data) => {
        console.log('📦 New trip request:', data);
        const { customerId, pickup, destination, distance, customerName, rate = 20, packageDescription } = data;
        const fare = Math.max(200, distance * rate); // R200 minimum for TV stands
        
        try {
            const trip = new Trip({
                customerId,
                customerName: customerName || 'TV Stands Customer',
                pickup: {
                    address: pickup.address || '5 Zaria Cres, Birchleigh North, Kempton Park',
                    lat: pickup.lat || -26.0748,
                    lng: pickup.lng || 28.2104
                },
                destination: {
                    address: destination.address || 'Customer Location',
                    lat: destination.lat || -26.0748,
                    lng: destination.lng || 28.2104
                },
                distance: distance || 10,
                fare: fare,
                packageDescription: packageDescription || 'TV Stand Delivery',
                status: 'pending'
            });
            
            await trip.save();
            
            // Try to find available driver
            const drivers = await Driver.find({ status: 'available' });
            if (drivers.length > 0) {
                const driver = drivers[0];
                const driverSocket = connectedDrivers.get(driver._id.toString());
                if (driverSocket) {
                    io.to(driverSocket.socketId).emit('new-trip', {
                        _id: trip._id,
                        tripId: trip.tripId,
                        pickup: trip.pickup,
                        destination: trip.destination,
                        distance: trip.distance,
                        fare: trip.fare,
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
                    eta: '30-60 mins'
                });
                
                io.emit('trip-updated', { tripId: trip._id, status: 'assigned' });
            } else {
                // Use mock driver
                socket.emit('trip-assigned', {
                    tripId: trip._id,
                    driverId: 'mock_driver_1',
                    driverName: 'Test Driver',
                    eta: '45 mins'
                });
                
                io.emit('trip-updated', { tripId: trip._id, status: 'assigned' });
            }
        } catch (error) {
            console.error('Error creating trip:', error);
            // Create mock trip
            const mockTrip = {
                _id: `mock_${Date.now()}`,
                tripId: `TRIP${Date.now()}`,
                customerId,
                customerName: customerName || 'TV Stands Customer',
                pickup,
                destination,
                distance,
                fare,
                packageDescription: packageDescription || 'TV Stand Delivery',
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
                eta: '45 mins'
            });
            
            io.emit('trip-updated', { tripId: mockTrip._id, status: 'assigned' });
        }
    });
    
    socket.on('accept-trip', async (data) => {
        const { tripId, driverId } = data;
        console.log(`✅ Trip accepted: ${tripId} by driver ${driverId}`);
        
        try {
            await Trip.findByIdAndUpdate(tripId, { 
                status: 'accepted', 
                driverId,
                driverName: 'Assigned Driver'
            });
        } catch (error) {
            console.log('⚠️ Using mock trip data for accept');
            const trip = mockTrips.find(t => t._id === tripId);
            if (trip) {
                trip.status = 'accepted';
                trip.driverId = driverId;
                trip.driverName = 'Assigned Driver';
            }
        }
        
        io.emit('trip-accepted', { tripId, driverId, status: 'accepted' });
        io.emit('trip-updated', { tripId, status: 'accepted' });
    });
    
    socket.on('update-trip', async (data) => {
        const { tripId, status, location } = data;
        console.log(`🔄 Trip updated: ${tripId} -> ${status}`);
        
        try {
            const updateData = { status };
            if (location) updateData.driverLocation = location;
            if (status === 'completed') updateData.completedAt = new Date();
            
            await Trip.findByIdAndUpdate(tripId, updateData);
        } catch (error) {
            console.log('⚠️ Using mock trip data for update');
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
        
        // Find and mark driver as offline
        for (let [driverId, driver] of connectedDrivers) {
            if (driver.socketId === socket.id) {
                connectedDrivers.delete(driverId);
                io.emit('driver-offline', { driverId });
                console.log(`🔴 Driver ${driverId} marked offline`);
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
        message: 'SwiftRide TV Stands Delivery API',
        version: '1.0.0',
        warehouse: '5 Zaria Cres, Birchleigh North, Kempton Park',
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
        console.log('⚠️ Using mock drivers data');
        res.json(mockDrivers.filter(d => d.status === 'available'));
    }
});

app.get('/api/drivers/all', async (req, res) => {
    try {
        const drivers = await Driver.find();
        res.json(drivers);
    } catch (error) {
        console.log('⚠️ Using mock drivers data');
        res.json(mockDrivers);
    }
});

app.get('/api/drivers/:id', async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (driver) {
            res.json(driver);
        } else {
            res.status(404).json({ error: 'Driver not found' });
        }
    } catch (error) {
        console.log('⚠️ Using mock driver data');
        const driver = mockDrivers.find(d => d._id === req.params.id);
        if (driver) {
            res.json(driver);
        } else {
            res.status(404).json({ error: 'Driver not found' });
        }
    }
});

app.post('/api/drivers', async (req, res) => {
    try {
        const driver = new Driver(req.body);
        await driver.save();
        res.json(driver);
    } catch (error) {
        console.error('Error creating driver:', error);
        res.status(500).json({ error: 'Failed to create driver' });
    }
});

app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ createdAt: -1 }).limit(50);
        res.json(trips);
    } catch (error) {
        console.log('⚠️ Using mock trips data');
        res.json(mockTrips.slice(0, 50));
    }
});

app.get('/api/trips/history', async (req, res) => {
    const { customerId, driverId } = req.query;
    
    try {
        let query = {};
        if (customerId) query.customerId = customerId;
        if (driverId) query.driverId = driverId;
        
        const trips = await Trip.find(query).sort({ createdAt: -1 }).limit(50);
        res.json(trips);
    } catch (error) {
        console.log('⚠️ Using mock trips data for history');
        let filteredTrips = mockTrips;
        if (customerId) {
            filteredTrips = mockTrips.filter(t => t.customerId === customerId);
        } else if (driverId) {
            filteredTrips = mockTrips.filter(t => t.driverId === driverId);
        }
        res.json(filteredTrips.slice(0, 50));
    }
});

app.get('/api/trips/:id', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (trip) {
            res.json(trip);
        } else {
            res.status(404).json({ error: 'Trip not found' });
        }
    } catch (error) {
        console.log('⚠️ Using mock trip data');
        const trip = mockTrips.find(t => t._id === req.params.id);
        if (trip) {
            res.json(trip);
        } else {
            res.status(404).json({ error: 'Trip not found' });
        }
    }
});

app.post('/api/trips', async (req, res) => {
    try {
        const trip = new Trip(req.body);
        await trip.save();
        res.json(trip);
    } catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({ error: 'Failed to create trip' });
    }
});

app.put('/api/trips/:id', async (req, res) => {
    try {
        const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(trip);
    } catch (error) {
        console.error('Error updating trip:', error);
        res.status(500).json({ error: 'Failed to update trip' });
    }
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        const drivers = await Driver.find();
        const trips = await Trip.find({
            createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        });
        
        const completedTrips = trips.filter(t => t.status === 'completed');
        const totalRevenue = completedTrips.reduce((sum, t) => sum + (t.fare || 0), 0);
        
        res.json({
            totalDrivers: drivers.length,
            activeDeliveries: trips.filter(t => ['pending', 'accepted', 'in_progress', 'picked_up'].includes(t.status)).length,
            todayRevenue: totalRevenue,
            totalCustomers: new Set(trips.map(t => t.customerId)).size
        });
    } catch (error) {
        console.log('⚠️ Using mock stats data');
        res.json({
            totalDrivers: mockDrivers.length,
            activeDeliveries: mockTrips.filter(t => ['pending', 'accepted', 'in_progress', 'picked_up'].includes(t.status)).length,
            todayRevenue: mockTrips.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.fare || 0), 0),
            totalCustomers: 15
        });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 SwiftRide TV Stands Delivery Server running on port ${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log(`📡 Socket.io: ws://localhost:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api/status`);
    console.log(`👥 Mock drivers ready: ${mockDrivers.length}`);
    console.log(`📦 Mock trips ready: ${mockTrips.length}`);
});