// ===== SWIFTRIDE APPLICATION - COMPLETE WORKING VERSION =====

// Configuration
const APP_CONFIG = {
    API_BASE_URL: 'https://swiftride-api.onrender.com/api',
    MAP_CONFIG: {
        defaultCenter: [-26.195246, 28.034088], // Johannesburg
        defaultZoom: 14,
        maxZoom: 18,
        minZoom: 10
    },
    USER_TYPES: {
        ADMIN: 'admin',
        DRIVER: 'driver',
        CUSTOMER: 'customer'
    }
};

// Global State
let AppState = {
    user: null,
    token: null,
    socket: null,
    map: null,
    mapManager: null
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 SwiftRide App Initializing...');
    
    // Hide loading screen after delay
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 1500);
    
    // Check authentication
    checkAuth();
    
    // Initialize page
    initializePage();
});

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
        try {
            AppState.token = token;
            AppState.user = JSON.parse(userData);
            console.log('✅ User authenticated:', AppState.user.name);
            updateUIForLoggedInUser();
        } catch (error) {
            console.error('Auth check failed:', error);
            logout();
        }
    } else {
        console.log('🔒 No user logged in');
    }
}

// Update UI for logged in user
function updateUIForLoggedInUser() {
    const userType = AppState.user?.userType;
    const userName = AppState.user?.name;
    
    // Update user info elements
    const userElements = document.querySelectorAll('.user-info');
    userElements.forEach(el => {
        if (userName) {
            el.innerHTML = `
                <div class="user-avatar">${userName.charAt(0)}</div>
                <div>
                    <strong>${userName}</strong>
                    <small>${userType}</small>
                </div>
            `;
        }
    });
}

// Initialize page based on current page
function initializePage() {
    const page = document.body.dataset.page;
    console.log('Initializing page:', page);
    
    switch(page) {
        case 'home':
            initHomePage();
            break;
        case 'admin':
            initAdminPage();
            break;
        case 'driver':
            initDriverPage();
            break;
        case 'customer':
            initCustomerPage();
            break;
        case 'tracking':
            initTrackingPage();
            break;
        default:
            initHomePage();
    }
}

// Home Page
function initHomePage() {
    console.log('Initializing home page');
    
    // Initialize map preview
    setTimeout(() => {
        const mapContainer = document.getElementById('previewMap');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div style="height:400px;background:linear-gradient(135deg,#6C63FF,#4A43C8);border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;text-align:center;">
                    <div>
                        <i class="fas fa-map-marked-alt" style="font-size:3rem;"></i>
                        <h3>Live Driver Tracking</h3>
                        <p>Track drivers in real-time on dashboard</p>
                    </div>
                </div>
            `;
        }
    }, 500);
}

// Admin Page
function initAdminPage() {
    console.log('Initializing admin page');
    
    // Check if user is admin
    if (AppState.user?.userType !== 'admin') {
        showNotification('Admin access required', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Update admin info
    if (AppState.user) {
        const nameElements = document.querySelectorAll('.admin-name-display');
        nameElements.forEach(el => {
            if (el) el.textContent = AppState.user.name;
        });
    }
}

// Driver Page
function initDriverPage() {
    console.log('Initializing driver page');
    
    if (AppState.user?.userType !== 'driver') {
        showNotification('Driver login required', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
}

// Customer Page
function initCustomerPage() {
    console.log('Initializing customer page');
    // Customer page accessible to all
}

// Tracking Page
function initTrackingPage() {
    console.log('Initializing tracking page');
    // Tracking page accessible to all
}

// API Class
class API {
    static async request(endpoint, options = {}) {
        const url = `${APP_CONFIG.API_BASE_URL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(AppState.token && { 'Authorization': `Bearer ${AppState.token}` })
            }
        };
        
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            showNotification('Network error. Please check connection.', 'error');
            throw error;
        }
    }
    
    static async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#FF5252' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Hide modal
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    AppState.token = null;
    AppState.user = null;
    
    if (AppState.socket) {
        AppState.socket.disconnect();
        AppState.socket = null;
    }
    
    showNotification('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Redirect to page
function redirectTo(page) {
    window.location.href = `${page}.html`;
}

// Test login functions
window.createTestUser = function(type) {
    return {
        _id: 'test_' + type + '_123',
        name: 'Test ' + type.charAt(0).toUpperCase() + type.slice(1),
        email: type + '@test.com',
        userType: type,
        phone: '1234567890'
    };
};

window.loginAsAdmin = function() {
    console.log('Logging in as admin');
    localStorage.setItem('token', 'test_token_admin');
    localStorage.setItem('user', JSON.stringify(createTestUser('admin')));
    showNotification('Logged in as Admin!', 'success');
    setTimeout(() => {
        window.location.href = 'admin.html';
    }, 1000);
};

window.loginAsDriver = function() {
    console.log('Logging in as driver');
    localStorage.setItem('token', 'test_token_driver');
    localStorage.setItem('user', JSON.stringify(createTestUser('driver')));
    showNotification('Logged in as Driver!', 'success');
    setTimeout(() => {
        window.location.href = 'driver.html';
    }, 1000);
};

window.loginAsCustomer = function() {
    console.log('Logging in as customer');
    localStorage.setItem('token', 'test_token_customer');
    localStorage.setItem('user', JSON.stringify(createTestUser('customer')));
    showNotification('Logged in as Customer!', 'success');
    setTimeout(() => {
        window.location.href = 'customer.html';
    }, 1000);
};

// Add this function definition
function trackDriver(driverId) {
    console.log('Tracking driver:', driverId);
    localStorage.setItem('trackingDriverId', driverId);
    window.location.href = `tracking.html?driverId=${driverId}`;
}

// Make sure it's available globally
window.trackDriver = trackDriver;



// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered');
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// Export functions to global scope
window.showNotification = showNotification;
window.showModal = showModal;
window.hideModal = hideModal;
window.logout = logout;
window.redirectTo = redirectTo;
window.trackDriver = trackDriver;
window.loginAsAdmin = loginAsAdmin;
window.loginAsDriver = loginAsDriver;
window.loginAsCustomer = loginAsCustomer;