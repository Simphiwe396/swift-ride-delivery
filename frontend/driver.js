// ===== DRIVER PAGE SPECIFIC FUNCTIONS =====

// Global driver functions
window.goOnline = function() {
    if (AppState.user) {
        AppState.user.status = 'online';
        updateDriverUI();
        showNotification('You are now online', 'success');
        
        if (AppState.socket) {
            AppState.socket.emit('driver:status', {
                name: AppState.user.name,
                status: 'online'
            });
        }
        
        // Update marker color
        if (AppState.mapManager) {
            const marker = AppState.mapManager.markers.get('driver_location');
            if (marker) {
                marker.setIcon(AppState.mapManager.getDriverIcon('online'));
            }
        }
    }
};

window.goOffline = function() {
    if (AppState.user) {
        AppState.user.status = 'offline';
        updateDriverUI();
        showNotification('You are now offline', 'info');
        
        if (AppState.socket) {
            AppState.socket.emit('driver:status', {
                name: AppState.user.name,
                status: 'offline'
            });
        }
        
        // Update marker color
        if (AppState.mapManager) {
            const marker = AppState.mapManager.markers.get('driver_location');
            if (marker) {
                marker.setIcon(AppState.mapManager.getDriverIcon('offline'));
            }
        }
    }
};

window.goBusy = function() {
    if (AppState.user) {
        AppState.user.status = 'busy';
        updateDriverUI();
        showNotification('You are now on break', 'warning');
        
        if (AppState.socket) {
            AppState.socket.emit('driver:status', {
                name: AppState.user.name,
                status: 'busy'
            });
        }
        
        // Update marker color
        if (AppState.mapManager) {
            const marker = AppState.mapManager.markers.get('driver_location');
            if (marker) {
                marker.setIcon(AppState.mapManager.getDriverIcon('busy'));
            }
        }
    }
};

window.centerOnMe = function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            if (AppState.mapManager) {
                AppState.mapManager.centerMap([latitude, longitude]);
                showNotification('Centered on your location', 'info');
            }
        });
    }
};

window.toggleTraffic = function() {
    showNotification('Traffic view toggled', 'info');
    // Implement traffic layer toggle here
};

window.openNavigation = function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            // Open Google Maps
            window.open(`https://www.google.com/maps/@${latitude},${longitude},15z`, '_blank');
        });
    }
};

window.toggleLocationSharing = function() {
    const isSharing = AppState.user?.locationSharing || false;
    AppState.user.locationSharing = !isSharing;
    
    showNotification(
        isSharing ? 'Location sharing stopped' : 'Location sharing started',
        isSharing ? 'info' : 'success'
    );
};

window.openChatWithSupport = function() {
    showModal('supportChatModal');
};

window.cashOut = function() {
    showNotification('Cash out request submitted', 'success');
};

window.showEarningsDetails = function() {
    showModal('earningsModal');
};

window.acceptDelivery = function(deliveryId) {
    showNotification(`Delivery ${deliveryId} accepted!`, 'success');
    
    // Set current trip
    AppState.currentTrip = {
        id: deliveryId,
        pickup: '123 Main St, Johannesburg',
        delivery: '456 Oak Ave, Sandton',
        distance: 8.5,
        fare: 120.00,
        status: 'accepted'
    };
    
    // Show current trip section
    const currentTrip = document.getElementById('currentTrip');
    const deliverySteps = document.getElementById('deliverySteps');
    
    if (currentTrip) {
        currentTrip.style.display = 'block';
        currentTrip.innerHTML = `
            <h3>Current Delivery</h3>
            <p><strong>Pickup:</strong> ${AppState.currentTrip.pickup}</p>
            <p><strong>Delivery:</strong> ${AppState.currentTrip.delivery}</p>
            <p><strong>Distance:</strong> ${AppState.currentTrip.distance} km</p>
            <p><strong>Fare:</strong> R ${AppState.currentTrip.fare.toFixed(2)}</p>
            <p><strong>Status:</strong> Accepted</p>
            <button class="btn btn-primary" onclick="startTrip()" style="margin-top: 10px;">
                <i class="fas fa-play"></i> Start Trip
            </button>
        `;
    }
    
    if (deliverySteps) {
        deliverySteps.style.display = 'block';
    }
};

window.startTrip = function() {
    if (AppState.currentTrip) {
        AppState.currentTrip.status = 'in_progress';
        showNotification('Trip started! Navigate to pickup location.', 'success');
        
        const currentTrip = document.getElementById('currentTrip');
        if (currentTrip) {
            currentTrip.querySelector('p:last-child').innerHTML = 
                '<strong>Status:</strong> In Progress';
        }
    }
};

window.navigateToPickup = function() {
    if (AppState.currentTrip) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const { latitude, longitude } = position.coords;
                // Open in Google Maps
                window.open(`https://www.google.com/maps/dir/${latitude},${longitude}/-26.195246,28.034088`, '_blank');
            });
        }
    }
};

window.confirmPickup = function() {
    if (AppState.currentTrip) {
        AppState.currentTrip.status = 'picked_up';
        showNotification('Pickup confirmed! Proceed to delivery.', 'success');
        
        // Update step 2 to active
        const step2 = document.querySelector('.step:nth-child(2)');
        if (step2) step2.classList.add('active');
    }
};

window.navigateToDelivery = function() {
    if (AppState.currentTrip) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const { latitude, longitude } = position.coords;
                // Open in Google Maps
                window.open(`https://www.google.com/maps/dir/${latitude},${longitude}/-26.2041,28.0473`, '_blank');
            });
        }
    }
};

window.completeDelivery = function() {
    if (AppState.currentTrip) {
        showModal('deliveryProofModal');
    }
};

window.submitDeliveryProof = function(event) {
    event.preventDefault();
    
    showNotification('Delivery completed successfully!', 'success');
    hideModal('deliveryProofModal');
    
    // Update earnings
    if (AppState.user && AppState.currentTrip) {
        AppState.user.todayEarnings = (AppState.user.todayEarnings || 0) + AppState.currentTrip.fare;
        AppState.user.todayTrips = (AppState.user.todayTrips || 0) + 1;
        AppState.user.completedTrips = (AppState.user.completedTrips || 0) + 1;
        AppState.user.totalDistance = (AppState.user.totalDistance || 0) + AppState.currentTrip.distance;
        
        updateDriverUI();
    }
    
    // Reset trip display
    const currentTrip = document.getElementById('currentTrip');
    const deliverySteps = document.getElementById('deliverySteps');
    
    if (currentTrip) currentTrip.style.display = 'none';
    if (deliverySteps) deliverySteps.style.display = 'none';
    
    AppState.currentTrip = null;
    
    // Reload available deliveries
    loadAvailableDeliveries();
};

window.clearSignature = function() {
    const canvas = document.getElementById('signatureCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
};

window.takePhoto = function() {
    document.getElementById('proofPhoto').click();
};

window.previewPhoto = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('proofPhotoPreview');
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
};

// Main driver page initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Driver page loading...');
    
    // Wait for app.js to initialize
    setTimeout(async () => {
        // Check if we have a driver logged in
        if (!AppState.user || AppState.user.userType !== 'driver') {
            console.log('Not logged in as driver, redirecting...');
            showNotification('Please login as driver first', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        // Initialize driver page
        initDriverPage();
    }, 500);
});

function initDriverPage() {
    console.log('Initializing driver page for:', AppState.user?.name);
    
    // Update UI with driver info
    updateDriverUI();
    
    // Initialize map
    initDriverMap();
    
    // Load driver data
    loadDriverData();
    
    // Setup signature canvas
    setupSignatureCanvas();
}

function updateDriverUI() {
    const driver = AppState.user;
    if (!driver) return;
    
    // Update display elements
    const driverName = document.getElementById('driverName');
    const driverAvatar = document.getElementById('driverAvatar');
    const statusDot = document.getElementById('statusDot');
    const driverStatus = document.getElementById('driverStatus');
    
    if (driverName) driverName.textContent = driver.name;
    if (driverAvatar) driverAvatar.textContent = driver.name.charAt(0);
    if (statusDot) {
        statusDot.className = `status-dot status-${driver.status || 'offline'}`;
    }
    if (driverStatus) driverStatus.textContent = driver.status || 'Offline';
    
    // Update earnings
    const todayEarnings = document.getElementById('todayEarnings');
    const todayTrips = document.getElementById('todayTrips');
    const completedTrips = document.getElementById('completedTrips');
    const totalDistance = document.getElementById('totalDistance');
    
    if (todayEarnings) todayEarnings.textContent = `R ${(driver.todayEarnings || 0).toFixed(2)}`;
    if (todayTrips) todayTrips.textContent = driver.todayTrips || 0;
    if (completedTrips) completedTrips.textContent = driver.completedTrips || 0;
    if (totalDistance) totalDistance.textContent = `${(driver.totalDistance || 0).toFixed(1)} km`;
    
    // Calculate hourly rate (mock data)
    const hourlyRate = document.getElementById('hourlyRate');
    const avgTripEarnings = document.getElementById('avgTripEarnings');
    
    if (hourlyRate) hourlyRate.textContent = `R ${((driver.todayEarnings || 0) / 8).toFixed(2)}`;
    if (avgTripEarnings) {
        const avg = driver.todayTrips > 0 ? (driver.todayEarnings || 0) / driver.todayTrips : 0;
        avgTripEarnings.textContent = `R ${avg.toFixed(2)}`;
    }
}

function initDriverMap() {
    const mapElement = document.getElementById('driverMap');
    if (!mapElement) return;
    
    // Use the MapManager from app.js
    if (AppState.mapManager) {
        AppState.mapManager.destroy(); // Clean up old map
    }
    
    AppState.mapManager = new MapManager('driverMap', {
        center: APP_CONFIG.MAP_CONFIG.defaultCenter,
        zoom: 14,
        scrollWheelZoom: true
    });
    
    const map = AppState.mapManager.initialize();
    
    if (map) {
        // Add driver's location marker
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const { latitude, longitude } = position.coords;
                
                // Update driver location in state
                AppState.user.currentLocation = { lat: latitude, lng: longitude };
                
                AppState.mapManager.addMarker('driver_location', [latitude, longitude], {
                    icon: AppState.mapManager.getDriverIcon(AppState.user.status || 'online'),
                    popup: `<strong>${AppState.user?.name || 'Driver'}</strong><br>
                           Status: ${AppState.user.status || 'online'}<br>
                           Vehicle: ${AppState.user.vehicle?.model || 'N/A'}`
                });
                
                AppState.mapManager.centerMap([latitude, longitude]);
                
                // Send location to server via socket
                if (AppState.socket && AppState.socket.connected) {
                    AppState.socket.emit('driver:location', {
                        name: AppState.user.name,
                        lat: latitude,
                        lng: longitude
                    });
                }
            }, (error) => {
                console.error('Geolocation error:', error);
                // Use default location
                AppState.mapManager.addMarker('driver_location', APP_CONFIG.MAP_CONFIG.defaultCenter, {
                    icon: AppState.mapManager.getDriverIcon(AppState.user.status || 'online'),
                    popup: `<strong>${AppState.user?.name || 'Driver'}</strong>`
                });
            });
        } else {
            // Geolocation not available
            AppState.mapManager.addMarker('driver_location', APP_CONFIG.MAP_CONFIG.defaultCenter, {
                icon: AppState.mapManager.getDriverIcon(AppState.user.status || 'online'),
                popup: `<strong>${AppState.user?.name || 'Driver'}</strong>`
            });
        }
    }
}

async function loadDriverData() {
    if (!AppState.user) return;
    
    try {
        // Update earnings display
        updateDriverUI();
        
        // Load available deliveries
        loadAvailableDeliveries();
        
        // Load recent trips
        loadRecentTrips();
        
    } catch (error) {
        console.error('Failed to load driver data:', error);
    }
}

function loadAvailableDeliveries() {
    const container = document.getElementById('availableDeliveriesList');
    if (!container) return;
    
    // Mock data - replace with API call
    const mockDeliveries = [
        {
            id: 'del1',
            pickup: '123 Main St, Johannesburg',
            destination: '456 Oak Ave, Sandton',
            distance: '8.5 km',
            price: 'R 120.00',
            time: '25 min'
        },
        {
            id: 'del2',
            pickup: '789 Market St, Pretoria',
            destination: '321 Pine Rd, Centurion',
            distance: '12.3 km',
            price: 'R 180.00',
            time: '35 min'
        },
        {
            id: 'del3',
            pickup: '555 Union Ave, Midrand',
            destination: '777 Crescent Rd, Fourways',
            distance: '15.7 km',
            price: 'R 220.00',
            time: '45 min'
        }
    ];
    
    if (mockDeliveries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box"></i>
                <p>No deliveries available</p>
                <small>Stay online to receive deliveries</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = mockDeliveries.map(delivery => `
        <div class="delivery-card" onclick="acceptDelivery('${delivery.id}')">
            <div class="delivery-header">
                <span class="delivery-badge" style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">New</span>
                <span class="delivery-price" style="font-size: 1.2rem; font-weight: 700; color: #6C63FF;">${delivery.price}</span>
            </div>
            <div class="delivery-details" style="margin-top: 10px;">
                <p style="margin: 5px 0; display: flex; align-items: center; gap: 8px; color: #666;">
                    <i class="fas fa-map-marker-alt" style="color: #6C63FF;"></i> ${delivery.pickup}
                </p>
                <p style="margin: 5px 0; display: flex; align-items: center; gap: 8px; color: #666;">
                    <i class="fas fa-flag-checkered" style="color: #6C63FF;"></i> ${delivery.destination}
                </p>
                <p style="margin: 5px 0; display: flex; align-items: center; gap: 8px; color: #666;">
                    <i class="fas fa-route" style="color: #6C63FF;"></i> ${delivery.distance} • ${delivery.time}
                </p>
            </div>
            <button class="btn btn-primary" style="width: 100%; margin-top: 10px; background: #6C63FF; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">
                <i class="fas fa-check"></i> Accept Delivery
            </button>
        </div>
    `).join('');
}

function loadRecentTrips() {
    const container = document.getElementById('recentTrips');
    if (!container) return;
    
    // Mock data
    const mockTrips = [
        {
            id: 'trip1',
            date: 'Today, 10:30 AM',
            route: 'Main St → Oak Ave',
            fare: 'R 95.00',
            status: 'completed'
        },
        {
            id: 'trip2',
            date: 'Today, 09:15 AM',
            route: 'Market St → Pine Rd',
            fare: 'R 75.50',
            status: 'completed'
        },
        {
            id: 'trip3',
            date: 'Yesterday, 04:45 PM',
            route: 'Union Ave → Crescent Rd',
            fare: 'R 110.00',
            status: 'completed'
        }
    ];
    
    if (mockTrips.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No recent trips</p>';
        return;
    }
    
    container.innerHTML = mockTrips.map(trip => `
        <div class="trip-item" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #E8EAF2;">
            <div>
                <strong>${trip.route}</strong><br>
                <small style="color: #666;">${trip.date}</small>
            </div>
            <div style="text-align: right;">
                <strong>${trip.fare}</strong><br>
                <span class="status-badge" style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">
                    ${trip.status}
                </span>
            </div>
        </div>
    `).join('');
}

function setupSignatureCanvas() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    
    // Set canvas background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    canvas.addEventListener('mousedown', (e) => {
        drawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!drawing) return;
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });
    
    canvas.addEventListener('mouseup', () => drawing = false);
    canvas.addEventListener('mouseout', () => drawing = false);
    
    // Touch support for mobile
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        drawing = true;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        [lastX, lastY] = [touch.clientX - rect.left, touch.clientY - rect.top];
    });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!drawing) return;
        
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        [lastX, lastY] = [x, y];
    });
    
    canvas.addEventListener('touchend', () => drawing = false);
}

// Export functions to global scope
window.initDriverPage = initDriverPage;

// Setup socket listeners for driver
if (socketManager) {
    socketManager.on('delivery:request', (deliveryData) => {
        if (AppState.user?.status === 'online') {
            showNotification(`New delivery request: R${deliveryData.fare?.total || '0.00'}`, 'info');
            loadAvailableDeliveries(); // Refresh deliveries list
        }
    });
    
    socketManager.on('chat:message', (message) => {
        if (message.receiverId === AppState.user?._id) {
            showNotification(`New message from ${message.senderName}`, 'info');
        }
    });
}