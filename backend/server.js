// backend/server.js
const socketUtil = require('./utils/socket');


const authRoutes = require('./routes/auth');
const driversRoutes = require('./routes/drivers');
const tripsRoutes = require('./routes/trips');
const trackingRoutes = require('./routes/tracking');
const adminRoutes = require('./routes/admin');


const app = express();
const server = http.createServer(app);


// Middlewares
app.use(express.json());
app.use(cors());


// Static frontend hosting (optional) — serve the `frontend` folder
app.use(express.static(path.join(__dirname, '..', 'frontend')));


// API routes
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/admin', adminRoutes);


// Fallback to index.html for SPA routes (if used)
app.get('*', (req, res) => {
res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});


// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!MONGODB_URI) {
console.error('MONGODB_URI not set in environment');
process.exit(1);
}


mongoose.connect(MONGODB_URI, {
useNewUrlParser: true,
useUnifiedTopology: true,
}).then(() => {
console.log('MongoDB connected');
}).catch((err) => {
console.error('Mongo connection error', err);
process.exit(1);
});


// Initialize sockets (keeps your live map integration intact)
socketUtil.init(server);


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});