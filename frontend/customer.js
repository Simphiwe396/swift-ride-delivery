let selectedRate = 10;
let currentTrip = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize customer dashboard
    if (!window.AppState || !window.AppState.user || window.AppState.user.type !== 'customer') {
        window.location.href = 'index.html';
        return;
    }
    
    // Update customer name
    document.getElementById('customerName').textContent = window.AppState.user.name;
    
    // Initialize map
    if (typeof window.initMap === 'function') {
        window.initMap('customerMap');
    }
    
    // Load available drivers
    await loadAvailableDrivers();
    
    // Check for active trip
    await checkActiveTrip();
    
    // Load trip history
    await loadTripHistory();
    
    // Setup address autocomplete
    setupAddressAutocomplete();
});

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Remove active class from all menu items
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).style.display = 'block';
    
    // Add active class to clicked menu item
    event.target.closest('li').classList.add('active');
}

function selectRate(rate) {
    selectedRate = rate;
    
    // Update UI
    document.querySelectorAll('.rate-option').forEach(option => {
        option.classList.remove('selected');
    });
    event.target.closest('.rate-option').classList.add('selected');
    
    // Update fare estimate
    updateFareEstimate();
}

async function updateFareEstimate() {
    const pickup = document.getElementById('pickupAddress').value;
    const destination = document.getElementById('destinationAddress').value;
    
    if (!pickup || !destination) return;
    
    try {
        // Simulated distance
        const distance = 5;
        
        document.getElementById('distanceDisplay').textContent = `${distance} km`;
        
        if (typeof window.calculateFare === 'function') {
            const fare = window.calculateFare(distance, selectedRate);
            document.getElementById('fareDisplay').textContent = fare.toFixed(2);
        }
    } catch (error) {
        console.error('Error calculating fare:', error);
    }
}

async function requestDelivery() {
    const pickup = document.getElementById('pickupAddress').value;
    const destination = document.getElementById('destinationAddress').value;
    const packageDesc = document.getElementById('packageDesc').value;
    
    if (!pickup || !destination) {
        if (typeof window.showNotification === 'function') {
            window.showNotification('Please enter pickup and destination addresses', 'error');
        }
        return;
    }
    
    try {
        const distance = 5;
        const fare = typeof window.calculateFare === 'function' 
            ? window.calculateFare(distance, selectedRate)
            : distance * selectedRate;
        
        const tripData = {
            customerId: window.AppState.user.id,
            customerName: window.AppState.user.name,
            pickup: {
                address: pickup,
                lat: -26.195246 + (Math.random() * 0.1 - 0.05),
                lng: 28.034088 + (Math.random() * 0.1 - 0.05)
            },
            destination: {
                address: destination,
                lat: -26.195246 + (Math.random() * 0.1 - 0.05),
                lng: 28.034088 + (Math.random() * 0.1 - 0.05)
            },
            distance: distance,
            fare: fare,
            packageDescription: packageDesc,
            status: 'pending'
        };
        
        // Send trip request
        if (window.AppState.socket) {
            window.AppState.socket.emit('request-trip', tripData);
        }
        
        if (typeof window.showNotification === 'function') {
            window.showNotification('Delivery request sent! Looking for drivers...', 'success');
        }
        
        // Clear form
        document.getElementById('pickupAddress').value = '';
        document.getElementById('destinationAddress').value = '';
        document.getElementById('packageDesc').value = '';
        
        // Show tracking section
        showSection('track-delivery');
        
    } catch (error) {
        if (typeof window.showNotification === 'function') {
            window.showNotification('Failed to request delivery: ' + error.message, 'error');
        }
    }
}

async function loadAvailableDrivers() {
    try {
        if (typeof window.getAvailableDrivers === 'function') {
            const drivers = await window.getAvailableDrivers();
            
            // Add driver markers to map
            drivers.forEach(driver => {
                if (driver.currentLocation && typeof window.addMarker === 'function') {
                    window.addMarker(`driver_${driver._id}`, 
                        [driver.currentLocation.lat, driver.currentLocation.lng],
                        {
                            title: driver.name,
                            icon: L.divIcon({
                                html: `<div style="background: green; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>`,
                                className: 'driver-marker'
                            })
                        }
                    );
                }
            });
        }
    } catch (error) {
        console.error('Failed to load drivers:', error);
    }
}

async function checkActiveTrip() {
    try {
        if (typeof window.getTripHistory === 'function') {
            const trips = await window.getTripHistory(window.AppState.user.id, 'customer');
            const activeTrip = trips.find(trip => 
                ['pending', 'accepted', 'in_progress', 'picked_up'].includes(trip.status)
            );
            
            if (activeTrip) {
                currentTrip = activeTrip;
                showActiveTrip(activeTrip);
            }
        }
    } catch (error) {
        console.error('Failed to check active trip:', error);
    }
}

function showActiveTrip(trip) {
    document.getElementById('noActiveTrip').style.display = 'none';
    document.getElementById('currentTripCard').style.display = 'block';
    
    document.getElementById('tripStatus').textContent = trip.status;
    document.getElementById('driverName').textContent = trip.driverName || 'Not assigned';
    document.getElementById('eta').textContent = trip.estimatedTime || 'Calculating...';
    
    // Initialize tracking map
    if (typeof window.initMap === 'function') {
        window.initMap('trackingMap');
    }
    
    // Add pickup and destination markers
    if (trip.pickup && typeof window.addMarker === 'function') {
        window.addMarker('pickup', [trip.pickup.lat, trip.pickup.lng], {
            title: 'Pickup',
            icon: L.divIcon({
                html: '<i class="fas fa-circle" style="color: green; font-size: 20px;"></i>',
                className: 'pickup-marker'
            })
        });
    }
    
    if (trip.destination && typeof window.addMarker === 'function') {
        window.addMarker('destination', [trip.destination.lat, trip.destination.lng], {
            title: 'Destination',
            icon: L.divIcon({
                html: '<i class="fas fa-flag" style="color: red; font-size: 20px;"></i>',
                className: 'destination-marker'
            })
        });
    }
    
    // Fit map to show both points
    if (trip.pickup && trip.destination && window.AppState && window.AppState.map) {
        const bounds = L.latLngBounds(
            [trip.pickup.lat, trip.pickup.lng],
            [trip.destination.lat, trip.destination.lng]
        );
        window.AppState.map.fitBounds(bounds);
    }
}

async function loadTripHistory() {
    try {
        if (typeof window.getTripHistory === 'function') {
            const trips = await window.getTripHistory(window.AppState.user.id, 'customer');
            const tableBody = document.getElementById('tripHistoryTable');
            
            if (trips.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem; color: #666;">
                            No trip history yet
                        </td>
                    </tr>
                `;
                return;
            }
            
            tableBody.innerHTML = trips.map(trip => `
                <tr>
                    <td>${trip.tripId?.substring(0, 8) || 'N/A'}</td>
                    <td>${new Date(trip.createdAt).toLocaleDateString()}</td>
                    <td>${trip.pickup?.address?.substring(0, 20) || 'N/A'}...</td>
                    <td>${trip.destination?.address?.substring(0, 20) || 'N/A'}...</td>
                    <td>${trip.distance || 0} km</td>
                    <td>R ${trip.fare?.toFixed(2) || '0.00'}</td>
                    <td><span class="trip-status status-${trip.status}">${trip.status}</span></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load trip history:', error);
    }
}

function setupAddressAutocomplete() {
    const pickupInput = document.getElementById('pickupAddress');
    const destInput = document.getElementById('destinationAddress');
    
    [pickupInput, destInput].forEach(input => {
        input.addEventListener('input', updateFareEstimate);
    });
}

// Listen for trip updates
if (window.AppState && window.AppState.socket) {
    window.AppState.socket.on('trip-assigned', (data) => {
        if (typeof window.showNotification === 'function') {
            window.showNotification(`Driver ${data.driverName} assigned to your trip!`, 'success');
        }
        
        if (document.getElementById('track-delivery').style.display !== 'none') {
            showActiveTrip({ ...currentTrip, ...data });
        }
    });
    
    window.AppState.socket.on('trip-accepted', (data) => {
        if (typeof window.showNotification === 'function') {
            window.showNotification('Driver has accepted your trip!', 'success');
        }
    });
    
    window.AppState.socket.on('trip-updated', (data) => {
        if (currentTrip && currentTrip._id === data.tripId) {
            currentTrip = data.trip;
            showActiveTrip(currentTrip);
        }
    });
}