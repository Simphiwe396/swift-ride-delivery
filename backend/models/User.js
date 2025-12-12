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