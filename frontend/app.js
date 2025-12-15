// ===== SWIFTRIDE APP.JS - SAFE VERSION =====
const APP_CONFIG = {
    API_BASE_URL: 'https://swiftride-backend-jcyl.onrender.com/api'
};

let AppState = { user: null, token: null };

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const loading = document.getElementById('loadingScreen');
        if (loading) loading.style.display = 'none';
    }, 1000);
});

// ===== SAFE FUNCTIONS (No Map Conflicts) =====
window.trackDriver = function(id) {
    console.log('Tracking:', id);
    localStorage.setItem('trackId', id);
    window.location.href = 'tracking.html?driver=' + id;
    return false;
};

window.logout = function() {
    localStorage.clear();
    window.location.href = 'index.html';
};

window.showModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'block';
    return false;
};

window.hideModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
    return false;
};

window.showNotification = function(msg, type = 'info') {
    console.log(type + ':', msg);
    return false;
};

window.redirectTo = function(page) {
    window.location.href = page + '.html';
    return false;
};

// ===== PAGE FUNCTIONS (Safe) =====
window.showNewDelivery = function() { return false; };
window.showTrackDelivery = function() { return false; };
window.showPayment = function() { return false; };
window.showSettings = function() { return false; };
window.showNotifications = function() { return false; };
window.showHistory = function() { return false; };

// ===== TEST LOGIN BUTTONS (Safe) =====
window.loginAsAdmin = function() {
    localStorage.setItem('user', JSON.stringify({_id:'admin1', name:'Admin', userType:'admin'}));
    localStorage.setItem('token', 'test');
    window.location.href = 'admin.html';
    return false;
};

window.loginAsDriver = function() {
    localStorage.setItem('user', JSON.stringify({_id:'driver1', name:'Driver', userType:'driver'}));
    localStorage.setItem('token', 'test');
    window.location.href = 'driver.html';
    return false;
};

window.loginAsCustomer = function() {
    localStorage.setItem('user', JSON.stringify({_id:'customer1', name:'Customer', userType:'customer'}));
    localStorage.setItem('token', 'test');
    window.location.href = 'customer.html';
    return false;
};

console.log('✅ SAFE app.js loaded - No map conflicts');