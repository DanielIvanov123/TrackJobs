/**
 * core.js - Core functionality and utility functions
 */

// Global state
window.trackjobs = {
    currentJobs: [],
    initialized: false
};

// Initialize on document load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Document loaded, initializing TrackJobs application');
    
    // Check if Bootstrap is available
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap not loaded!');
        
        // Try to load Bootstrap dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js';
        document.body.appendChild(script);
        
        script.onload = function() {
            console.log('Bootstrap loaded dynamically');
            initializeApp();
        };
    } else {
        console.log('Bootstrap is already loaded');
        initializeApp();
    }
});

/**
 * Initialize the application
 */
function initializeApp() {
    // Initialize all tabs
    initializeTabs();
    
    // Initialize tooltips
    initializeTooltips();
    
    // Set application as initialized
    window.trackjobs.initialized = true;
    
    // Trigger initial data load if we're on the search tab
    if (document.getElementById('searchTabContent').style.display !== 'none') {
        if (typeof searchJobs === 'function') {
            searchJobs();
        }
    }
    
    console.log('TrackJobs application initialized successfully');
}

/**
 * Initialize tab navigation
 */
function initializeTabs() {
    // Get DOM elements for navigation
    const searchTabLink = document.getElementById('searchTabLink');
    const scraperTabLink = document.getElementById('scraperTabLink');
    
    // Add tab navigation event listeners
    if (searchTabLink) {
        searchTabLink.addEventListener('click', function(e) {
            e.preventDefault();
            showSearchTab();
        });
    }
    
    if (scraperTabLink) {
        scraperTabLink.addEventListener('click', function(e) {
            e.preventDefault();
            showScraperTab();
        });
    }
}

/**
 * Initialize Bootstrap tooltips
 */
function initializeTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    if (tooltipTriggerList.length > 0 && bootstrap && bootstrap.Tooltip) {
        [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    }
}

/**
 * Show search tab
 */
function showSearchTab() {
    const searchTabLink = document.getElementById('searchTabLink');
    const scraperTabLink = document.getElementById('scraperTabLink');
    const searchTabContent = document.getElementById('searchTabContent');
    const scraperTabContent = document.getElementById('scraperTabContent');
    
    // Update active state in navigation
    searchTabLink.classList.add('active');
    scraperTabLink.classList.remove('active');
    
    // Show/hide content
    searchTabContent.style.display = 'block';
    scraperTabContent.style.display = 'none';
}

/**
 * Show scraper tab
 */
function showScraperTab() {
    const searchTabLink = document.getElementById('searchTabLink');
    const scraperTabLink = document.getElementById('scraperTabLink');
    const searchTabContent = document.getElementById('searchTabContent');
    const scraperTabContent = document.getElementById('scraperTabContent');
    
    // Update active state in navigation
    searchTabLink.classList.remove('active');
    scraperTabLink.classList.add('active');
    
    // Show/hide content
    searchTabContent.style.display = 'none';
    scraperTabContent.style.display = 'block';
}

/**
 * Get CSRF token from meta tag
 */
function getCsrfToken() {
    const metaTag = document.querySelector('meta[name="_csrf"]');
    return metaTag ? metaTag.getAttribute('content') : '';
}

/**
 * Get CSRF header from meta tag
 */
function getCsrfHeader() {
    const metaTag = document.querySelector('meta[name="_csrf_header"]');
    return metaTag ? metaTag.getAttribute('content') : '';
}

/**
 * Show alert message
 */
function showAlert(message, type) {
    // Create alert container if it doesn't exist
    let alertContainer = document.querySelector('.alert-container');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.className = 'alert-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(alertContainer);
    }
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to container
    alertContainer.appendChild(alert);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        // Check if alert still exists
        if (alert.parentNode) {
            try {
                // Create Bootstrap alert instance and hide it
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            } catch (e) {
                // Fallback if Bootstrap is not available
                alert.remove();
            }
        }
    }, 5000);
}

/**
 * Format a date string
 */
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Safely set text content of an element, checking if it exists first
 */
function setTextContentSafely(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

/**
 * Ensure Bootstrap is properly loaded
 */
function ensureBootstrapLoaded() {
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap not loaded! Attempting to load it dynamically...');
        
        return new Promise((resolve, reject) => {
            // Try to load Bootstrap dynamically
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js';
            script.onload = function() {
                console.log('Bootstrap loaded dynamically');
                resolve(true);
            };
            script.onerror = function(e) {
                console.error('Failed to load Bootstrap dynamically', e);
                reject(e);
            };
            document.body.appendChild(script);
        });
    } else {
        console.log('Bootstrap is already loaded');
        return Promise.resolve(true);
    }
}

/**
 * Initialize shared variables used across multiple modules
 */
function initializeSharedVariables() {
    // Initialize the global storage object
    window.trackjobs = window.trackjobs || {};
    window.trackjobs.elements = window.trackjobs.elements || {};
    
    // Store common DOM elements that are used across multiple files
    window.trackjobs.elements.jobsContainer = document.getElementById('jobsContainer');
    window.trackjobs.elements.jobsCount = document.getElementById('jobsCount');
    
    console.log('Shared variables initialized');
}

// Call this before other initializations
document.addEventListener('DOMContentLoaded', function() {
    // Initialize shared variables first
    initializeSharedVariables();
});