// ===== DRIVER DASHBOARD LOGIC =====

// Global variables
let currentDelivery = null;
let driverMap = null;
let driverMarker = null;

// Initialize driver dashboard
async function initializeDriverDashboard() {
    console.log('🚗 Initializing driver dashboard...');
    
    // Check authentication
    await checkDriverAuthentication();
    
    // Load driver profile
    await loadDriverProfile();
    
    // Initialize map
    initializeDriverMap();
    
    // Load initial data
    await loadInitialData();
    
    // Setup event listeners
    setupDriverEventListeners();
    
    // Request notification permission
    requestNotificationPermission();
}

async function checkDriverAuthentication() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!token || !user || user.userType !== 'driver') {
        window.location.href = 'index.html';
        throw new Error('Not authenticated as driver');
    }
    
    // Set user in AppState
    AppState.token = token;
    AppState.user = user;
    
    console.log('✅ Driver authenticated:', user.name);
}

async function loadDriverProfile() {
    try {
        const driver = await API.request('/drivers/me');
        
        // Update UI
        document.getElementById('driverName').textContent = driver.name;
        document.getElementById('driverAvatar').textContent = driver.name.charAt(0);
        
        // Update earnings
        updateEarningsDisplay(driver);
        
        // Update status
        updateStatusDisplay(driver.status);
        
        // Store driver data
        AppState.driver = driver;
        
    } catch (error) {
        console.error('Failed to load driver profile:', error);
        showNotification('Failed to load driver profile', 'error');
    }
}

function updateEarningsDisplay(driver) {
    const todayEarnings = document.getElementById('todayEarnings');
    const todayTrips = document.getElementById('todayTrips');
    const completedTrips = document.getElementById('completedTrips');
    const hourlyRate = document.getElementById('hourlyRate');
    const avgTripEarnings = document.getElementById('avgTripEarnings');
    const totalDistance = document.getElementById('totalDistance');
    
    if (todayEarnings) todayEarnings.textContent = `R ${(driver.todayEarnings || 0).toFixed(2)}`;
    if (todayTrips) todayTrips.textContent = driver.todayTrips || 0;
    if (completedTrips) completedTrips.textContent = driver.completedTrips || 0;
    
    // Calculate hourly rate (8-hour work day)
    const hours = 8;
    const hourly = (driver.todayEarnings || 0) / hours;
    if (hourlyRate) hourlyRate.textContent = `R ${hourly.toFixed(2)}`;
    
    // Calculate average trip earnings
    const avgTrip = driver.todayTrips > 0 ? (driver.todayEarnings || 0) / driver.todayTrips : 0;
    if (avgTripEarnings) avgTripEarnings.textContent = `R ${avgTrip.toFixed(2)}`;
    
    // Total distance (placeholder - would come from backend)
    if (totalDistance) totalDistance.textContent = '0 km';
}

function updateStatusDisplay(status) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('driverStatus');
    
    if (statusDot) {
        statusDot.className = `status-dot status-${status}`;
    }
    
    if (statusText) {
        statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    // Update button states
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.style.opacity = '0.6';
    });
    
    const activeBtn = document.querySelector(`.status-btn.${status}`);
    if (activeBtn) {
        activeBtn.style.opacity = '1';
    }
}

function initializeDriverMap() {
    if (!driverMap && document.getElementById('driverMap')) {
        driverMap = L.map('driverMap').setView([-26.195246, 28.034088], 14);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(driverMap);
        
        console.log('🗺️ Driver map initialized');
        
        // Try to get current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => centerMapOnLocation(position.coords),
                error => console.warn('Geolocation error:', error)
            );
        }
    }
}

function centerMapOnLocation(coords) {
    if (!driverMap) return;
    
    const { latitude, longitude } = coords;
    
    driverMap.setView([latitude, longitude], 14);
    
    // Add or update marker
    if (!driverMarker) {
        driverMarker = L.marker([latitude, longitude], {
            icon: L.divIcon({
                html: '<div style="background: #6C63FF; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid white; box-shadow: 0 0 15px rgba(108, 99, 255, 0.7);"><i class="fas fa-motorcycle"></i></div>',
                iconSize: [40, 40],
                className: 'pulse'
            })
        }).addTo(driverMap)
          .bindPopup('Your Location');
    } else {
        driverMarker.setLatLng([latitude, longitude]);
    }
}

async function loadInitialData() {
    try {
        // Load available deliveries
        const deliveries = await API.request('/trips/available');
        renderAvailableDeliveries(deliveries);
        
        // Load recent trips
        const recentTrips = await API.request('/trips/driver/recent');
        renderRecentTrips(recentTrips);
        
        // Check for current delivery
        const currentTrip = await API.request('/trips/current');
        if (currentTrip) {
            showCurrentDelivery(currentTrip);
        }
        
    } catch (error) {
        console.error('Failed to load initial data:', error);
    }
}

function renderAvailableDeliveries(deliveries) {
    const container = document.getElementById('availableDeliveriesList');
    if (!container) return;
    
    if (!deliveries || deliveries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box"></i>
                <p>No deliveries available</p>
                <small>Check back later or go online to receive deliveries</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = deliveries.map(delivery => `
        <div class="delivery-card">
            <div class="delivery-header">
                <strong>${delivery.pickup?.address?.substring(0, 25) || 'Pickup'}...</strong>
                <div class="delivery-price">R ${delivery.fare?.total?.toFixed(2)}</div>
            </div>
            <div class="delivery-details">
                <p><i class="fas fa-map-marker-alt"></i> ${delivery.pickup?.address?.substring(0, 40) || ''}</p>
                <p><i class="fas fa-flag-checkered"></i> ${delivery.destinations?.[0]?.address?.substring(0, 40) || ''}</p>
                <p><i class="fas fa-road"></i> ${delivery.distance ? delivery.distance.toFixed(1) + 'km' : 'Distance unknown'}</p>
                <p><i class="fas fa-clock"></i> ${delivery.estimatedDuration || '?'} min • ${formatTimeAgo(delivery.requestedAt)}</p>
            </div>
            <button class="btn btn-primary" onclick="acceptDelivery('${delivery._id}')" style="width: 100%; margin-top: 0.5rem;">
                <i class="fas fa-check"></i> Accept Delivery
            </button>
        </div>
    `).join('');
}

function renderRecentTrips(trips) {
    const container = document.getElementById('recentTrips');
    if (!container) return;
    
    if (!trips || trips.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 1rem;">
                <i class="fas fa-history"></i>
                <p>No recent trips</p>
                <small>Your completed trips will appear here</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = trips.map(trip => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--gray-light);">
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
                    <strong>${trip.pickup?.address?.substring(0, 25) || 'Trip'}...</strong>
                    <span class="status-badge badge-${trip.status}" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">
                        ${trip.status}
                    </span>
                </div>
                <div style="display: flex; gap: 1rem; font-size: 0.85rem; color: var(--gray);">
                    <span><i class="fas fa-clock"></i> ${formatTime(trip.estimatedDuration)}</span>
                    <span><i class="fas fa-road"></i> ${trip.distance ? trip.distance.toFixed(1) + 'km' : ''}</span>
                    <span><i class="fas fa-calendar"></i> ${new Date(trip.completedAt || trip.requestedAt).toLocaleDateString()}</span>
                </div>
            </div>
            <div style="text-align: right; min-width: 80px;">
                <strong style="color: var(--primary); font-size: 1.1rem;">R ${trip.fare?.total?.toFixed(2)}</strong>
                <div style="font-size: 0.8rem; color: var(--gray);">
                    ${trip.paymentMethod || 'cash'}
                </div>
            </div>
        </div>
    `).join('');
}

// ===== DRIVER ACTIONS =====
async function goOnline() {
    try {
        const response = await API.request('/drivers/status', {
            method: 'PUT',
            body: JSON.stringify({ status: 'online' })
        });
        
        updateStatusDisplay('online');
        showNotification('You are now online and visible to customers', 'success');
        
        // Start location sharing
        startLocationSharing();
        
        // Load available deliveries
        await loadAvailableDeliveries();
        
        return response;
        
    } catch (error) {
        showNotification('Failed to go online: ' + error.message, 'error');
        throw error;
    }
}

async function goOffline() {
    try {
        const response = await API.request('/drivers/status', {
            method: 'PUT',
            body: JSON.stringify({ status: 'offline' })
        });
        
        updateStatusDisplay('offline');
        showNotification('You are now offline', 'info');
        
        // Stop location sharing
        stopLocationSharing();
        
        return response;
        
    } catch (error) {
        showNotification('Failed to go offline: ' + error.message, 'error');
        throw error;
    }
}

async function goBusy() {
    try {
        const response = await API.request('/drivers/status', {
            method: 'PUT',
            body: JSON.stringify({ status: 'busy' })
        });
        
        updateStatusDisplay('busy');
        showNotification('Status set to "On Break"', 'info');
        
        return response;
        
    } catch (error) {
        showNotification('Failed to update status: ' + error.message, 'error');
        throw error;
    }
}

function startLocationSharing() {
    if (!navigator.geolocation) {
        showNotification('Geolocation not supported by your browser', 'error');
        return;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };
    
    AppState.locationWatcher = navigator.geolocation.watchPosition(
        position => updateDriverLocation(position.coords),
        error => handleLocationError(error),
        options
    );
    
    console.log('📍 Location sharing started');
}

function stopLocationSharing() {
    if (AppState.locationWatcher) {
        navigator.geolocation.clearWatch(AppState.locationWatcher);
        AppState.locationWatcher = null;
    }
    
    console.log('📍 Location sharing stopped');
}

async function updateDriverLocation(coords) {
    const location = {
        lat: coords.latitude,
        lng: coords.longitude,
        speed: coords.speed || 0,
        heading: coords.heading,
        timestamp: new Date().toISOString()
    };
    
    // Update map marker
    if (driverMarker) {
        driverMarker.setLatLng([location.lat, location.lng]);
    }
    
    // Send to server via WebSocket
    if (AppState.socket) {
        AppState.socket.emit('location_update', location);
    }
    
    // Also update via API
    try {
        await API.request('/drivers/location', {
            method: 'PUT',
            body: JSON.stringify(location)
        });
    } catch (error) {
        console.error('Failed to update location via API:', error);
    }
}

function handleLocationError(error) {
    let message = 'Unable to get your location';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable in browser settings.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable. Check your GPS signal.';
            break;
        case error.TIMEOUT:
            message = 'Location request timeout.';
            break;
    }
    
    showNotification('GPS Error: ' + message, 'error');
    stopLocationSharing();
}

async function acceptDelivery(deliveryId) {
    try {
        const response = await API.request(`/trips/${deliveryId}/accept`, {
            method: 'PUT'
        });
        
        showNotification('Delivery accepted!', 'success');
        
        // Show delivery details
        showCurrentDelivery(response.trip);
        
        // Update status to busy
        await goBusy();
        
        // Reload available deliveries
        await loadAvailableDeliveries();
        
        return response;
        
    } catch (error) {
        showNotification('Failed to accept delivery: ' + error.message, 'error');
        throw error;
    }
}

function showCurrentDelivery(trip) {
    currentDelivery = trip;
    
    const tripContainer = document.getElementById('currentTrip');
    const stepsContainer = document.getElementById('deliverySteps');
    
    if (!tripContainer || !stepsContainer) return;
    
    // Show current trip
    tripContainer.innerHTML = `
        <div class="current-trip-card">
            <h3>Current Delivery</h3>
            <div class="trip-details">
                <p><strong>Trip ID:</strong> ${trip.tripId || trip._id.substring(0, 8)}</p>
                <p><strong>Pickup:</strong> ${trip.pickup.address}</p>
                <p><strong>Delivery:</strong> ${trip.destinations[0]?.address || 'Multiple stops'}</p>
                <p><strong>Distance:</strong> ${trip.distance ? trip.distance.toFixed(1) + 'km' : 'Calculating...'}</p>
                <p><strong>Fare:</strong> R${trip.fare?.total?.toFixed(2)}</p>
                <p><strong>Customer:</strong> ${trip.customer?.name || 'Customer'} (${trip.customer?.phone || 'No phone'})</p>
                ${trip.pickup.instructions ? `<p><strong>Instructions:</strong> ${trip.pickup.instructions}</p>` : ''}
            </div>
            <div class="trip-actions">
                ${trip.status === 'accepted' ? `
                    <button class="btn btn-primary" onclick="startDelivery('${trip._id}')">
                        <i class="fas fa-play"></i> Start Trip
                    </button>
                ` : ''}
                ${trip.status === 'in_progress' ? `
                    <button class="btn btn-success" onclick="showDeliveryProofModal('${trip._id}')">
                        <i class="fas fa-check"></i> Complete Delivery
                    </button>
                ` : ''}
                <button class="btn btn-secondary" onclick="cancelDelivery('${trip._id}')">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;
    
    tripContainer.style.display = 'block';
    
    // Show delivery steps
    document.getElementById('pickupAddress').textContent = trip.pickup.address.substring(0, 30) + '...';
    document.getElementById('deliveryAddress').textContent = trip.destinations[0]?.address?.substring(0, 30) + '...' || 'Delivery address';
    stepsContainer.style.display = 'block';
    
    // Add markers to map
    addDeliveryMarkers(trip);
}

function addDeliveryMarkers(trip) {
    if (!driverMap) return;
    
    // Clear existing markers except driver
    driverMap.eachLayer(layer => {
        if (layer !== driverMarker && layer instanceof L.Marker) {
            driverMap.removeLayer(layer);
        }
    });
    
    // Add pickup marker
    if (trip.pickup.coordinates) {
        L.marker([trip.pickup.coordinates.lat, trip.pickup.coordinates.lng], {
            icon: L.divIcon({
                html: '<div style="background: #4CAF50; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid white; box-shadow: 0 0 10px rgba(76, 175, 80, 0.7);"><i class="fas fa-arrow-up"></i></div>',
                iconSize: [30, 30]
            })
        }).addTo(driverMap)
          .bindPopup(`<b>Pickup</b><br>${trip.pickup.address}`);
    }
    
    // Add delivery markers
    trip.destinations?.forEach((dest, index) => {
        if (dest.coordinates) {
            L.marker([dest.coordinates.lat, dest.coordinates.lng], {
                icon: L.divIcon({
                    html: `<div style="background: #2196F3; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid white; box-shadow: 0 0 10px rgba(33, 150, 243, 0.7);">${index + 1}</div>`,
                    iconSize: [30, 30]
                })
            }).addTo(driverMap)
              .bindPopup(`<b>Delivery ${index + 1}</b><br>${dest.address}`);
        }
    });
    
    // Fit map to show all markers
    const bounds = driverMap.getBounds();
    if (trip.pickup.coordinates) {
        bounds.extend([trip.pickup.coordinates.lat, trip.pickup.coordinates.lng]);
    }
    trip.destinations?.forEach(dest => {
        if (dest.coordinates) {
            bounds.extend([dest.coordinates.lat, dest.coordinates.lng]);
        }
    });
    
    if (bounds.isValid()) {
        driverMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

async function startDelivery(deliveryId) {
    try {
        const response = await API.request(`/trips/${deliveryId}/start`, {
            method: 'PUT'
        });
        
        showNotification('Delivery started!', 'success');
        
        // Update current delivery display
        if (currentDelivery && currentDelivery._id === deliveryId) {
            currentDelivery.status = 'in_progress';
            showCurrentDelivery(currentDelivery);
        }
        
        return response;
        
    } catch (error) {
        showNotification('Failed to start delivery: ' + error.message, 'error');
        throw error;
    }
}

function showDeliveryProofModal(deliveryId) {
    document.getElementById('proofTripId').value = deliveryId;
    showModal('deliveryProofModal');
}

async function submitDeliveryProof(event) {
    event.preventDefault();
    
    const tripId = document.getElementById('proofTripId').value;
    const recipientName = document.getElementById('recipientName').value;
    const deliveryNotes = document.getElementById('deliveryNotes').value;
    const signatureData = getSignatureData();
    
    // Get photo data
    const photoInput = document.getElementById('proofPhoto');
    let photoData = null;
    
    if (photoInput.files.length > 0) {
        const file = photoInput.files[0];
        photoData = await convertFileToBase64(file);
    }
    
    try {
        const response = await API.request(`/trips/${tripId}/complete`, {
            method: 'PUT',
            body: JSON.stringify({
                recipientName,
                deliveryNotes,
                signature: signatureData,
                proofImage: photoData
            })
        });
        
        showNotification('Delivery completed successfully!', 'success');
        hideModal('deliveryProofModal');
        
        // Clear current delivery
        currentDelivery = null;
        document.getElementById('currentTrip').style.display = 'none';
        document.getElementById('deliverySteps').style.display = 'none';
        
        // Update earnings
        await loadDriverProfile();
        
        // Reload recent trips
        await loadRecentTrips();
        
        // Go back online
        await goOnline();
        
        return response;
        
    } catch (error) {
        showNotification('Failed to complete delivery: ' + error.message, 'error');
        throw error;
    }
}

async function cancelDelivery(deliveryId) {
    if (!confirm('Are you sure you want to cancel this delivery?')) {
        return;
    }
    
    try {
        const response = await API.request(`/trips/${deliveryId}/cancel`, {
            method: 'PUT'
        });
        
        showNotification('Delivery cancelled', 'info');
        
        // Clear current delivery
        currentDelivery = null;
        document.getElementById('currentTrip').style.display = 'none';
        document.getElementById('deliverySteps').style.display = 'none';
        
        // Go back online
        await goOnline();
        
        return response;
        
    } catch (error) {
        showNotification('Failed to cancel delivery: ' + error.message, 'error');
        throw error;
    }
}

// ===== NAVIGATION FUNCTIONS =====
function navigateToPickup() {
    if (!currentDelivery || !currentDelivery.pickup.coordinates) {
        showNotification('Pickup location not available', 'error');
        return;
    }
    
    const { lat, lng } = currentDelivery.pickup.coordinates;
    openNavigationApp(lat, lng, currentDelivery.pickup.address);
}

function navigateToDelivery() {
    if (!currentDelivery || !currentDelivery.destinations?.[0]?.coordinates) {
        showNotification('Delivery location not available', 'error');
        return;
    }
    
    const { lat, lng } = currentDelivery.destinations[0].coordinates;
    openNavigationApp(lat, lng, currentDelivery.destinations[0].address);
}

function openNavigationApp(lat, lng, address) {
    // Open in Google Maps
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
    
    showNotification(`Opening navigation to ${address.substring(0, 30)}...`, 'info');
}

function confirmPickup() {
    if (!currentDelivery) {
        showNotification('No active delivery', 'error');
        return;
    }
    
    showNotification('Pickup confirmed! Now navigate to delivery location', 'success');
    
    // Update step UI
    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.remove('active');
        if (index === 2) { // Delivery step
            step.classList.add('active');
        }
    });
}

function completeDelivery() {
    if (!currentDelivery) {
        showNotification('No active delivery', 'error');
        return;
    }
    
    showDeliveryProofModal(currentDelivery._id);
}

// ===== UTILITY FUNCTIONS =====
function centerOnMe() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                if (driverMap) {
                    driverMap.setView([position.coords.latitude, position.coords.longitude], 14);
                }
            },
            error => showNotification('Unable to get your location', 'error')
        );
    }
}

function toggleTraffic() {
    showNotification('Traffic layer coming soon', 'info');
}

function toggleLocationSharing() {
    if (AppState.locationWatcher) {
        stopLocationSharing();
        showNotification('Location sharing stopped', 'info');
    } else {
        startLocationSharing();
        showNotification('Location sharing started', 'success');
    }
}

async function cashOut() {
    try {
        const response = await API.request('/drivers/cashout', {
            method: 'POST'
        });
        
        showNotification(`R ${response.amount.toFixed(2)} cashed out successfully!`, 'success');
        
        // Update earnings display
        await loadDriverProfile();
        
        return response;
        
    } catch (error) {
        showNotification('Cash out failed: ' + error.message, 'error');
        throw error;
    }
}

function showEarningsDetails() {
    // Load earnings history
    loadEarningsHistory();
    showModal('earningsModal');
}

async function loadEarningsHistory() {
    try {
        const history = await API.request('/drivers/earnings/history');
        renderEarningsHistory(history);
    } catch (error) {
        console.error('Failed to load earnings history:', error);
        document.getElementById('earningsHistory').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load earnings history</p>
            </div>
        `;
    }
}

function renderEarningsHistory(history) {
    const container = document.getElementById('earningsHistory');
    if (!container) return;
    
    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-money-bill-wave"></i>
                <p>No earnings history</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = history.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--gray-light);">
            <div>
                <strong>${new Date(item.date).toLocaleDateString()}</strong>
                <div style="font-size: 0.9rem; color: var(--gray);">
                    ${item.trips || 0} trips • ${item.distance || 0}km
                </div>
            </div>
            <div style="text-align: right;">
                <strong style="color: var(--primary);">R ${item.amount.toFixed(2)}</strong>
                <div style="font-size: 0.8rem; color: var(--gray);">
                    ${item.status || 'completed'}
                </div>
            </div>
        </div>
    `).join('');
}

function openChatWithSupport() {
    showModal('supportChatModal');
    
    // Load support chat messages
    loadSupportChat();
}

function loadSupportChat() {
    const container = document.getElementById('supportChatMessages');
    if (!container) return;
    
    // For now, show a welcome message
    container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--gray);">
            <i class="fas fa-headset" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <p>SwiftRide Support</p>
            <small>We're here to help you 24/7</small>
        </div>
    `;
}

function sendSupportMessage() {
    const input = document.getElementById('supportMessageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    const container = document.getElementById('supportChatMessages');
    if (container) {
        // Add user message
        const userMsg = document.createElement('div');
        userMsg.style.cssText = `
            background: var(--primary);
            color: white;
            padding: 0.8rem 1rem;
            border-radius: var(--radius-md);
            margin-bottom: 0.5rem;
            max-width: 80%;
            margin-left: auto;
        `;
        userMsg.textContent = message;
        container.appendChild(userMsg);
        
        // Clear input
        input.value = '';
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
        // Simulate support response after delay
        setTimeout(() => {
            const supportMsg = document.createElement('div');
            supportMsg.style.cssText = `
                background: var(--gray-light);
                color: var(--dark);
                padding: 0.8rem 1rem;
                border-radius: var(--radius-md);
                margin-bottom: 0.5rem;
                max-width: 80%;
            `;
            supportMsg.textContent = 'Thank you for your message. Our support team will respond shortly.';
            container.appendChild(supportMsg);
            
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
        }, 1000);
    }
}

function takePhoto() {
    document.getElementById('proofPhoto').click();
}

function previewPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('proofPhotoPreview');
        preview.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
        return new Date(dateString).toLocaleDateString();
    }
}

async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

// ===== EVENT LISTENERS =====
function setupDriverEventListeners() {
    // Handle back button
    window.addEventListener('popstate', () => {
        // Reload data when navigating back
        loadInitialData();
    });
    
    // Handle online/offline status
    window.addEventListener('online', async () => {
        showNotification('You are back online', 'success');
        await loadInitialData();
    });
    
    window.addEventListener('offline', () => {
        showNotification('You are offline. Some features may be limited.', 'warning');
    });
    
    // Handle beforeunload
    window.addEventListener('beforeunload', () => {
        if (AppState.locationWatcher) {
            stopLocationSharing();
        }
    });
    
    // WebSocket message handlers
    if (AppState.socket) {
        AppState.socket.on('new_delivery', (delivery) => {
            showNotification(`New delivery available! ${delivery.pickup.address.substring(0, 30)}...`, 'info');
            
            // Reload available deliveries
            loadAvailableDeliveries();
        });
        
        AppState.socket.on('delivery_cancelled', (data) => {
            if (currentDelivery && currentDelivery._id === data.tripId) {
                showNotification('Delivery was cancelled by customer', 'warning');
                currentDelivery = null;
                document.getElementById('currentTrip').style.display = 'none';
                document.getElementById('deliverySteps').style.display = 'none';
                goOnline();
            }
        });
        
        AppState.socket.on('chat_message', (data) => {
            if (data.from !== 'support') return;
            
            showNotification(`Support: ${data.message.substring(0, 50)}...`, 'info');
            
            // If support chat is open, add message
            const chatModal = document.getElementById('supportChatModal');
            if (chatModal && chatModal.classList.contains('active')) {
                const container = document.getElementById('supportChatMessages');
                if (container) {
                    const supportMsg = document.createElement('div');
                    supportMsg.style.cssText = `
                        background: var(--gray-light);
                        color: var(--dark);
                        padding: 0.8rem 1rem;
                        border-radius: var(--radius-md);
                        margin-bottom: 0.5rem;
                        max-width: 80%;
                    `;
                    supportMsg.textContent = data.message;
                    container.appendChild(supportMsg);
                    container.scrollTop = container.scrollHeight;
                }
            }
        });
    }
}

// ===== EXPORT FUNCTIONS =====
window.initializeDriverDashboard = initializeDriverDashboard;
window.goOnline = goOnline;
window.goOffline = goOffline;
window.goBusy = goBusy;
window.acceptDelivery = acceptDelivery;
window.startDelivery = startDelivery;
window.showDeliveryProofModal = showDeliveryProofModal;
window.submitDeliveryProof = submitDeliveryProof;
window.cancelDelivery = cancelDelivery;
window.navigateToPickup = navigateToPickup;
window.navigateToDelivery = navigateToDelivery;
window.confirmPickup = confirmPickup;
window.completeDelivery = completeDelivery;
window.centerOnMe = centerOnMe;
window.toggleTraffic = toggleTraffic;
window.toggleLocationSharing = toggleLocationSharing;
window.cashOut = cashOut;
window.showEarningsDetails = showEarningsDetails;
window.openChatWithSupport = openChatWithSupport;
window.sendSupportMessage = sendSupportMessage;
window.takePhoto = takePhoto;
window.previewPhoto = previewPhoto;

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDriverDashboard);
} else {
    initializeDriverDashboard();
}