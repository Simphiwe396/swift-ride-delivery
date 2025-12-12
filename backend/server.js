// ... (your top requires remain the same)

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // <- Change to "*" for now to test, restrict later
    methods: ["GET", "POST"]
  }
});

// ============= MIDDLEWARE SETUP (FIXED ORDER) =============
// 1. Security first
app.use(helmet());
// 2. CORS once, here
app.use(cors({
  origin: "*", // Allow all for now. Change to your frontend URL later.
  credentials: true
}));
// 3. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// ============= DATABASE CONNECTION =============
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.log('❌ MongoDB Connection Error:', err.message)); // Log just the message

// ============= ROUTES =============
// Import Routes
const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/drivers');
const tripRoutes = require('./routes/trips');
const adminRoutes = require('./routes/admin');
const trackingRoutes = require('./routes/tracking');

// Mapbox Config Endpoint (place BEFORE other /api routes)
app.get('/api/config/mapbox-token', (req, res) => {
    res.json({
        token: process.env.MAPBOX_PUBLIC_TOKEN || 'test_token'
    });
});

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tracking', trackingRoutes);

// ... (The rest of your file - Socket.io, health check, server start - remains the same)