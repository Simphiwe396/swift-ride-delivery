// ===== SWIFTRIDE WORKING APP.JS =====
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

// ===== REQUIRED FUNCTIONS =====
window.trackDriver = function(id) {
    console.log('Tracking:', id);
    localStorage.setItem('trackId', id);
    window.location.href = 'tracking.html?driver=' + id;
};

window.logout = function() {
    localStorage.clear();
    window.location.href = 'index.html';
};

// ADD THESE MISSING FUNCTIONS:
window.showModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'block';
};

window.hideModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
};

window.showNotification = function(msg, type = 'info') {
    console.log(type + ':', msg);
    alert(type.toUpperCase() + ': ' + msg); // Simple alert for now
};

window.redirectTo = function(page) {
    window.location.href = page + '.html';
};

// ===== PAGE FUNCTIONS =====
window.showNewDelivery = function() {
    showModal('newDeliveryModal');
};

window.showTrackDelivery = function() {
    showModal('trackModal');
};

window.showPayment = function() {
    showModal('paymentModal');
};

window.showSettings = function() {
    showModal('settingsModal');
};

window.showNotifications = function() {
    showModal('notificationsModal');
};

window.showHistory = function() {
    showModal('historyModal');
};

// ===== TEST LOGIN BUTTONS =====
window.loginAsAdmin = function() {
    const user = {_id:'admin1', name:'Admin', userType:'admin'};
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'test');
    window.location.href = 'admin.html';
};

window.loginAsDriver = function() {
    const user = {_id:'driver1', name:'Driver', userType:'driver'};
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'test');
    window.location.href = 'driver.html';
};

window.loginAsCustomer = function() {
    const user = {_id:'customer1', name:'Customer', userType:'customer'};
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'test');
    window.location.href = 'customer.html';
};

// ===== DEBUG =====
console.log('✅ app.js loaded with all functions');