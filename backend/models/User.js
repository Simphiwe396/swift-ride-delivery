const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // User Type: admin, driver, customer
  userType: {
    type: String,
    enum: ['admin', 'driver', 'customer'],
    required: true
  },
  
  // Basic Info
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Location
  address: {
    street: String,
    city: String,
    country: { type: String, default: 'South Africa' },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // Profile
  profileImage: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // For Customers
  customerData: {
    favoriteAddresses: [{
      name: String,
      address: String,
      coordinates: { lat: Number, lng: Number }
    }],
    paymentMethods: [{
      type: { type: String, enum: ['card', 'cash', 'wallet'] },
      lastFour: String
    }]
  },
  
  // For Admins
  adminData: {
    companyName: String,
    role: { type: String, enum: ['owner', 'manager', 'dispatcher'] }
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Driver Details
  driverId: {
    type: String,
    unique: true,
    required: true
  },
  licenseNumber: {
    type: String,
    required: true
  },
  
  // Vehicle Details
  vehicle: {
    type: {
      type: String,
      enum: ['motorcycle', 'car', 'van', 'bicycle'],
      default: 'motorcycle'
    },
    make: String,
    model: String,
    year: Number,
    color: String,
    licensePlate: String
  },
  
  // Work Details
  ratePerKm: {
    type: Number,
    default: 10, // R10/km
    min: 5,
    max: 20
  },
  status: {
    type: String,
    enum: ['offline', 'online', 'busy', 'on_break'],
    default: 'offline'
  },
  
  // Location Tracking
  currentLocation: {
    lat: Number,
    lng: Number,
    address: String,
    lastUpdated: Date
  },
  locationHistory: [{
    lat: Number,
    lng: Number,
    timestamp: Date,
    speed: Number,
    heading: Number
  }],
  
  // Performance
  rating: {
    type: Number,
    default: 5.0,
    min: 1,
    max: 5
  },
  totalTrips: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  todayEarnings: {
    type: Number,
    default: 0
  },
  
  // Current Assignment
  currentTrip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip'
  },
  currentDeliveryIndex: {
    type: Number,
    default: 0
  },
  
  // Documents
  documents: {
    licenseImage: String,
    idImage: String,
    vehicleRegistration: String
  },
  
  // Availability
  workingHours: {
    start: { type: String, default: '08:00' },
    end: { type: String, default: '20:00' }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});