const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  // Trip Identification
  tripId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Parties Involved
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  
  // Trip Details
  pickup: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    contactName: String,
    contactPhone: String,
    instructions: String
  },
  
  destinations: [{
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    recipientName: String,
    recipientPhone: String,
    instructions: String,
    status: {
      type: String,
      enum: ['pending', 'enroute', 'arrived', 'delivered', 'failed'],
      default: 'pending'
    },
    deliveredAt: Date,
    proofImage: String,
    signature: String
  }],
  
  // Route Information
  distance: Number, // in kilometers
  estimatedDuration: Number, // in minutes
  polyline: String, // for map drawing
  
  // Fare Calculation
  fare: {
    baseFare: Number,
    distanceFare: Number,
    total: Number,
    currency: { type: String, default: 'ZAR' }
  },
  
  // Payment
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'wallet'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['requested', 'accepted', 'in_progress', 'completed', 'cancelled'],
    default: 'requested'
  },
  
  // Timestamps
  requestedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  
  // Ratings & Reviews
  driverRating: {
    rating: Number,
    comment: String
  },
  customerRating: {
    rating: Number,
    comment: String
  },
  
  // Additional Data
  notes: String,
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'express'],
    default: 'normal'
  }
});