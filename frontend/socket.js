function initSocket() {
    // The socket manager is now initialized in socket.js
    // Just wait for it to be ready
    setTimeout(() => {
        if (window.socketManager) {
            AppState.socket = socketManager.socket;
            
            socketManager.on('socket:connected', () => {
                console.log('✅ Socket connected via SocketManager');
                
                // Authenticate if user is logged in
                if (AppState.user) {
                    socketManager.authenticate(AppState.user);
                }
            });
            
            socketManager.on('user:authenticated', (data) => {
                console.log('User authenticated via socket:', data.userType);
            });
            
            socketManager.on('driver_location_update', (data) => {
                if (AppState.user?.userType === 'admin' && AppState.mapManager) {
                    // Update driver marker on admin map
                    AppState.mapManager.updateMarker(`driver_${data.driverId}`, [data.lat, data.lng]);
                }
            });
            
            socketManager.on('driver_status_update', (data) => {
                console.log('Driver status update:', data);
            });
        }
    }, 2000);
}