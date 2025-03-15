/**
 * app.js - Main entry point for TrackJobs application
 * Optimized for faster loading and better error handling
 */

// Use self-executing function to avoid polluting global scope
(function() {
    // Define script paths in load order
    const scripts = [
        '/js/core.js',
        '/js/status-management.js',
        '/js/modal.js',
        '/js/job-display.js',
        '/js/search.js',
        '/js/scraper.js',
        '/js/inline-scripts.js'  // Load this last
    ];
    
    // Initialize global state object early
    window.trackjobs = window.trackjobs || {
        currentJobs: [],
        initialized: false,
        elements: {},
        version: '1.0.1' // Add versioning for cache busting
    };
    
    /**
     * Load scripts in sequence with improved error handling and performance monitoring
     * @param {Array} scriptPaths - Array of script paths to load
     * @param {Number} index - Current index in the array
     */
    function loadScripts(scriptPaths, index = 0) {
        if (index >= scriptPaths.length) {
            console.log('All scripts loaded successfully');
            return;
        }
        
        const script = document.createElement('script');
        const scriptPath = scriptPaths[index];
        // Add cache busting for development only
        script.src = scriptPath + (location.hostname === 'localhost' ? `?v=${Date.now()}` : '');
        script.async = false; // Ensure scripts load in order
        
        // Track script loading performance
        const startTime = performance.now();
        
        script.onload = () => {
            const loadTime = Math.round(performance.now() - startTime);
            console.log(`Loaded: ${scriptPath} (${loadTime}ms)`);
            loadScripts(scriptPaths, index + 1);
        };
        
        script.onerror = (e) => {
            console.error(`Error loading ${scriptPath}:`, e);
            
            // Show more user-friendly error
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger';
            alertDiv.style.position = 'fixed';
            alertDiv.style.top = '10px';
            alertDiv.style.right = '10px';
            alertDiv.style.zIndex = '9999';
            alertDiv.innerHTML = `<strong>Error:</strong> Failed to load ${scriptPath.split('/').pop()}. Try refreshing the page.`;
            document.body.appendChild(alertDiv);
            
            // Continue loading other scripts after a short delay
            setTimeout(() => {
                loadScripts(scriptPaths, index + 1);
            }, 500);
        };
        
        document.body.appendChild(script);
    }
    
    // Start loading scripts when the document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Loading TrackJobs application scripts...');
            loadScripts(scripts);
        });
    } else {
        // Document already loaded
        console.log('Document already loaded, starting script loading...');
        loadScripts(scripts);
    }
})();