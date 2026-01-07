// ===== DRIVER PAGE SPECIFIC FUNCTIONS =====

let driverStatus = 'offline';
let currentLocation = null;
let watchId = null;
let pendingTrip = null;
let activeTrip = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize driver dashboard
    if (!window.AppState || !window.AppState.user || window.AppState.user.type !== 'driver') {
        window.location.href = 'index.html';
        return;
    }
    
    // Update driver info
    document.getElementById('driverName').textContent = window.AppState.user.name;
    updateStatusDisplay();
    
    // Initialize map
    if (typeof window.initMap === 'function') {
        window.initMap('driverMap');
    }
    
    // Start tracking location
    startLocationTracking();
    
    // Load driver data
    await loadDriverData();
    await loadTripHistory();
    
    // Check for active trip
    await checkActiveTrip();
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
    
    // If showing current trip, initialize map
    if (sectionId === 'current-trip' && activeTrip) {
        setTimeout(() => {
            initCurrentTripMap();
        }, 100);
    }
}

function updateStatusDisplay() {
    document.getElementById('statusDisplay').textContent = driverStatus;
    document.getElementById('statusDisplay').style.color = 
        driverStatus === 'online' ? 'green' : 
        driverStatus === 'busy' ? 'orange' : 'gray';
}

function goOnline() {
    driverStatus = 'online';
    updateStatusDisplay();
    updateLocationToServer();
    if (typeof window.showNotification === 'function') {
        window.showNotification('You are now online and visible to customers', 'success');
    }
}

function goBusy() {
    driverStatus = 'busy';
    updateStatusDisplay();
    updateLocationToServer();
    if (typeof window.showNotification === 'function') {
        window.showNotification('Status set to busy', 'info');
    }
}

function goOffline() {
    driverStatus = 'offline';
    updateStatusDisplay();
    updateLocationToServer();
    if (typeof window.showNotification === 'function') {
        window.showNotification('You are now offline', 'info');
    }
}

function startLocationTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                currentLocation = { lat: latitude, lng: longitude };
                
                // Update marker on map
                if (typeof window.updateMarker === 'function') {
                    window.updateMarker('driver_location', [latitude, longitude]);
                }
                
                // Update to server
                updateLocationToServer();
                
                // Center map on location
                if (window.AppState && window.AppState.map) {
                    window.AppState.map.setView([latitude, longitude], 15);
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                if (typeof window.showNotification === 'function') {
                    window.showNotification('Unable to get location: ' + error.message, 'error');
                }
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 5000
            }
        );
    } else {
        if (typeof window.showNotification === 'function') {
            window.showNotification('Geolocation is not supported by your browser', 'error');
        }
    }
}

function updateLocationToServer() {
    if (!currentLocation || !window.AppState || !window.AppState.socket) return;
    
    window.AppState.socket.emit('driver-location', {
        driverId: window.AppState.user.id,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        status: driverStatus
    });
}

function centerOnLocation() {
    if (currentLocation && window.AppState && window.AppState.map) {
        window.AppState.map.setView([currentLocation.lat, currentLocation.lng], 15);
    }
}

async function loadDriverData() {
    try {
        // Simulate loading driver data
        document.getElementById('totalEarnings').textContent = '250.50';
        document.getElementById('totalTrips').textContent = '25';
        document.getElementById('onlineTime').textContent = '4h 30m';
        document.getElementById('driverRating').textContent = '4.8';
    } catch (error) {
        console.error('Failed to load driver data:', error);
    }
}

async function loadTripHistory() {
    try {
        if (typeof window.getTripHistory === 'function') {
            const trips = await window.getTripHistory(window.AppState.user.id, 'driver');
            const tableBody = document.getElementById('driverTripHistory');
            
            // Show only last 50 trips
            const recentTrips = trips.slice(0, 50);
            
            if (recentTrips.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem; color: #666;">
                            No trip history yet
                        </td>
                    </tr>
                `;
                return;
            }
            
            tableBody.innerHTML = recentTrips.map(trip => `
                <tr>
                    <td>${new Date(trip.createdAt).toLocaleDateString()}</td>
                    <td>${trip.tripId?.substring(0, 8) || 'N/A'}</td>
                    <td>${trip.pickup?.address?.substring(0, 15) || 'N/A'}...</td>
                    <td>${trip.destination?.address?.substring(0, 15) || 'N/A'}...</td>
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

async function checkActiveTrip() {
    try {
        if (typeof window.getTripHistory === 'function') {
            const trips = await window.getTripHistory(window.AppState.user.id, 'driver');
            activeTrip = trips.find(trip => 
                ['accepted', 'in_progress', 'picked_up'].includes(trip.status)
            );
            
            if (activeTrip) {
                showActiveTrip();
            }
        }
    } catch (error) {
        console.error('Failed to check active trip:', error);
    }
}

function showActiveTrip() {
    document.getElementById('noActiveTrip').style.display = 'none';
    document.getElementById('activeTripCard').style.display = 'block';
    
    document.getElementById('tripId').textContent = activeTrip.tripId?.substring(0, 8) || 'N/A';
    document.getElementById('currentPickup').textContent = activeTrip.pickup?.address || 'N/A';
    document.getElementById('currentDestination').textContent = activeTrip.destination?.address || 'N/A';
    document.getElementById('currentDistance').textContent = activeTrip.distance || 0;
    document.getElementById('currentFare').textContent = activeTrip.fare?.toFixed(2) || '0.00';
    document.getElementById('currentStatus').textContent = activeTrip.status;
    document.getElementById('currentStatus').className = `trip-status status-${activeTrip.status}`;
    
    // Show/hide buttons based on status
    const pickupBtn = document.getElementById('pickupBtn');
    const deliverBtn = document.getElementById('deliverBtn');
    
    if (activeTrip.status === 'accepted') {
        pickupBtn.style.display = 'block';
        deliverBtn.style.display = 'none';
    } else if (activeTrip.status === 'picked_up') {
        pickupBtn.style.display = 'none';
        deliverBtn.style.display = 'block';
    }
}

function initCurrentTripMap() {
    const mapElement = document.getElementById('currentTripMap');
    if (!mapElement) return;
    
    // Remove existing map instance
    if (window.AppState && window.AppState.map && mapElement._leaflet_id) {
        window.AppState.map.remove();
    }
    
    // Initialize new map
    if (typeof window.initMap === 'function') {
        window.initMap('currentTripMap');
    }
    
    if (activeTrip && activeTrip.pickup) {
        // Add pickup marker
        if (typeof window.addMarker === 'function') {
            window.addMarker('pickup', [activeTrip.pickup.lat, activeTrip.pickup.lng], {
                title: 'Pickup',
                icon: L.divIcon({
                    html: '<i class="fas fa-circle" style="color: green; font-size: 20px;"></i>',
                    className: 'pickup-marker'
                })
            });
        }
    }
    
    if (activeTrip && activeTrip.destination) {
        // Add destination marker
        if (typeof window.addMarker === 'function') {
            window.addMarker('destination', [activeTrip.destination.lat, activeTrip.destination.lng], {
                title: 'Destination',
                icon: L.divIcon({
                    html: '<i class="fas fa-flag" style="color: red; font-size: 20px;"></i>',
                    className: 'destination-marker'
                })
            });
        }
    }
    
    // Add driver marker if location available
    if (currentLocation && typeof window.addMarker === 'function') {
        window.addMarker('driver', [currentLocation.lat, currentLocation.lng], {
            title: 'You are here',
            icon: L.divIcon({
                html: '<i class="fas fa-motorcycle" style="color: blue; font-size: 20px;"></i>',
                className: 'driver-marker'
            })
        });
    }
    
    // Fit map to show all markers
    if (window.AppState && window.AppState.map && Object.keys(window.AppState.markers).length > 0) {
        const markers = Object.values(window.AppState.markers);
        const group = new L.featureGroup(markers);
        window.AppState.map.fitBounds(group.getBounds().pad(0.1));
    }
}

function acceptTrip() {
    if (!pendingTrip) return;
    
    window.AppState.socket.emit('accept-trip', {
        tripId: pendingTrip.tripId,
        driverId: window.AppState.user.id
    });
    
    activeTrip = pendingTrip;
    pendingTrip = null;
    
    document.getElementById('newTripNotification').style.display = 'none';
    if (typeof window.showNotification === 'function') {
        window.showNotification('Trip accepted! Navigate to pickup location.', 'success');
    }
    
    // Show current trip section
    showSection('current-trip');
    setTimeout(() => {
        initCurrentTripMap();
    }, 100);
}

function declineTrip() {
    pendingTrip = null;
    document.getElementById('newTripNotification').style.display = 'none';
    if (typeof window.showNotification === 'function') {
        window.showNotification('Trip declined', 'info');
    }
}

function markAsPickedUp() {
    if (!activeTrip) return;
    
    window.AppState.socket.emit('update-trip', {
        tripId: activeTrip._id,
        status: 'picked_up',
        location: currentLocation
    });
    
    activeTrip.status = 'picked_up';
    showActiveTrip();
    if (typeof window.showNotification === 'function') {
        window.showNotification('Package picked up! Proceed to destination.', 'success');
    }
}

function markAsDelivered() {
    if (!activeTrip) return;
    
    window.AppState.socket.emit('update-trip', {
        tripId: activeTrip._id,
        status: 'completed',
        location: currentLocation
    });
    
    activeTrip.status = 'completed';
    showActiveTrip();
    if (typeof window.showNotification === 'function') {
        window.showNotification('Delivery completed! Payment received.', 'success');
    }
    
    // Update earnings
    const currentEarnings = parseFloat(document.getElementById('totalEarnings').textContent);
    const tripFare = activeTrip.fare || 0;
    document.getElementById('totalEarnings').textContent = (currentEarnings + tripFare).toFixed(2);
    
    // Reset after delay
    setTimeout(() => {
        activeTrip = null;
        showSection('dashboard');
    }, 3000);
}

function cancelTrip() {
    if (!activeTrip) return;
    
    if (confirm('Are you sure you want to cancel this trip?')) {
        window.AppState.socket.emit('update-trip', {
            tripId: activeTrip._id,
            status: 'cancelled'
        });
        
        activeTrip = null;
        if (typeof window.showNotification === 'function') {
            window.showNotification('Trip cancelled', 'info');
        }
        showSection('dashboard');
    }
}

// Socket event listeners
if (window.AppState && window.AppState.socket) {
    window.AppState.socket.on('new-trip', (data) => {
        pendingTrip = data;
        
        document.getElementById('tripPickup').textContent = data.pickup?.address || 'Unknown';
        document.getElementById('tripDestination').textContent = data.destination?.address || 'Unknown';
        document.getElementById('tripFare').textContent = data.fare?.toFixed(2) || '0.00';
        
        document.getElementById('newTripNotification').style.display = 'block';
        
        // Show notification sound/alert
        if (typeof window.showNotification === 'function') {
            window.showNotification('New trip request received!', 'success');
        }
    });
    
    window.AppState.socket.on('trip-updated', (data) => {
        if (activeTrip && activeTrip._id === data.tripId) {
            activeTrip = data.trip;
            showActiveTrip();
        }
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
    
    // Mark driver as offline
    if (window.AppState && window.AppState.socket) {
        window.AppState.socket.emit('driver-location', {
            driverId: window.AppState.user.id,
            status: 'offline'
        });
    }
});