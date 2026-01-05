// Driver Dashboard JavaScript
console.log('Driver Dashboard Loading...');

// Check if user is driver
(function() {
    const user = localStorage.getItem('swiftride_user');
    if (!user) {
        alert('Please login as driver first');
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const userData = JSON.parse(user);
        if (userData.userType !== 'driver') {
            alert('Driver access required');
            window.location.href = 'index.html';
            return;
        }
    } catch (e) {
        alert('Invalid session');
        window.location.href = 'index.html';
        return;
    }
})();

// Initialize Driver Dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Driver Dashboard...');
    
    // Load driver info
    const user = JSON.parse(localStorage.getItem('swiftride_user') || '{}');
    if (user.name) {
        // Update driver name
        const driverNameElements = document.querySelectorAll('#driverName, .driver-name');
        driverNameElements.forEach(el => {
            if (el.id === 'driverName' || el.classList.contains('driver-name')) {
                el.textContent = user.name;
            }
        });
        
        // Update avatar
        const avatarElements = document.querySelectorAll('.driver-avatar, #driverAvatar');
        avatarElements.forEach(el => {
            el.textContent = user.name.charAt(0);
        });
        
        // Update earnings
        const todayEarnings = document.getElementById('todayEarnings');
        const todayTrips = document.getElementById('todayTrips');
        const completedTrips = document.getElementById('completedTrips');
        const totalDistance = document.getElementById('totalDistance');
        
        if (todayEarnings) todayEarnings.textContent = `R ${(user.todayEarnings || 0).toFixed(2)}`;
        if (todayTrips) todayTrips.textContent = user.todayTrips || 0;
        if (completedTrips) completedTrips.textContent = user.completedTrips || 0;
        if (totalDistance) totalDistance.textContent = `${(user.totalDistance || 0).toFixed(1)} km`;
    }
    
    // Initialize map
    setTimeout(() => {
        initDriverMap();
        loadAvailableDeliveries();
        loadRecentTrips();
        setupDriverEventListeners();
    }, 500);
    
    // Hide loading screen
    setTimeout(() => {
        const loading = document.getElementById('loadingScreen');
        if (loading) loading.style.display = 'none';
    }, 1000);
});

// Initialize Driver Map
function initDriverMap() {
    try {
        const mapElement = document.getElementById('driverMap');
        if (!mapElement) return;
        
        // Clear existing map
        if (window.currentMap) {
            window.currentMap.remove();
        }
        
        // Create new map
        window.currentMap = new MapManager('driverMap', {
            center: window.CONFIG.MAP_CENTER,
            zoom: 14,
            scrollWheelZoom: true
        }).initialize();
        
        if (window.currentMap) {
            // Try to get current location
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        
                        // Add driver marker
                        window.currentMap.addMarker('driver_location', [latitude, longitude], {
                            popup: `
                                <div style="padding: 10px; min-width: 200px;">
                                    <h4 style="margin: 0 0 5px 0; color: #333;">Your Location</h4>
                                    <p style="margin: 0; color: #666;">Lat: ${latitude.toFixed(6)}</p>
                                    <p style="margin: 0; color: #666;">Lng: ${longitude.toFixed(6)}</p>
                                </div>
                            `
                        });
                        
                        // Center map on driver
                        window.currentMap.centerOn([latitude, longitude], 14);
                        
                        // Send location to server via socket
                        if (window.socket && window.socket.connected) {
                            const user = JSON.parse(localStorage.getItem('swiftride_user') || '{}');
                            window.socket.emit('driver:location', {
                                name: user.name,
                                lat: latitude,
                                lng: longitude
                            });
                        }
                    },
                    (error) => {
                        console.log('Geolocation error:', error);
                        // Use default location
                        addDefaultMarker();
                    }
                );
            } else {
                addDefaultMarker();
            }
            
            function addDefaultMarker() {
                window.currentMap.addMarker('driver_location', window.CONFIG.MAP_CENTER, {
                    popup: '<h4 style="margin: 0; color: #333;">Driver Location</h4>'
                });
            }
            
            console.log('Driver map initialized');
        }
    } catch (error) {
        console.error('Failed to initialize driver map:', error);
    }
}

// Load Available Deliveries
function loadAvailableDeliveries() {
    const container = document.getElementById('availableDeliveriesList');
    if (!container) return;
    
    const deliveries = [
        {
            id: 'del1',
            pickup: '123 Main St, Johannesburg',
            destination: '456 Oak Ave, Sandton',
            distance: '8.5 km',
            price: 'R 120.00',
            time: '25 min',
            package: 'Small Package'
        },
        {
            id: 'del2',
            pickup: '789 Market St, Pretoria',
            destination: '321 Pine Rd, Centurion',
            distance: '12.3 km',
            price: 'R 180.00',
            time: '35 min',
            package: 'Documents'
        },
        {
            id: 'del3',
            pickup: '555 Union Ave, Midrand',
            destination: '777 Crescent Rd, Fourways',
            distance: '15.7 km',
            price: 'R 220.00',
            time: '45 min',
            package: 'Medium Package'
        }
    ];
    
    if (deliveries.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No deliveries available</p>
                <small>Stay online to receive deliveries</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = deliveries.map(delivery => `
        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="background: #4CAF50; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 500;">
                    New Delivery
                </span>
                <span style="font-size: 1.3rem; font-weight: 700; color: #6C63FF;">
                    ${delivery.price}
                </span>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                    <i class="fas fa-map-marker-alt" style="color: #4CAF50; margin-top: 3px;"></i>
                    <div>
                        <div style="font-weight: 600; color: #333;">Pickup</div>
                        <div style="color: #666; font-size: 0.95rem;">${delivery.pickup}</div>
                    </div>
                </div>
                
                <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                    <i class="fas fa-flag-checkered" style="color: #FF6584; margin-top: 3px;"></i>
                    <div>
                        <div style="font-weight: 600; color: #333;">Delivery</div>
                        <div style="color: #666; font-size: 0.95rem;">${delivery.destination}</div>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 15px; color: #666; font-size: 0.9rem;">
                    <span><i class="fas fa-route"></i> ${delivery.distance}</span>
                    <span><i class="fas fa-clock"></i> ${delivery.time}</span>
                    <span><i class="fas fa-box"></i> ${delivery.package}</span>
                </div>
            </div>
            
            <button onclick="acceptDelivery('${delivery.id}')" style="
                background: #6C63FF;
                color: white;
                border: none;
                width: 100%;
                padding: 12px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: all 0.3s ease;
            " onmouseover="this.style.background='#554FD8'" onmouseout="this.style.background='#6C63FF'">
                <i class="fas fa-check"></i> Accept Delivery
            </button>
        </div>
    `).join('');
}

// Load Recent Trips
function loadRecentTrips() {
    const container = document.getElementById('recentTrips');
    if (!container) return;
    
    const trips = [
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
    
    container.innerHTML = trips.map(trip => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #E8EAF2;">
            <div>
                <div style="font-weight: 600; color: #333;">${trip.route}</div>
                <div style="color: #666; font-size: 0.9rem; margin-top: 4px;">${trip.date}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 700; color: #6C63FF;">${trip.fare}</div>
                <span style="
                    background: #4CAF50;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    margin-top: 4px;
                    display: inline-block;
                ">
                    ${trip.status}
                </span>
            </div>
        </div>
    `).join('');
}

// Driver Actions
function goOnline() {
    const user = JSON.parse(localStorage.getItem('swiftride_user') || '{}');
    user.status = 'online';
    localStorage.setItem('swiftride_user', JSON.stringify(user));
    
    showNotification('You are now online and available for deliveries', 'success');
    
    if (window.socket) {
        window.socket.emit('driver:status', {
            name: user.name,
            status: 'online'
        });
    }
}

function goOffline() {
    const user = JSON.parse(localStorage.getItem('swiftride_user') || '{}');
    user.status = 'offline';
    localStorage.setItem('swiftride_user', JSON.stringify(user));
    
    showNotification('You are now offline', 'info');
    
    if (window.socket) {
        window.socket.emit('driver:status', {
            name: user.name,
            status: 'offline'
        });
    }
}

function acceptDelivery(deliveryId) {
    showNotification(`Delivery ${deliveryId} accepted! Starting navigation...`, 'success');
    
    // Update UI to show current delivery
    const currentTrip = document.getElementById('currentTrip');
    if (currentTrip) {
        currentTrip.style.display = 'block';
        currentTrip.innerHTML = `
            <div style="background: #F0F9FF; border-radius: 12px; padding: 20px; border-left: 4px solid #2196F3;">
                <h3 style="margin: 0 0 15px 0; color: #333;">Current Delivery</h3>
                <div style="display: grid; gap: 10px; margin-bottom: 20px;">
                    <div>
                        <strong>Pickup:</strong> 123 Main St, Johannesburg
                    </div>
                    <div>
                        <strong>Delivery:</strong> 456 Oak Ave, Sandton
                    </div>
                    <div>
                        <strong>Distance:</strong> 8.5 km
                    </div>
                    <div>
                        <strong>Fare:</strong> R 120.00
                    </div>
                </div>
                <button onclick="startTrip()" style="
                    background: #2196F3;
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                ">
                    <i class="fas fa-play"></i> Start Trip
                </button>
            </div>
        `;
    }
}

function startTrip() {
    showNotification('Trip started! Navigate to pickup location.', 'success');
    
    // Show delivery steps
    const deliverySteps = document.getElementById('deliverySteps');
    if (deliverySteps) {
        deliverySteps.style.display = 'block';
    }
}

function navigateToPickup() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            window.open(`https://www.google.com/maps/dir/${latitude},${longitude}/-26.195246,28.034088`, '_blank');
        });
    } else {
        window.open('https://www.google.com/maps/dir//-26.195246,28.034088', '_blank');
    }
}

function confirmPickup() {
    showNotification('Pickup confirmed! Proceed to delivery location.', 'success');
}

function navigateToDelivery() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            window.open(`https://www.google.com/maps/dir/${latitude},${longitude}/-26.2041,28.0473`, '_blank');
        });
    } else {
        window.open('https://www.google.com/maps/dir//-26.2041,28.0473', '_blank');
    }
}

function completeDelivery() {
    showNotification('Delivery completed successfully!', 'success');
    
    // Update earnings
    const user = JSON.parse(localStorage.getItem('swiftride_user') || '{}');
    user.todayEarnings = (user.todayEarnings || 0) + 120;
    user.todayTrips = (user.todayTrips || 0) + 1;
    user.completedTrips = (user.completedTrips || 0) + 1;
    user.totalDistance = (user.totalDistance || 0) + 8.5;
    
    localStorage.setItem('swiftride_user', JSON.stringify(user));
    
    // Update UI
    const todayEarnings = document.getElementById('todayEarnings');
    const todayTrips = document.getElementById('todayTrips');
    const completedTrips = document.getElementById('completedTrips');
    const totalDistance = document.getElementById('totalDistance');
    
    if (todayEarnings) todayEarnings.textContent = `R ${(user.todayEarnings || 0).toFixed(2)}`;
    if (todayTrips) todayTrips.textContent = user.todayTrips || 0;
    if (completedTrips) completedTrips.textContent = user.completedTrips || 0;
    if (totalDistance) totalDistance.textContent = `${(user.totalDistance || 0).toFixed(1)} km`;
    
    // Hide current trip
    const currentTrip = document.getElementById('currentTrip');
    const deliverySteps = document.getElementById('deliverySteps');
    
    if (currentTrip) currentTrip.style.display = 'none';
    if (deliverySteps) deliverySteps.style.display = 'none';
    
    // Reload deliveries
    loadAvailableDeliveries();
}

function centerOnMe() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            if (window.currentMap) {
                window.currentMap.centerOn([latitude, longitude], 14);
                showNotification('Centered on your location', 'info');
            }
        });
    }
}

// Setup Event Listeners
function setupDriverEventListeners() {
    // Status buttons
    const onlineBtn = document.querySelector('[onclick="goOnline()"]');
    const offlineBtn = document.querySelector('[onclick="goOffline()"]');
    
    if (onlineBtn) onlineBtn.onclick = goOnline;
    if (offlineBtn) offlineBtn.onclick = goOffline;
    
    // Navigation buttons
    const centerBtn = document.querySelector('[onclick="centerOnMe()"]');
    if (centerBtn) centerBtn.onclick = centerOnMe;
    
    // Delivery buttons
    const navPickupBtn = document.querySelector('[onclick="navigateToPickup()"]');
    const confirmPickupBtn = document.querySelector('[onclick="confirmPickup()"]');
    const navDeliveryBtn = document.querySelector('[onclick="navigateToDelivery()"]');
    const completeDeliveryBtn = document.querySelector('[onclick="completeDelivery()"]');
    
    if (navPickupBtn) navPickupBtn.onclick = navigateToPickup;
    if (confirmPickupBtn) confirmPickupBtn.onclick = confirmPickup;
    if (navDeliveryBtn) navDeliveryBtn.onclick = navigateToDelivery;
    if (completeDeliveryBtn) completeDeliveryBtn.onclick = completeDelivery;
}

// Make functions globally available
window.goOnline = goOnline;
window.goOffline = goOffline;
window.acceptDelivery = acceptDelivery;
window.startTrip = startTrip;
window.navigateToPickup = navigateToPickup;
window.confirmPickup = confirmPickup;
window.navigateToDelivery = navigateToDelivery;
window.completeDelivery = completeDelivery;
window.centerOnMe = centerOnMe;