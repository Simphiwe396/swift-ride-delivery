const express = require('express');
const Trip = require('../models/Trip');
const Driver = require('../models/Driver');
const router = express.Router();

// Get real-time trip tracking
router.get('/trip/:tripId', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId)
      .populate('driver')
      .select('status driver estimatedTime');
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }
    
    const driver = await Driver.findById(trip.driver._id)
      .populate('user', 'name phone');
    
    res.json({
      success: true,
      trip: {
        id: trip._id,
        status: trip.status,
        estimatedTime: trip.estimatedTime,
        driver: {
          id: driver._id,
          name: driver.user.name,
          phone: driver.user.phone,
          rating: driver.rating,
          currentLocation: driver.currentLocation
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get driver's current location
router.get('/driver/:driverId/location', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.driverId)
      .select('currentLocation');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }
    
    res.json({
      success: true,
      location: driver.currentLocation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Calculate distance between two points
router.post('/distance', async (req, res) => {
  try {
    const { lat1, lon1, lat2, lon2 } = req.body;
    
    const distance = calculateDistance(lat1, lon1, lat2, lon2);
    
    res.json({
      success: true,
      distance: distance.toFixed(2),
      unit: 'km'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Calculate fare based on distance
router.post('/fare', async (req, res) => {
  try {
    const { distance, ratePerKm = 10 } = req.body;
    
    const baseFare = 25;
    const distanceFare = distance * ratePerKm;
    const serviceFee = (baseFare + distanceFare) * 0.1;
    const totalFare = baseFare + distanceFare + serviceFee;
    
    res.json({
      success: true,
      fare: {
        base: baseFare,
        distance: distanceFare,
        serviceFee: serviceFee,
        total: totalFare
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = router;