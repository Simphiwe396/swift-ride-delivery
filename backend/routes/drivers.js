const express = require('express');
const Driver = require('../models/Driver');
const User = require('../models/User');
const router = express.Router();

// Get all available drivers
router.get('/available', async (req, res) => {
  try {
    const drivers = await Driver.find({ status: 'available' })
      .populate('user', 'name email phone')
      .select('-__v');
    
    res.json({
      success: true,
      drivers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update driver location
router.put('/:id/location', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      {
        currentLocation: {
          latitude,
          longitude,
          timestamp: new Date()
        }
      },
      { new: true }
    ).populate('user', 'name');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }
    
    res.json({
      success: true,
      driver
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update driver status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('user', 'name');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }
    
    res.json({
      success: true,
      driver
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get driver details
router.get('/:id', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('currentTrip');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }
    
    res.json({
      success: true,
      driver
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get driver statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }
    
    const stats = {
      totalTrips: driver.totalTrips,
      totalEarnings: driver.totalEarnings,
      rating: driver.rating,
      completedTrips: Math.floor(driver.totalTrips * 0.95), // Mock data
      cancelledTrips: Math.floor(driver.totalTrips * 0.05), // Mock data
      averageRating: driver.rating.toFixed(1),
      todayEarnings: (driver.totalEarnings / 30).toFixed(2) // Mock: assuming monthly
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;