// Global Application State
let currentUser = null;
let isOnline = navigator.onLine;

// Initialize Application
function initializeApp() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered successfully');

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    showNotification('App update available!', 'info');
                });
            })
            .catch(error => {
                console.error('SW registration failed:', error);
            });
    }

    // Check online status
    window.addEventListener('online', () => {
        isOnline = true;
        showNotification('Connection restored', 'success');
        syncOfflineData();
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        showNotification('You are offline', 'warning');
    });

    // Load user session
    loadUserSession();

    // Initialize UI animations
    initializeAnimations();
}

// User Session Management
function loadUserSession() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        console.log('User session loaded:', currentUser);
    }
}

function saveUserSession(user) {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
}

function clearUserSession() {
    currentUser = null;
    localStorage.removeItem('currentUser');
}

// Notification System
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add to body
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('notification-show'), 100);

    // Auto remove
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.remove('notification-show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-triangle';
        case 'warning': return 'exclamation-circle';
        default: return 'info-circle';
    }
}

// Loading States
function showLoading(message = 'Loading...') {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loadingOverlay';
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(loadingOverlay);
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

// Form Validation Helpers
function validatePhone(phone) {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone);
}

function validateRequired(value, fieldName) {
    if (!value || value.trim() === '') {
        throw new Error(`${fieldName} is required`);
    }
    return true;
}

// Date and Time Formatters
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateTime(dateString);
}

// Rotatory Worker Assignment
async function assignWorkerToReport(reportId, zoneId) {
    try {
        console.log(`Assigning worker for report ${reportId} in zone ${zoneId}`);

        // Get all workers in the zone, ordered by last assignment
        const { data: workers, error } = await supabase
            .from('users')
            .select('id, name, last_assigned_at')
            .eq('user_type', 'worker')
            .eq('zone_id', zoneId)
            .order('last_assigned_at', { ascending: true, nullsFirst: true });

        if (error) {
            throw error;
        }

        if (!workers || workers.length === 0) {
            throw new Error(`No workers available in zone ${zoneId}`);
        }

        // Pick the first worker (least recently assigned)
        const selectedWorker = workers[0];

        // Update report with assigned worker
        const { error: updateReportError } = await supabase
            .from('reports')
            .update({
                worker_id: selectedWorker.id,
                status: 'assigned',
                assigned_at: new Date().toISOString()
            })
            .eq('id', reportId);

        if (updateReportError) {
            throw updateReportError;
        }

        // Update worker's last assigned timestamp
        const { error: updateWorkerError } = await supabase
            .from('users')
            .update({ last_assigned_at: new Date().toISOString() })
            .eq('id', selectedWorker.id);

        if (updateWorkerError) {
            throw updateWorkerError;
        }

        console.log(`Report assigned to worker: ${selectedWorker.name}`);
        return selectedWorker;

    } catch (error) {
        console.error('Worker assignment error:', error);
        throw error;
    }
}

// Offline Data Management
function saveOfflineData(key, data) {
    try {
        const offlineData = JSON.parse(localStorage.getItem('offlineData') || '{}');
        offlineData[key] = data;
        localStorage.setItem('offlineData', JSON.stringify(offlineData));
    } catch (error) {
        console.error('Error saving offline data:', error);
    }
}

function getOfflineData(key) {
    try {
        const offlineData = JSON.parse(localStorage.getItem('offlineData') || '{}');
        return offlineData[key] || null;
    } catch (error) {
        console.error('Error getting offline data:', error);
        return null;
    }
}

async function syncOfflineData() {
    try {
        const offlineData = JSON.parse(localStorage.getItem('offlineData') || '{}');

        for (const [key, data] of Object.entries(offlineData)) {
            if (key.startsWith('report_')) {
                // Sync offline reports
                await syncOfflineReport(data);
                delete offlineData[key];
            }
        }

        localStorage.setItem('offlineData', JSON.stringify(offlineData));
        console.log('Offline data synced successfully');

    } catch (error) {
        console.error('Offline sync error:', error);
    }
}

// Animation Helpers
function initializeAnimations() {
    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe all elements with animation classes
    document.querySelectorAll('.glass-card, .stat-item').forEach(el => {
        observer.observe(el);
    });
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(el => {
        el.addEventListener('mouseenter', showTooltip);
        el.addEventListener('mouseleave', hideTooltip);
    });
});

function showTooltip(event) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = event.target.getAttribute('data-tooltip');
    document.body.appendChild(tooltip);

    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
}

function hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Real-time Updates Setup
function setupRealtimeUpdates() {
    if (!currentUser) return;

    // Setup real-time subscriptions based on user type
    switch (currentUser.user_type) {
        case 'citizen':
            subscribeToCitizenUpdates();
            break;
        case 'worker':
            subscribeToWorkerUpdates();
            break;
        case 'admin':
            subscribeToAdminUpdates();
            break;
    }
}

function subscribeToCitizenUpdates() {
    supabase
        .channel('citizen-reports')
        .on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'reports',
                filter: `citizen_id=eq.${currentUser.id}`
            },
            (payload) => {
                showNotification(`Report status updated: ${payload.new.status}`, 'info');
                if (typeof updateReportsList === 'function') {
                    updateReportsList();
                }
            }
        )
        .subscribe();
}

function subscribeToWorkerUpdates() {
    supabase
        .channel('worker-tasks')
        .on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'reports',
                filter: `worker_id=eq.${currentUser.id}`
            },
            (payload) => {
                if (payload.new.status === 'assigned' && payload.old.status === 'pending') {
                    showNotification('New cleanup task assigned to you!', 'success');
                    if (typeof updateTasksList === 'function') {
                        updateTasksList();
                    }
                }
            }
        )
        .subscribe();
}

function subscribeToAdminUpdates() {
    supabase
        .channel('admin-reports')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'reports'
            },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    showNotification('New report submitted!', 'info');
                } else if (payload.eventType === 'UPDATE' && payload.new.status === 'completed') {
                    showNotification('Task completed - awaiting verification!', 'info');
                }

                if (typeof updateAdminDashboard === 'function') {
                    updateAdminDashboard();
                }
            }
        )
        .subscribe();
}

console.log('Main app.js loaded successfully');
