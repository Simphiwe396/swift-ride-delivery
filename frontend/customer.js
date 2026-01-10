// ===== CUSTOMER PAGE SPECIFIC FUNCTIONS =====

let selectedRate = 20; // R20/km for TV stands
let currentTrip = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    const userData = localStorage.getItem('swiftride_user');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        if (user.type !== 'customer') {
            window.location.href = 'index.html';
            return;
        }
        
        // Update customer name
        const customerNameElement = document.getElementById('customerName');
        if (customerNameElement) {
            customerNameElement.textContent = user.name;
        }
        
    } catch (error) {
        window.location.href = 'index.html';
        return;
    }
    
    // Initialize map
    if (typeof window.initMap === 'function') {
        window.initMap('customerMap');
        
        // Add warehouse marker
        if (window.AppState && window.AppState.map) {
            L.marker(APP_CONFIG.MAP_CENTER).addTo(window.AppState.map)
                .bindPopup('<strong>TV Stands Warehouse</strong><br>5 Zaria Cres, Birchleigh North')
                .openPopup();
        }
    }
    
    // Load available drivers
    await loadAvailableDrivers();
    
    // Check for active trip
    await checkActiveTrip();
    
    // Load trip history
    await loadTripHistory();
    
    // Setup address autocomplete
    setupAddressAutocomplete();
    
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
    
    // Rate selector
    document.querySelectorAll('.rate-option').forEach(option => {
        option.addEventListener('click', function() {
            const rate = parseInt(this.querySelector('h3').textContent.replace('R', '').replace('/km', ''));
            selectRate(rate);
        });
    });
    
    // Request delivery button
    const requestBtn = document.querySelector('button[onclick="requestDelivery()"]');
    if (requestBtn) {
        requestBtn.addEventListener('click', requestDelivery);
    }
    
    // Address inputs for fare calculation
    const pickupInput = document.getElementById('pickupAddress');
    const destInput = document.getElementById('destinationAddress');
    
    if (pickupInput) {
        pickupInput.addEventListener('input', updateFareEstimate);
    }
    
    if (destInput) {
        destInput.addEventListener('input', updateFareEstimate);
    }
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
    const clickedItem = event.target.closest('li');
    if (clickedItem) {
        clickedItem.classList.add('active');
    }
    
    // If showing track delivery and have active trip, update it
    if (sectionId === 'track-delivery' && currentTrip) {
        setTimeout(() => {
            showActiveTrip(currentTrip);
        }, 100);
    }
}

function selectRate(rate) {
    selectedRate = rate;
    
    // Update UI
    document.querySelectorAll('.rate-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    const clickedOption = event.target.closest('.rate-option');
    if (clickedOption) {
        clickedOption.classList.add('selected');
    }
    
    // Update fare estimate
    updateFareEstimate();
}

async function updateFareEstimate() {
    const pickup = document.getElementById('pickupAddress')?.value;
    const destination = document.getElementById('destinationAddress')?.value;
    
    if (!pickup || !destination) return;
    
    try {
        // Calculate distance from warehouse to destination (simulated)
        const warehouseLat = APP_CONFIG.MAP_CENTER[0];
        const warehouseLng = APP_CONFIG.MAP_CENTER[1];
        
        // Simulated destination coordinates (random within 50km radius)
        const destLat = warehouseLat + (Math.random() * 0.5 - 0.25);
        const destLng = warehouseLng + (Math.random() * 0.5 - 0.25);
        
        const distance = calculateDistance(warehouseLat, warehouseLng, destLat, destLng);
        
        const distanceDisplay = document.getElementById('distanceDisplay');
        if (distanceDisplay) {
            distanceDisplay.textContent = `${distance} km`;
        }
        
        const fare = calculateFare(distance, selectedRate);
        const fareDisplay = document.getElementById('fareDisplay');
        if (fareDisplay) {
            fareDisplay.textContent = fare.toFixed(2);
        }
    } catch (error) {
        console.error('Error calculating fare:', error);
    }
}

async function requestDelivery() {
    const pickup = document.getElementById('pickupAddress')?.value;
    const destination = document.getElementById('destinationAddress')?.value;
    const packageDesc = document.getElementById('packageDesc')?.value || 'TV Stand Delivery';
    
    if (!pickup || !destination) {
        showNotification('Please enter pickup and destination addresses', 'error');
        return;
    }
    
    try {
        // Calculate distance
        const warehouseLat = APP_CONFIG.MAP_CENTER[0];
        const warehouseLng = APP_CONFIG.MAP_CENTER[1];
        const destLat = warehouseLat + (Math.random() * 0.5 - 0.25);
        const destLng = warehouseLng + (Math.random() * 0.5 - 0.25);
        const distance = calculateDistance(warehouseLat, warehouseLng, destLat, destLng);
        
        const fare = calculateFare(distance, selectedRate);
        
        const tripData = {
            customerId: window.AppState.user.id,
            customerName: window.AppState.user.name,
            pickup: {
                address: '5 Zaria Cres, Birchleigh North, Kempton Park',
                lat: warehouseLat,
                lng: warehouseLng
            },
            destination: {
                address: destination,
                lat: destLat,
                lng: destLng
            },
            distance: distance,
            fare: fare,
            ratePerKm: selectedRate,
            packageDescription: packageDesc,
            status: 'pending'
        };
        
        // Send trip request
        const result = await createTrip(tripData);
        
        if (result.success) {
            currentTrip = result.trip;
            showNotification('Delivery request sent! Looking for drivers...', 'success');
            
            // Clear form
            document.getElementById('pickupAddress').value = '5 Zaria Cres, Birchleigh North, Kempton Park';
            document.getElementById('destinationAddress').value = '';
            document.getElementById('packageDesc').value = '';
            
            // Show tracking section
            showSection('track-delivery');
            showActiveTrip(currentTrip);
        } else {
            showNotification('Failed to request delivery. Please try again.', 'error');
        }
        
    } catch (error) {
        console.error('Error requesting delivery:', error);
        showNotification('Failed to request delivery: ' + error.message, 'error');
    }
}

async function loadAvailableDrivers() {
    try {
        const drivers = await getAvailableDrivers();
        
        // Add driver markers to map
        drivers.forEach(driver => {
            if (driver.currentLocation && window.AppState && window.AppState.map) {
                const marker = L.marker([driver.currentLocation.lat, driver.currentLocation.lng], {
                    icon: L.divIcon({
                        html: `<div style="background: green; width: 25px; height: 25px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${driver.name?.charAt(0) || 'D'}</div>`,
                        className: 'driver-marker',
                        iconSize: [25, 25]
                    })
                }).addTo(window.AppState.map)
                .bindPopup(`<strong>${driver.name}</strong><br>${driver.vehicleType || 'Vehicle'}<br>Status: ${driver.status}`);
                
                // Add navigate button
                marker.bindPopup(`<strong>${driver.name}</strong><br>
                    ${driver.vehicleType || 'Vehicle'}<br>
                    Status: ${driver.status}<br>
                    <button onclick="navigateToDriver(${driver.currentLocation.lat}, ${driver.currentLocation.lng})" 
                            style="background: #6C63FF; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-top: 5px;">
                        <i class="fas fa-directions"></i> Navigate
                    </button>`);
            }
        });
    } catch (error) {
        console.error('Failed to load drivers:', error);
    }
}

async function checkActiveTrip() {
    try {
        const trips = await getTripHistory(window.AppState.user.id, 'customer');
        const activeTrip = trips.find(trip => 
            ['pending', 'accepted', 'in_progress', 'picked_up'].includes(trip.status)
        );
        
        if (activeTrip) {
            currentTrip = activeTrip;
            showActiveTrip(activeTrip);
        }
    } catch (error) {
        console.error('Failed to check active trip:', error);
    }
}

function showActiveTrip(trip) {
    const noTripElement = document.getElementById('noActiveTrip');
    const tripCard = document.getElementById('currentTripCard');
    
    if (noTripElement) noTripElement.style.display = 'none';
    if (tripCard) tripCard.style.display = 'block';
    
    // Update trip info
    const tripStatus = document.getElementById('tripStatus');
    const driverName = document.getElementById('driverName');
    const eta = document.getElementById('eta');
    
    if (tripStatus) {
        tripStatus.textContent = trip.status;
        tripStatus.className = `trip-status status-${trip.status}`;
    }
    if (driverName) driverName.textContent = trip.driverName || 'Not assigned';
    if (eta) eta.textContent = calculateETA(trip.distance || 0);
    
    // Initialize tracking map
    if (typeof initMap === 'function') {
        initMap('trackingMap');
        
        // Add pickup and destination markers
        if (trip.pickup && window.AppState && window.AppState.map) {
            L.marker([trip.pickup.lat, trip.pickup.lng], {
                icon: L.divIcon({
                    html: '<i class="fas fa-warehouse" style="color: blue; font-size: 24px;"></i>',
                    className: 'pickup-marker',
                    iconSize: [30, 30]
                })
            }).addTo(window.AppState.map)
            .bindPopup('<strong>Pickup</strong><br>TV Stands Warehouse<br>5 Zaria Cres, Birchleigh North');
        }
        
        if (trip.destination && window.AppState && window.AppState.map) {
            L.marker([trip.destination.lat, trip.destination.lng], {
                icon: L.divIcon({
                    html: '<i class="fas fa-flag" style="color: red; font-size: 24px;"></i>',
                    className: 'destination-marker',
                    iconSize: [30, 30]
                })
            }).addTo(window.AppState.map)
            .bindPopup('<strong>Destination</strong><br>' + (trip.destination.address || 'Customer Location'));
        }
        
        // Fit map to show both points
        if (trip.pickup && trip.destination && window.AppState && window.AppState.map) {
            const bounds = L.latLngBounds(
                [trip.pickup.lat, trip.pickup.lng],
                [trip.destination.lat, trip.destination.lng]
            );
            window.AppState.map.fitBounds(bounds);
        }
        
        // Add driver marker if driver is assigned
        if (trip.driverId && trip.status !== 'pending') {
            // Find driver location from online drivers
            if (window.AppState && window.AppState.onlineDrivers) {
                const driver = window.AppState.onlineDrivers.find(d => d.driverId === trip.driverId);
                if (driver && driver.lat && driver.lng) {
                    L.marker([driver.lat, driver.lng], {
                        icon: L.divIcon({
                            html: `<div style="background: orange; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${trip.driverName?.charAt(0) || 'D'}</div>`,
                            className: 'driver-marker',
                            iconSize: [30, 30]
                        })
                    }).addTo(window.AppState.map)
                    .bindPopup(`<strong>Driver: ${trip.driverName}</strong><br>Status: ${trip.status}<br>
                        <button onclick="navigateToDriver(${driver.lat}, ${driver.lng})" 
                                style="background: #6C63FF; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-top: 5px;">
                            <i class="fas fa-directions"></i> Navigate to Driver
                        </button>`);
                }
            }
        }
    }
}

function calculateETA(distanceKm) {
    // Assume average speed of 40 km/h in city traffic
    const travelTimeMinutes = Math.round((distanceKm / 40) * 60);
    const bufferTime = 15; // 15 minutes buffer for loading/unloading
    
    const totalMinutes = travelTimeMinutes + bufferTime;
    
    if (totalMinutes < 60) {
        return `${totalMinutes} minutes`;
    } else {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes}m`;
    }
}

async function loadTripHistory() {
    try {
        const trips = await getTripHistory(window.AppState.user.id, 'customer');
        const tableBody = document.getElementById('tripHistoryTable');
        
        if (!tableBody) return;
        
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
                <td>${(trip.pickup?.address || 'Warehouse').substring(0, 20)}...</td>
                <td>${(trip.destination?.address || 'N/A').substring(0, 20)}...</td>
                <td>${trip.distance || 0} km</td>
                <td>R ${trip.fare?.toFixed(2) || '0.00'}</td>
                <td><span class="trip-status status-${trip.status}">${trip.status}</span></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load trip history:', error);
    }
}

function setupAddressAutocomplete() {
    const pickupInput = document.getElementById('pickupAddress');
    const destInput = document.getElementById('destinationAddress');
    
    // Set default pickup address (warehouse)
    if (pickupInput) {
        pickupInput.value = '5 Zaria Cres, Birchleigh North, Kempton Park';
        pickupInput.readOnly = false;
        pickupInput.placeholder = 'Enter pickup address';
    }
    
    if (destInput) {
        destInput.placeholder = 'Enter delivery address';
    }
}

function navigateToDriver(lat, lng) {
    // Open Google Maps with directions to driver
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
    showNotification('Opening Google Maps with directions to driver...', 'info');
}

// Listen for trip updates
if (window.AppState && window.AppState.socket) {
    window.AppState.socket.on('trip-assigned', (data) => {
        if (currentTrip && currentTrip.tripId === data.tripId) {
            showNotification(`Driver ${data.driverName} assigned to your delivery!`, 'success');
            currentTrip.driverName = data.driverName;
            currentTrip.driverId = data.driverId;
            currentTrip.status = 'accepted';
            
            if (document.getElementById('track-delivery')?.style.display !== 'none') {
                showActiveTrip(currentTrip);
            }
        }
    });
    
    window.AppState.socket.on('trip-accepted', (data) => {
        if (currentTrip && currentTrip.tripId === data.tripId) {
            showNotification('Driver has accepted your delivery!', 'success');
            currentTrip.status = 'accepted';
            showActiveTrip(currentTrip);
        }
    });
    
    window.AppState.socket.on('trip-updated', (data) => {
        if (currentTrip && (currentTrip._id === data.tripId || currentTrip.tripId === data.tripId)) {
            currentTrip = { ...currentTrip, ...data.trip };
            showActiveTrip(currentTrip);
        }
    });
    
    window.AppState.socket.on('driver-update', (data) => {
        if (currentTrip && currentTrip.driverId === data.driverId) {
            // Update driver location on map
            if (document.getElementById('track-delivery')?.style.display !== 'none') {
                showActiveTrip(currentTrip);
            }
        }
    });
}

// Make functions globally available
window.showSection = showSection;
window.selectRate = selectRate;
window.requestDelivery = requestDelivery;
window.navigateToDriver = navigateToDriver;