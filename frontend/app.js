// API Configuration
const API_BASE_URL = 'https://swiftride-backend-jcyl.onrender.com/api';

// DOM Elements
let currentUser = null;
let authToken = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('SwiftRide App Initializing...');
    
    // Check authentication status
    checkAuthStatus();
    
    // Load appropriate page
    loadPage();
    
    // Initialize socket connection
    initializeSocket();
});

// Authentication Functions
async function checkAuthStatus() {
    const token = localStorage.getItem('swiftride_token');
    if (token) {
        authToken = token;
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                console.log('User authenticated:', currentUser.email);
                return true;
            } else {
                localStorage.removeItem('swiftride_token');
                authToken = null;
                return false;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            return false;
        }
    }
    return false;
}

function loadPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    
    console.log('Loading page:', page);
    
    switch(page) {
        case 'index.html':
        case '':
            if (currentUser) {
                redirectToDashboard();
            }
            break;
        case 'login.html':
            setupLoginForm();
            break;
        case 'customer.html':
            if (!currentUser) redirectToLogin();
            else setupCustomerDashboard();
            break;
        case 'driver.html':
            if (!currentUser) redirectToLogin();
            else setupDriverDashboard();
            break;
        case 'admin.html':
            if (!currentUser) redirectToLogin();
            else setupAdminDashboard();
            break;
        case 'tracking.html':
            setupTrackingPage();
            break;
    }
}

// Navigation Functions
function redirectToLogin() {
    window.location.href = 'login.html';
}

function redirectToDashboard() {
    if (!currentUser) {
        redirectToLogin();
        return;
    }
    
    switch(currentUser.role) {
        case 'customer':
            window.location.href = 'customer.html';
            break;
        case 'driver':
            window.location.href = 'driver.html';
            break;
        case 'admin':
            window.location.href = 'admin.html';
            break;
        default:
            window.location.href = 'customer.html';
    }
}

function logout() {
    localStorage.removeItem('swiftride_token');
    currentUser = null;
    authToken = null;
    showNotification('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1500);
}

// Login Form Setup
function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        
        const loginBtn = document.getElementById('loginBtn');
        const originalText = loginBtn.textContent;
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;
        
        try {
            let response;
            
            if (role === 'admin') {
                // Admin login
                response = await fetch(`${API_BASE_URL}/admin/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
            } else {
                // User login
                response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
            }
            
            const data = await response.json();
            
            if (data.success) {
                if (role === 'admin') {
                    // Admin uses simple token
                    authToken = data.token;
                    currentUser = data.user;
                    localStorage.setItem('swiftride_token', authToken);
                } else {
                    // Regular user uses JWT
                    authToken = data.token;
                    currentUser = data.user;
                    localStorage.setItem('swiftride_token', authToken);
                }
                
                showNotification('Login successful!', 'success');
                setTimeout(() => {
                    redirectToDashboard();
                }, 1000);
            } else {
                showNotification(data.error || 'Login failed', 'error');
                loginBtn.textContent = originalText;
                loginBtn.disabled = false;
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Network error. Please try again.', 'error');
            loginBtn.textContent = originalText;
            loginBtn.disabled = false;
        }
    });
    
    // Register link
    const registerLink = document.getElementById('registerLink');
    if (registerLink) {
        registerLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'index.html#register';
        });
    }
}

// Customer Dashboard
async function setupCustomerDashboard() {
    console.log('Setting up customer dashboard');
    
    // Update user info
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('walletBalance').textContent = `R${currentUser.walletBalance || 0}`;
    }
    
    // Setup request trip form
    const tripForm = document.getElementById('tripForm');
    if (tripForm) {
        tripForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const pickup = document.getElementById('pickup').value;
            const destination = document.getElementById('destination').value;
            const tripType = document.getElementById('tripType').value;
            
            const requestBtn = document.getElementById('requestBtn');
            const originalText = requestBtn.textContent;
            requestBtn.textContent = 'Requesting...';
            requestBtn.disabled = true;
            
            try {
                const response = await fetch(`${API_BASE_URL}/trips/request`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        pickup,
                        destination,
                        tripType,
                        customerId: currentUser.id
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('Trip requested successfully!', 'success');
                    tripForm.reset();
                    loadCustomerTrips();
                } else {
                    showNotification(data.error || 'Request failed', 'error');
                }
            } catch (error) {
                showNotification('Network error', 'error');
            } finally {
                requestBtn.textContent = originalText;
                requestBtn.disabled = false;
            }
        });
    }
    
    // Load trips
    await loadCustomerTrips();
    
    // Setup buttons
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('trackTripBtn').addEventListener('click', function() {
        window.location.href = 'tracking.html';
    });
}

async function loadCustomerTrips() {
    try {
        const response = await fetch(`${API_BASE_URL}/trips/customer/${currentUser.id}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tripsList = document.getElementById('tripsList');
            
            if (data.trips && data.trips.length > 0) {
                tripsList.innerHTML = data.trips.map(trip => `
                    <div class="trip-card">
                        <h4>${trip.pickup} → ${trip.destination}</h4>
                        <p>Status: <span class="status ${trip.status}">${trip.status}</span></p>
                        <p>Driver: ${trip.driverName || 'Not assigned'}</p>
                        <p>Fare: R${trip.fare || '0'}</p>
                    </div>
                `).join('');
            } else {
                tripsList.innerHTML = '<p class="no-trips">No trips yet. Request your first trip!</p>';
            }
        }
    } catch (error) {
        console.error('Error loading trips:', error);
    }
}

// Driver Dashboard
async function setupDriverDashboard() {
    console.log('Setting up driver dashboard');
    
    if (currentUser) {
        document.getElementById('driverName').textContent = currentUser.name;
        document.getElementById('driverEmail').textContent = currentUser.email;
    }
    
    // Load driver trips
    await loadDriverTrips();
    
    // Setup buttons
    document.getElementById('driverLogoutBtn').addEventListener('click', logout);
    document.getElementById('goOnlineBtn').addEventListener('click', toggleDriverStatus);
    
    // Setup status update
    const statusSelect = document.getElementById('statusSelect');
    if (statusSelect) {
        statusSelect.addEventListener('change', function() {
            updateDriverStatus(this.value);
        });
    }
}

async function loadDriverTrips() {
    try {
        const response = await fetch(`${API_BASE_URL}/trips/driver/${currentUser.id}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tripsList = document.getElementById('driverTripsList');
            
            if (data.trips && data.trips.length > 0) {
                tripsList.innerHTML = data.trips.map(trip => `
                    <div class="trip-card">
                        <h4>${trip.pickup} → ${trip.destination}</h4>
                        <p>Customer: ${trip.customerName}</p>
                        <p>Status: <span class="status ${trip.status}">${trip.status}</span></p>
                        <p>Fare: R${trip.fare || '0'}</p>
                        <button class="btn" onclick="updateTripStatus('${trip._id}', 'accepted')">Accept</button>
                        <button class="btn" onclick="updateTripStatus('${trip._id}', 'started')">Start</button>
                        <button class="btn" onclick="updateTripStatus('${trip._id}', 'completed')">Complete</button>
                    </div>
                `).join('');
            } else {
                tripsList.innerHTML = '<p class="no-trips">No assigned trips yet.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading driver trips:', error);
    }
}

// Admin Dashboard
async function setupAdminDashboard() {
    console.log('Setting up admin dashboard');
    
    if (currentUser) {
        document.getElementById('adminName').textContent = currentUser.name;
    }
    
    // Load stats
    await loadAdminStats();
    
    // Setup buttons
    document.getElementById('adminLogoutBtn').addEventListener('click', logout);
    
    // Load drivers
    await loadAllDrivers();
    
    // Load trips
    await loadAllTrips();
}

async function loadAdminStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/stats`);
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('totalTrips').textContent = data.totalTrips || 0;
            document.getElementById('activeDrivers').textContent = data.activeDrivers || 0;
            document.getElementById('totalUsers').textContent = data.totalUsers || 0;
            document.getElementById('revenue').textContent = `R${data.revenue || 0}`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadAllDrivers() {
    try {
        const response = await fetch(`${API_BASE_URL}/drivers/all`);
        
        if (response.ok) {
            const drivers = await response.json();
            const driversList = document.getElementById('driversList');
            
            if (drivers.length > 0) {
                driversList.innerHTML = drivers.map(driver => `
                    <div class="trip-card">
                        <h4>${driver.name}</h4>
                        <p>Email: ${driver.email}</p>
                        <p>Phone: ${driver.phone}</p>
                        <p>Status: <span class="status ${driver.status}">${driver.status}</span></p>
                        <p>Vehicle: ${driver.vehicleType} - ${driver.vehicleNumber}</p>
                        <button class="admin-btn delete" onclick="deleteDriver('${driver._id}')">Delete</button>
                    </div>
                `).join('');
            } else {
                driversList.innerHTML = '<p>No drivers registered.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading drivers:', error);
    }
}

async function loadAllTrips() {
    try {
        const response = await fetch(`${API_BASE_URL}/trips/all`);
        
        if (response.ok) {
            const trips = await response.json();
            const tripsList = document.getElementById('allTripsList');
            
            if (trips.length > 0) {
                tripsList.innerHTML = trips.map(trip => `
                    <div class="trip-card">
                        <h4>${trip.pickup} → ${trip.destination}</h4>
                        <p>Customer: ${trip.customerName}</p>
                        <p>Driver: ${trip.driverName || 'Not assigned'}</p>
                        <p>Status: <span class="status ${trip.status}">${trip.status}</span></p>
                        <p>Fare: R${trip.fare || '0'}</p>
                        <button class="admin-btn" onclick="updateTrip('${trip._id}')">Update</button>
                        <button class="admin-btn delete" onclick="deleteTrip('${trip._id}')">Delete</button>
                    </div>
                `).join('');
            } else {
                tripsList.innerHTML = '<p>No trips yet.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading trips:', error);
    }
}

// Tracking Page
function setupTrackingPage() {
    console.log('Setting up tracking page');
    
    // Back button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.history.back();
        });
    }
    
    // Initialize map (placeholder)
    initMap();
}

function initMap() {
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.innerHTML = `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;">
                <div style="text-align:center;">
                    <h3>Live Tracking Map</h3>
                    <p>Real-time driver location tracking will appear here</p>
                </div>
            </div>
        `;
    }
}

// Socket.io Functions
function initializeSocket() {
    // Socket connection will be handled in socket.js
    console.log('Socket initialization ready');
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatCurrency(amount) {
    return 'R' + parseFloat(amount).toFixed(2);
}

// Make functions globally available for onclick attributes
window.logout = logout;
window.updateTripStatus = async function(tripId, status) {
    try {
        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification(`Trip ${status}`, 'success');
            location.reload();
        }
    } catch (error) {
        showNotification('Update failed', 'error');
    }
};

window.deleteDriver = async function(driverId) {
    if (confirm('Are you sure you want to delete this driver?')) {
        try {
            const response = await fetch(`${API_BASE_URL}/drivers/${driverId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                showNotification('Driver deleted', 'success');
                loadAllDrivers();
            }
        } catch (error) {
            showNotification('Delete failed', 'error');
        }
    }
};

console.log('SwiftRide App Loaded Successfully');