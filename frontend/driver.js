// ===== DRIVER PAGE SPECIFIC FUNCTIONS =====

let driverStatus = 'offline';
let currentLocation = { lat: -26.0748, lng: 28.2204 }; // Start near warehouse
let watchId = null;
let pendingTrip = null;
let activeTrip = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    const userData = localStorage.getItem('swiftride_user');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        if (user.type !== 'driver') {
            window.location.href = 'index.html';
            return;
        }
        
        // Update driver info
        const driverNameElement = document.getElementById('driverName');
        if (driverNameElement) {
            driverNameElement.textContent = user.name;
        }
        
    } catch (error) {
        window.location.href = 'index.html';
        return;
    }
    
    updateStatusDisplay();
    
    // Initialize map
    if (typeof window.initMap === 'function') {
        window.initMap('driverMap');
        
        // Add warehouse marker
        if (window.AppState && window.AppState.map) {
            L.marker(APP_CONFIG.MAP_CENTER).addTo(window.AppState.map)
                .bindPopup('<strong>TV Stands Warehouse</strong><br>5 Zaria Cres, Birchleigh North')
                .openPopup();
        }
    }
    
    // Start tracking location
    startLocationTracking();
    
    // Load driver data
    await loadDriverData();
    await loadTripHistory();
    
    // Check for active trip
    await checkActiveTrip();
    
    // Add event listeners
    setupEventListeners();
    
    // Hide loading screen
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 1000);
});

function setupEventListeners() {
    // Sidebar menu
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.addEventListener('click', function() {
            const sectionId = this.getAttribute('onclick')?.match(/showSection\('([^']+)'\)/)?.[1];
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });
    
    // Status buttons
    const statusButtons = {
        'goOnline': goOnline,
        'goBusy': goBusy,
        'goOffline': goOffline
    };
    
    Object.keys(statusButtons).forEach(btnId => {
        const btn = document.querySelector(`[onclick="${btnId}()"]`);
        if (btn) {
            btn.addEventListener('click', statusButtons[btnId]);
        }
    });
    
    // Center on location button
    const centerBtn = document.querySelector('[onclick="centerOnLocation()"]');
    if (centerBtn) {
        centerBtn.addEventListener('click', centerOnLocation);
    }
    
    // Trip action buttons
    document.querySelectorAll('[onclick^="acceptTrip"], [onclick^="declineTrip"], [onclick^="markAsPickedUp"], [onclick^="markAsDelivered"], [onclick^="cancelTrip"]').forEach(btn => {
        const funcName = btn.getAttribute('onclick').replace('()', '');
        if (window[funcName]) {
            btn.addEventListener('click', window[funcName]);
        }
    });
}

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
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
    
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
    const statusElement = document.getElementById('statusDisplay');
    if (statusElement) {
        statusElement.textContent = driverStatus;
        statusElement.style.color = 
            driverStatus === 'online' ? 'green' : 
            driverStatus === 'busy' ? 'orange' : 'gray';
    }
}

function goOnline() {
    driverStatus = 'online';
    updateStatusDisplay();
    updateLocationToServer();
    showNotification('You are now online and visible to customers', 'success');
}

function goBusy() {
    driverStatus = 'busy';
    updateStatusDisplay();
    updateLocationToServer();
    showNotification('Status set to busy', 'info');
}

function goOffline() {
    driverStatus = 'offline';
    updateStatusDisplay();
    updateLocationToServer();
    showNotification('You are now offline', 'info');
}

function startLocationTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                currentLocation = { lat: latitude, lng: longitude };
                
                // Update marker on map
                if (window.AppState && window.AppState.map) {
                    // Remove existing driver marker
                    if (window.AppState.markers['driver_location']) {
                        window.AppState.map.removeLayer(window.AppState.markers['driver_location']);
                    }
                    
                    // Add new marker
                    window.AppState.markers['driver_location'] = L.marker([latitude, longitude], {
                        icon: L.divIcon({
                            html: '<i class="fas fa-motorcycle" style="color: blue; font-size: 20px;"></i>',
                            className: 'driver-location-marker'
                        })
                    }).addTo(window.AppState.map)
                    .bindPopup('<strong>Your Location</strong>');
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
                showNotification('Using simulated location', 'warning');
                
                // Use simulated location near warehouse
                const offsetLat = (Math.random() * 0.02) - 0.01;
                const offsetLng = (Math.random() * 0.02) - 0.01;
                currentLocation = { 
                    lat: APP_CONFIG.MAP_CENTER[0] + offsetLat, 
                    lng: APP_CONFIG.MAP_CENTER[1] + offsetLng 
                };
                
                updateLocationToServer();
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 5000
            }
        );
    } else {
        showNotification('Geolocation not supported, using simulated location', 'warning');
        currentLocation = { lat: -26.0748, lng: 28.2204 };
        updateLocationToServer();
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
        // Update driver stats
        const totalEarnings = document.getElementById('totalEarnings');
        const totalTrips = document.getElementById('totalTrips');
        const onlineTime = document.getElementById('onlineTime');
        const driverRating = document.getElementById('driverRating');
        
        if (totalEarnings) totalEarnings.textContent = '4,500.00';
        if (totalTrips) totalTrips.textContent = '15';
        if (onlineTime) onlineTime.textContent = '8h 30m';
        if (driverRating) driverRating.textContent = '4.8';
    } catch (error) {
        console.error('Failed to load driver data:', error);
    }
}

async function loadTripHistory() {
    try {
        const trips = await getTripHistory(window.AppState.user.id, 'driver');
        const tableBody = document.getElementById('driverTripHistory');
        
        if (!tableBody) return;
        
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
                <td>${(trip.pickup?.address || 'Warehouse').substring(0, 15)}...</td>
                <td>${(trip.destination?.address || 'N/A').substring(0, 15)}...</td>
                <td>${trip.distance || 0} km</td>
                <td>R ${trip.fare?.toFixed(2) || '0.00'}</td>
                <td><span class="trip-status status-${trip.status}">${trip.status}</span></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load trip history:', error);
    }
}

async function checkActiveTrip() {
    try {
        const trips = await getTripHistory(window.AppState.user.id, 'driver');
        activeTrip = trips.find(trip => 
            ['accepted', 'in_progress', 'picked_up'].includes(trip.status)
        );
        
        if (activeTrip) {
            showActiveTrip();
        }
    } catch (error) {
        console.error('Failed to check active trip:', error);
    }
}

function showActiveTrip() {
    const noTripElement = document.getElementById('noActiveTrip');
    const tripCard = document.getElementById('activeTripCard');
    
    if (noTripElement) noTripElement.style.display = 'none';
    if (tripCard) tripCard.style.display = 'block';
    
    // Update trip info
    const tripIdElement = document.getElementById('tripId');
    const currentPickup = document.getElementById('currentPickup');
    const currentDestination = document.getElementById('currentDestination');
    const currentDistance = document.getElementById('currentDistance');
    const currentFare = document.getElementById('currentFare');
    const currentStatus = document.getElementById('currentStatus');
    const pickupBtn = document.getElementById('pickupBtn');
    const deliverBtn = document.getElementById('deliverBtn');
    
    if (tripIdElement) tripIdElement.textContent = activeTrip.tripId?.substring(0, 8) || 'N/A';
    if (currentPickup) currentPickup.textContent = activeTrip.pickup?.address || 'TV Stands Warehouse';
    if (currentDestination) currentDestination.textContent = activeTrip.destination?.address || 'N/A';
    if (currentDistance) currentDistance.textContent = activeTrip.distance || 0;
    if (currentFare) currentFare.textContent = activeTrip.fare?.toFixed(2) || '0.00';
    if (currentStatus) {
        currentStatus.textContent = activeTrip.status;
        currentStatus.className = `trip-status status-${activeTrip.status}`;
    }
    
    // Show/hide buttons based on status
    if (pickupBtn && deliverBtn) {
        if (activeTrip.status === 'accepted') {
            pickupBtn.style.display = 'block';
            deliverBtn.style.display = 'none';
        } else if (activeTrip.status === 'picked_up') {
            pickupBtn.style.display = 'none';
            deliverBtn.style.display = 'block';
        }
    }
}

function initCurrentTripMap() {
    const mapElement = document.getElementById('currentTripMap');
    if (!mapElement) return;
    
    // Initialize new map
    if (typeof window.initMap === 'function') {
        window.initMap('currentTripMap');
        
        if (activeTrip && activeTrip.pickup) {
            // Add pickup marker
            L.marker([activeTrip.pickup.lat, activeTrip.pickup.lng], {
                icon: L.divIcon({
                    html: '<i class="fas fa-warehouse" style="color: blue; font-size: 20px;"></i>',
                    className: 'pickup-marker'
                })
            }).addTo(window.AppState.map)
            .bindPopup('<strong>Pickup</strong><br>TV Stands Warehouse');
        }
        
        if (activeTrip && activeTrip.destination) {
            // Add destination marker
            L.marker([activeTrip.destination.lat, activeTrip.destination.lng], {
                icon: L.divIcon({
                    html: '<i class="fas fa-flag" style="color: red; font-size: 20px;"></i>',
                    className: 'destination-marker'
                })
            }).addTo(window.AppState.map)
            .bindPopup('<strong>Destination</strong><br>' + (activeTrip.destination.address || 'Customer Location'));
        }
        
        // Add driver marker if location available
        if (currentLocation && window.AppState && window.AppState.map) {
            L.marker([currentLocation.lat, currentLocation.lng], {
                icon: L.divIcon({
                    html: '<i class="fas fa-motorcycle" style="color: green; font-size: 20px;"></i>',
                    className: 'driver-marker'
                })
            }).addTo(window.AppState.map)
            .bindPopup('<strong>Your Location</strong>');
        }
        
        // Fit map to show all markers
        if (window.AppState && window.AppState.map) {
            const markers = [];
            
            if (activeTrip.pickup) markers.push([activeTrip.pickup.lat, activeTrip.pickup.lng]);
            if (activeTrip.destination) markers.push([activeTrip.destination.lat, activeTrip.destination.lng]);
            if (currentLocation) markers.push([currentLocation.lat, currentLocation.lng]);
            
            if (markers.length > 0) {
                const bounds = L.latLngBounds(markers);
                window.AppState.map.fitBounds(bounds);
            }
        }
    }
}

function acceptTrip() {
    if (!pendingTrip) return;
    
    if (window.AppState.socket) {
        window.AppState.socket.emit('accept-trip', {
            tripId: pendingTrip.tripId,
            driverId: window.AppState.user.id
        });
    }
    
    activeTrip = pendingTrip;
    pendingTrip = null;
    
    const notificationElement = document.getElementById('newTripNotification');
    if (notificationElement) {
        notificationElement.style.display = 'none';
    }
    
    showNotification('Delivery accepted! Navigate to warehouse.', 'success');
    
    // Show current trip section
    showSection('current-trip');
    setTimeout(() => {
        initCurrentTripMap();
    }, 100);
}

function declineTrip() {
    pendingTrip = null;
    const notificationElement = document.getElementById('newTripNotification');
    if (notificationElement) {
        notificationElement.style.display = 'none';
    }
    showNotification('Delivery declined', 'info');
}

function markAsPickedUp() {
    if (!activeTrip) return;
    
    if (window.AppState.socket) {
        window.AppState.socket.emit('update-trip', {
            tripId: activeTrip._id,
            status: 'picked_up',
            location: currentLocation
        });
    }
    
    activeTrip.status = 'picked_up';
    showActiveTrip();
    showNotification('TV Stand picked up! Proceed to destination.', 'success');
}

function markAsDelivered() {
    if (!activeTrip) return;
    
    if (window.AppState.socket) {
        window.AppState.socket.emit('update-trip', {
            tripId: activeTrip._id,
            status: 'completed',
            location: currentLocation
        });
    }
    
    activeTrip.status = 'completed';
    showActiveTrip();
    showNotification('Delivery completed! Payment received.', 'success');
    
    // Update earnings
    const currentEarnings = parseFloat(document.getElementById('totalEarnings')?.textContent || '0');
    const tripFare = activeTrip.fare || 0;
    const earningsElement = document.getElementById('totalEarnings');
    if (earningsElement) {
        earningsElement.textContent = (currentEarnings + tripFare).toFixed(2);
    }
    
    // Reset after delay
    setTimeout(() => {
        activeTrip = null;
        showSection('dashboard');
    }, 3000);
}

function cancelTrip() {
    if (!activeTrip) return;
    
    if (confirm('Are you sure you want to cancel this delivery?')) {
        if (window.AppState.socket) {
            window.AppState.socket.emit('update-trip', {
                tripId: activeTrip._id,
                status: 'cancelled'
            });
        }
        
        activeTrip = null;
        showNotification('Delivery cancelled', 'info');
        showSection('dashboard');
    }
}

// Socket event listeners
if (window.AppState && window.AppState.socket) {
    window.AppState.socket.on('new-trip', (data) => {
        pendingTrip = data;
        
        const tripPickup = document.getElementById('tripPickup');
        const tripDestination = document.getElementById('tripDestination');
        const tripFare = document.getElementById('tripFare');
        const notificationElement = document.getElementById('newTripNotification');
        
        if (tripPickup) tripPickup.textContent = data.pickup?.address || 'TV Stands Warehouse';
        if (tripDestination) tripDestination.textContent = data.destination?.address || 'Unknown';
        if (tripFare) tripFare.textContent = data.fare?.toFixed(2) || '0.00';
        if (notificationElement) {
            notificationElement.style.display = 'block';
        }
        
        // Show notification sound/alert
        showNotification('New delivery request received!', 'success');
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