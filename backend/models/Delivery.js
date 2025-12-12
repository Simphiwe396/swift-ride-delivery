const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  packageType: {
    type: String,
    enum: ['document', 'small', 'medium', 'large', 'fragile'],
    default: 'small'
  },
  weight: Number, // in kg
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  instructions: String,
  recipientName: String,
  recipientPhone: String,
  signatureRequired: {
    type: Boolean,
    default: false
  },
  photoProof: String,
  status: {
    type: String,
    enum: ['pending', 'picked_up', 'delivered'],
    default: 'pending'
  }
});

module.exports = mongoose.model('Delivery', deliverySchema);