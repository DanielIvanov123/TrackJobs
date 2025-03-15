/**
 * core.js - Core functionality and utility functions
 * Optimized for performance and memory efficiency
 */

// Use self-executing function for encapsulation
(function() {
    // Cache DOM lookups for performance
    const domCache = {};
    
    // Initialize the application
    function initializeApp() {
        console.time('App Initialization');
        
        // Initialize all tabs
        initializeTabs();
        
        // Initialize tooltips
        initializeTooltips();
        
        // Set application as initialized
        window.trackjobs.initialized = true;
        
        // Trigger initial data load if we're on the search tab
        const searchTabContent = document.getElementById('searchTabContent');
        if (searchTabContent && searchTabContent.style.display !== 'none') {
            if (typeof searchJobs === 'function') {
                searchJobs();
            }
        }
        
        console.timeEnd('App Initialization');
        console.log('TrackJobs application initialized successfully');
    }
    
    /**
     * Get a DOM element with caching
     * @param {String} id - Element ID
     * @return {HTMLElement} The DOM element
     */
    function getElement(id) {
        if (!domCache[id]) {
            domCache[id] = document.getElementById(id);
        }
        return domCache[id];
    }
    
    /**
     * Initialize tab navigation with improved event delegation
     */
    function initializeTabs() {
        // Use a single event listener with delegation pattern
        const navContainer = document.querySelector('.navbar-nav');
        if (navContainer) {
            navContainer.addEventListener('click', (e) => {
                const link = e.target.closest('.nav-link');
                if (!link) return;
                
                e.preventDefault();
                
                if (link.id === 'searchTabLink') {
                    showSearchTab();
                } else if (link.id === 'scraperTabLink') {
                    showScraperTab();
                }
            });
        } else {
            // Fallback to individual listeners if container not found
            const searchTabLink = getElement('searchTabLink');
            const scraperTabLink = getElement('scraperTabLink');
            
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
    }
    
    /**
     * Initialize Bootstrap tooltips with performance optimization
     */
    function initializeTooltips() {
        // Only initialize if Bootstrap is available
        if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) {
            return;
        }
        
        // Use more efficient query selector
        const tooltipElements = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        if (tooltipElements.length === 0) return;
        
        // Create tooltips with a batch operation
        [...tooltipElements].forEach(element => 
            new bootstrap.Tooltip(element, {
                delay: { show: 500, hide: 100 } // Add delay to reduce unnecessary renders
            })
        );
    }
    
    /**
     * Show search tab with optimized DOM operations
     */
    function showSearchTab() {
        // Cache DOM lookups
        const searchTabLink = getElement('searchTabLink');
        const scraperTabLink = getElement('scraperTabLink');
        const searchTabContent = getElement('searchTabContent');
        const scraperTabContent = getElement('scraperTabContent');
        
        // Update classes in batch where possible
        if (searchTabLink && scraperTabLink) {
            searchTabLink.classList.add('active');
            scraperTabLink.classList.remove('active');
        }
        
        // Use direct style changes rather than class toggling for display
        if (searchTabContent) searchTabContent.style.display = 'block';
        if (scraperTabContent) scraperTabContent.style.display = 'none';
    }
    
    /**
     * Show scraper tab with optimized DOM operations
     */
    function showScraperTab() {
        // Cache DOM lookups
        const searchTabLink = getElement('searchTabLink');
        const scraperTabLink = getElement('scraperTabLink');
        const searchTabContent = getElement('searchTabContent');
        const scraperTabContent = getElement('scraperTabContent');
        
        // Update classes in batch where possible
        if (searchTabLink && scraperTabLink) {
            searchTabLink.classList.remove('active');
            scraperTabLink.classList.add('active');
        }
        
        // Use direct style changes rather than class toggling for display
        if (searchTabContent) searchTabContent.style.display = 'none';
        if (scraperTabContent) scraperTabContent.style.display = 'block';
    }
    
    /**
     * Get CSRF token from meta tag with cache
     * @return {String} CSRF token
     */
    function getCsrfToken() {
        if (!window.trackjobs.csrfToken) {
            const metaTag = document.querySelector('meta[name="_csrf"]');
            window.trackjobs.csrfToken = metaTag ? metaTag.getAttribute('content') : '';
        }
        return window.trackjobs.csrfToken;
    }
    
    /**
     * Get CSRF header from meta tag with cache
     * @return {String} CSRF header name
     */
    function getCsrfHeader() {
        if (!window.trackjobs.csrfHeader) {
            const metaTag = document.querySelector('meta[name="_csrf_header"]');
            window.trackjobs.csrfHeader = metaTag ? metaTag.getAttribute('content') : '';
        }
        return window.trackjobs.csrfHeader;
    }
    
    /**
     * Show alert message with improved cleanup
     * @param {String} message - Message to display
     * @param {String} type - Alert type (success, danger, etc.)
     */
    function showAlert(message, type) {
        // Create alert container if it doesn't exist
        let alertContainer = document.querySelector('.alert-container');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.className = 'alert-container position-fixed top-0 end-0 p-3';
            alertContainer.style.zIndex = '9999';
            document.body.appendChild(alertContainer);
        }
        
        // Limit number of alerts to prevent overwhelming the UI
        const maxAlerts = 3;
        const currentAlerts = alertContainer.querySelectorAll('.alert');
        if (currentAlerts.length >= maxAlerts) {
            alertContainer.removeChild(currentAlerts[0]);
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
                    // Use Bootstrap if available
                    if (typeof bootstrap !== 'undefined' && bootstrap.Alert) {
                        const bsAlert = new bootstrap.Alert(alert);
                        bsAlert.close();
                    } else {
                        // Fallback to manual removal with animation
                        alert.classList.remove('show');
                        setTimeout(() => alert.remove(), 150);
                    }
                } catch (e) {
                    // Last resort fallback
                    alert.remove();
                }
            }
        }, 5000);
    }
    
    /**
     * Format a date string with memoization for performance
     * @param {String} dateString - Date string to format
     * @return {String} Formatted date string
     */
    const dateFormatCache = {};
    function formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        // Return from cache if exists
        if (dateFormatCache[dateString]) {
            return dateFormatCache[dateString];
        }
        
        try {
            const date = new Date(dateString);
            const formatted = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Cache the result
            dateFormatCache[dateString] = formatted;
            return formatted;
        } catch (error) {
            console.warn('Date formatting error:', error);
            return dateString;
        }
    }
    
    /**
     * Escape HTML to prevent XSS with performance optimization
     * @param {String} str - String to escape
     * @return {String} Escaped HTML string
     */
    function escapeHtml(str) {
        if (!str) return '';
        
        // Use template literals and regexes for better performance
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    /**
     * Safely set text content of an element with null checking
     * @param {String} elementId - ID of the element
     * @param {String} text - Text to set
     */
    function setTextContentSafely(elementId, text) {
        const element = getElement(elementId);
        if (element) {
            element.textContent = text;
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
        window.trackjobs.elements.jobsContainer = getElement('jobsContainer');
        window.trackjobs.elements.jobsCount = getElement('jobsCount');
        
        console.log('Shared variables initialized');
    }
    
    // Attach utility functions to the global object for use in other modules
    window.initializeApp = initializeApp;
    window.showSearchTab = showSearchTab;
    window.showScraperTab = showScraperTab;
    window.getCsrfToken = getCsrfToken;
    window.getCsrfHeader = getCsrfHeader;
    window.showAlert = showAlert;
    window.formatDate = formatDate;
    window.escapeHtml = escapeHtml;
    window.setTextContentSafely = setTextContentSafely;
    window.getElement = getElement;
    
    // Initialize on document load
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize shared variables first
        initializeSharedVariables();
        
        // Check if Bootstrap is available and initialize the app
        if (typeof bootstrap === 'undefined') {
            console.warn('Bootstrap not loaded! Attempting to load it dynamically...');
            
            // Try to load Bootstrap dynamically
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js';
            script.onload = function() {
                console.log('Bootstrap loaded dynamically');
                initializeApp();
            };
            script.onerror = function(e) {
                console.error('Failed to load Bootstrap dynamically', e);
                // Still try to initialize even without Bootstrap
                initializeApp();
            };
            document.body.appendChild(script);
        } else {
            console.log('Bootstrap is already loaded');
            initializeApp();
        }
    });
})();