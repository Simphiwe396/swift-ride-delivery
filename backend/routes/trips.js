const express = require('express');
const Trip = require('../models/Trip');
const Driver = require('../models/Driver');
const router = express.Router();

// Create new trip
router.post('/', async (req, res) => {
  try {
    const {
      customerId,
      pickupLocation,
      deliveryLocation,
      distance,
      packageType,
      fare
    } = req.body;
    
    // Find available driver
    const availableDriver = await Driver.findOne({ status: 'available' });
    
    if (!availableDriver) {
      return res.status(400).json({
        success: false,
        error: 'No available drivers at the moment'
      });
    }
    
    // Create trip
    const trip = new Trip({
      customer: customerId,
      driver: availableDriver._id,
      pickupLocation,
      deliveryLocation,
      distance,
      fare,
      status: 'accepted',
      estimatedTime: calculateETA(distance)
    });
    
    await trip.save();
    
    // Update driver status
    availableDriver.status = 'busy';
    await availableDriver.save();
    
    res.status(201).json({
      success: true,
      trip,
      driver: {
        id: availableDriver._id,
        name: (await availableDriver.populate('user')).user.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user trips
router.get('/user/:userId', async (req, res) => {
  try {
    const trips = await Trip.find({ customer: req.params.userId })
      .populate('driver')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({
      success: true,
      trips
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get trip by ID
router.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('customer', 'name phone')
      .populate('driver');
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }
    
    res.json({
      success: true,
      trip
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update trip status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }
    
    // If trip completed, update driver status
    if (status === 'delivered' || status === 'cancelled') {
      await Driver.findByIdAndUpdate(trip.driver, { status: 'available' });
    }
    
    res.json({
      success: true,
      trip
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Calculate ETA based on distance
function calculateETA(distance) {
  // Assuming average speed of 30 km/h in city traffic
  const averageSpeed = 30; // km/h
  const timeInHours = distance / averageSpeed;
  return Math.ceil(timeInHours * 60); // Convert to minutes
}

module.exports = router;