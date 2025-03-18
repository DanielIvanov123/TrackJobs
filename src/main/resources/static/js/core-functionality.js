/**
 * core-functionality.js - Consolidated functionality with fixed status filtering
 * Performance-focused implementation with improved status handling
 */

(function() {
    // Cache for DOM elements to avoid repeated lookups
    const DOM = {};
    
    // Cache for CSRF tokens
    let csrfToken, csrfHeader;
    
    // Cache for formatted dates to avoid repeated calculations
    const dateCache = {};
    
    // Status constant maps for quick lookups
    const STATUS = {
        DISPLAY_NAMES: {
            'SAVED': 'Saved',
            'APPLIED': 'Applied',
            'INTERVIEWING': 'Interviewing',
            'REJECTED': 'Rejected',
            'OFFER': 'Offer'
        },
        ICONS: {
            'SAVED': '<i class="bi bi-bookmark"></i>',
            'APPLIED': '<i class="bi bi-send"></i>',
            'INTERVIEWING': '<i class="bi bi-people"></i>',
            'REJECTED': '<i class="bi bi-x-circle"></i>',
            'OFFER': '<i class="bi bi-trophy"></i>'
        }
    };
    
    // Debounce delay for inputs
    const DEBOUNCE_DELAY = 300;
    
    // Maximum batch size for DOM operations
    const MAX_BATCH_SIZE = 20;
    
    // Initialize application when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        console.time('Initialization');
    
        // Initialize global state with empty objects to avoid null checks
        window.trackjobs = window.trackjobs || {
            currentJobs: [],
            initialized: false,
            elements: {},
            activeTab: 'search', // Track the current active tab
            newJobsAvailable: false // Flag for newly scraped jobs
        };
        
        // Cache CSRF tokens immediately
        initializeCsrfTokens();
        
        // Register main event handlers using delegation
        registerEventHandlers();
        
        // Initialize functionality modules
        initializeTabNavigation();
        initializeStatusFilters();
        initializeSearchFunctionality();
        initializeJobStatusUpdates();
        initializeScraperFunctionality();
        initializeDataManagement();
        
        // Load saved configs if on scraper tab
        if (getElement('scraperTabContent').style.display !== 'none') {
            loadSavedConfigs();
        }
        
        // Set up visibility change listener to refresh job listings when returning to the page
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible') {
                // Check if we're on the search tab and new jobs are available
                if (window.trackjobs.activeTab === 'search' && window.trackjobs.newJobsAvailable) {
                    console.log('Page became visible, refreshing job listings');
                    window.trackjobs.newJobsAvailable = false;
                    setTimeout(() => searchJobs(true), 100);
                }
            }
        });
        
        // Trigger initial search if on search tab
        if (getElement('searchTabContent').style.display !== 'none') {
            // Use setTimeout to allow UI to render first
            setTimeout(function() {
                getElement('searchButton').click();
            }, 0);
        }
        
        console.timeEnd('Initialization');
        console.log('Core functionality initialized');
    });
    
    /**
     * Cache and get DOM elements efficiently
     * @param {String} id - Element ID
     * @return {HTMLElement} The DOM element
     */
    function getElement(id) {
        if (!DOM[id]) {
            DOM[id] = document.getElementById(id);
        }
        return DOM[id];
    }
    
    /**
     * Get element by selector with caching
     * @param {String} selector - CSS selector
     * @return {HTMLElement} The first matching DOM element
     */
    function querySelector(selector) {
        const cacheKey = `qs_${selector}`;
        if (!DOM[cacheKey]) {
            DOM[cacheKey] = document.querySelector(selector);
        }
        return DOM[cacheKey];
    }
    
    /**
     * Initialize CSRF tokens once
     */
    function initializeCsrfTokens() {
        csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute('content');
        csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.getAttribute('content');
        
        if (!csrfToken || !csrfHeader) {
            console.error('CSRF tokens not found - security features will not work');
        }
    }
    
    /**
     * Register main event handlers using efficient delegation
     */
    function registerEventHandlers() {
        // Use single document click handler for many interactions
        document.addEventListener('click', function(event) {
            // View details buttons
            if (event.target.closest('.view-job-details-btn')) {
                handleViewDetails(event);
                return;
            }
            
            // Job card clicks (not on controls)
            if (!event.target.closest('button') && 
                !event.target.closest('a') && 
                !event.target.closest('select')) {
                const jobCard = event.target.closest('.job-card');
                if (jobCard) {
                    handleJobCardClick(jobCard);
                    return;
                }
            }
            
            // Status filter pills
            if (event.target.closest('.status-filter-pill')) {
                handleStatusFilterClick(event.target.closest('.status-filter-pill'));
                return;
            }
            
            // Save config button
            if (event.target.closest('#saveConfigBtn')) {
                openSaveConfigModal();
                return;
            }
            
            // Save config confirm button
            if (event.target.closest('#saveConfigConfirmBtn')) {
                saveCurrentConfig();
                return;
            }
            
            // View all jobs button
            if (event.target.closest('#viewAllJobsBtn')) {
                handleViewAllJobs();
                return;
            }
            
            // Delete config button
            if (event.target.closest('.delete-config-btn')) {
                const btn = event.target.closest('.delete-config-btn');
                handleDeleteConfig(btn, event);
                return;
            }
            
            // Config link click
            if (event.target.closest('#savedConfigsList a')) {
                const link = event.target.closest('#savedConfigsList a');
                handleConfigClick(link, event);
            }
        });
        
        // Handle status select changes
        document.addEventListener('change', function(event) {
            if (event.target.classList.contains('job-status-select')) {
                handleStatusChange(event.target);
            }
        });
        
        // Handle search button click
        getElement('searchButton')?.addEventListener('click', function() {
            searchJobs(true); // Update counts when search button is explicitly clicked
        });
        
        // Handle search input with debounce
        const searchKeywords = getElement('searchKeywords');
        const searchLocation = getElement('searchLocation');
        
        if (searchKeywords) {
            searchKeywords.addEventListener('input', debounce(function() {
                searchJobs(true); // Update counts when search terms change
            }, DEBOUNCE_DELAY));
        }
        
        if (searchLocation) {
            searchLocation.addEventListener('input', debounce(function() {
                searchJobs(true); // Update counts when search terms change
            }, DEBOUNCE_DELAY));
        }
        
        // Handle scrape button click
        getElement('scrapeButton')?.addEventListener('click', startScraping);
        
        // Handle sort change
        getElement('sortOption')?.addEventListener('change', handleSortChange);
    }
    
    /**
     * Initialize tab navigation
     */
    function initializeTabNavigation() {
        getElement('searchTabLink')?.addEventListener('click', function(e) {
            e.preventDefault();
            switchToTab('search');
        });
        
        getElement('scraperTabLink')?.addEventListener('click', function(e) {
            e.preventDefault();
            switchToTab('scraper');
        });
    }
    
    /**
     * Switch between tabs with automatic job listing updates
     * @param {String} tab - Tab name (search or scraper)
     */
    function switchToTab(tab) {
        // Cache elements
        const searchTabLink = getElement('searchTabLink');
        const scraperTabLink = getElement('scraperTabLink');
        const searchTabContent = getElement('searchTabContent');
        const scraperTabContent = getElement('scraperTabContent');
        
        // Track if we're switching to search from another tab
        const wasSearchHidden = searchTabContent.style.display === 'none';
        
        if (tab === 'search') {
            // Update classes in batch
            searchTabLink.classList.add('active');
            scraperTabLink.classList.remove('active');
            
            // Use direct style changes for better performance
            searchTabContent.style.display = 'block';
            scraperTabContent.style.display = 'none';
            
            // Refresh job listings if we're coming from another tab
            if (wasSearchHidden) {
                console.log('Refreshing job listings after tab switch');
                // Use setTimeout to ensure the UI updates first
                setTimeout(() => {
                    searchJobs(true); // true = update counts
                }, 50);
            }
        } else {
            // Update classes in batch
            searchTabLink.classList.remove('active');
            scraperTabLink.classList.add('active');
            
            // Use direct style changes for better performance
            searchTabContent.style.display = 'none';
            scraperTabContent.style.display = 'block';
            
            // Load saved configs if needed
            if (!DOM.configsLoaded) {
                loadSavedConfigs();
                DOM.configsLoaded = true;
            }
        }
        
        // Store the current active tab for future reference
        window.trackjobs.activeTab = tab;
    }
        
    /**
     * Initialize status filters
     */
    function initializeStatusFilters() {
        // Select the "All Jobs" filter by default
        const allJobsFilter = document.querySelector('.status-filter-pill.all-jobs');
        if (allJobsFilter) {
            allJobsFilter.classList.add('active');
        }
        
        // Set the hidden input value to "ALL"
        const statusInput = getElement('searchApplicationStatus');
        if (statusInput) {
            statusInput.value = 'ALL';
        }
        
        // Load initial counts when page loads
        updateStatusCounts(window.trackjobs.currentJobs || []);
    }
    
    /**
     * Handle status filter pill click
     * @param {HTMLElement} pill - The clicked filter pill
     */
    function handleStatusFilterClick(pill) {
        // Update active states in batch
        document.querySelectorAll('.status-filter-pill').forEach(p => 
            p.classList.remove('active'));
        pill.classList.add('active');
        
        // Animate click effect
        pill.style.transform = 'scale(1.05)';
        setTimeout(() => {
            pill.style.transform = '';
        }, 200);
        
        // Set filter value
        const status = pill.getAttribute('data-status');
        getElement('searchApplicationStatus').value = status;
        
        console.log('Status filter selected:', status);
        
        // Trigger search but don't update counts - they should remain static
        searchJobs(false); // Pass false to indicate we shouldn't update counts
    }
    
    /**
     * Initialize job status update functionality
     */
    function initializeJobStatusUpdates() {
        // No need to add event listeners - handled by delegation
    }
    
    /**
     * Handle status change from select dropdown
     * @param {HTMLElement} select - The changed select element
     */
    function handleStatusChange(select) {
        const jobId = select.getAttribute('data-job-id');
        const newStatus = select.value;
        
        console.log(`Status change: Job ${jobId} to ${newStatus}`);
        
        // Find status badge
        const statusBadge = document.querySelector(`.status-badge[data-job-id="${jobId}"]`);
        if (!statusBadge) return;
        
        // Show updating indicator
        const originalContent = statusBadge.innerHTML;
        statusBadge.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i> Updating...';
        
        // Verify CSRF tokens
        if (!csrfToken || !csrfHeader) {
            console.error('CSRF tokens not found');
            showAlert('Security tokens not found. Please refresh the page.', 'danger');
            statusBadge.innerHTML = originalContent;
            return;
        }
        
        // Update via API
        fetch(`/api/jobs/${jobId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify({ status: newStatus })
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Update UI elements
                updateJobCardStatus(jobId, newStatus);
                
                // Update data in memory
                if (window.trackjobs.currentJobs) {
                    const jobIndex = window.trackjobs.currentJobs.findIndex(j => j.id == jobId);
                    if (jobIndex !== -1) {
                        window.trackjobs.currentJobs[jobIndex].applicationStatus = newStatus;
                        updateStatusCounts(window.trackjobs.currentJobs);
                    }
                }
                
                // Check if we need to refresh the job list
                const activeFilter = document.querySelector('.status-filter-pill.active');
                const activeStatus = activeFilter ? activeFilter.getAttribute('data-status') : 'ALL';
                
                // Refresh search if we're not showing all jobs and the status has changed away from the filter
                if (activeStatus !== 'ALL' && activeStatus !== newStatus) {
                    searchJobs();
                }
                
                showAlert(`Job status updated to ${STATUS.DISPLAY_NAMES[newStatus]}`, 'success');
            } else {
                throw new Error(data.message || 'Update failed');
            }
        })
        .catch(error => {
            console.error('Error updating status:', error);
            showAlert(`Error: ${error.message}`, 'danger');
            
            // Revert UI
            statusBadge.innerHTML = originalContent;
            select.value = extractStatusFromClass(statusBadge.className);
        });
    }
    
    /**
     * Extract status code from class name
     * @param {String} className - Class string containing status-XXX
     * @return {String} Status code or 'SAVED' as default
     */
    function extractStatusFromClass(className) {
        const match = /status-(\w+)/.exec(className);
        return match ? match[1] : 'SAVED';
    }
    
    /**
     * Update job card status visuals
     * @param {String|Number} jobId - ID of the job
     * @param {String} newStatus - New status value
     */
    function updateJobCardStatus(jobId, newStatus) {
        // Get required elements
        const jobCard = document.querySelector(`.job-card[data-job-id="${jobId}"]`);
        const statusBadge = document.querySelector(`.status-badge[data-job-id="${jobId}"]`);
        if (!jobCard || !statusBadge) return;
        
        // Get display info
        const statusDisplay = STATUS.DISPLAY_NAMES[newStatus];
        const statusIcon = STATUS.ICONS[newStatus];
        
        // Update using classList for better performance
        ['SAVED', 'APPLIED', 'INTERVIEWING', 'REJECTED', 'OFFER'].forEach(status => {
            jobCard.classList.remove(`status-${status}`);
            statusBadge.classList.remove(`status-${status}`);
        });
        
        jobCard.classList.add(`status-${newStatus}`);
        statusBadge.classList.add(`status-${newStatus}`);
        
        // Update badge content
        statusBadge.innerHTML = `${statusIcon} ${statusDisplay}`;
        
        // Handle ribbon (add/remove) - batch DOM operations
        const existingRibbon = jobCard.querySelector('.status-ribbon');
        
        if (newStatus !== 'SAVED') {
            if (existingRibbon) {
                // Update existing ribbon (2 operations)
                existingRibbon.className = `status-ribbon status-${newStatus}`;
                existingRibbon.textContent = statusDisplay;
            } else {
                // Create new ribbon (1 operation)
                const ribbon = document.createElement('div');
                ribbon.className = `status-ribbon status-${newStatus}`;
                ribbon.textContent = statusDisplay;
                jobCard.appendChild(ribbon);
            }
        } else if (existingRibbon) {
            // Remove ribbon (1 operation)
            existingRibbon.remove();
        }
        
        console.log('Updated job card status:', jobId, newStatus);
    }
    
    /**
     * Initialize search functionality
     */
    function initializeSearchFunctionality() {
        // Event handlers registered in main registration function
        
        // Load initial job counts only on first page load
        if (!window.trackjobs.countsInitialized) {
            // Set flag to prevent reloading
            window.trackjobs.countsInitialized = true;
            
            // Initial search will update counts
            setTimeout(() => {
                // Get the "All Jobs" count from the server first to set initial counts
                searchJobs(true); // true = update counts
            }, 100);
        }
    }
    
    /**
     * Handle search button click with optimized processing
     */
    function searchJobs(updateCounts = true) {
        console.time('Search');
        
        // Get search parameters once
        const params = getSearchParams();
        
        // Get the jobs container
        const jobsContainer = document.getElementById('jobsContainer');
        
        // Check if this is the first search (container is empty)
        const isFirstSearch = !jobsContainer || jobsContainer.children.length === 0;
        
        // For first-time searches only, show a loading indicator
        // Otherwise, keep the existing content visible
        if (isFirstSearch && jobsContainer) {
            jobsContainer.innerHTML = `
                <div class="col-12 text-center my-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Searching jobs...</p>
                </div>
            `;
        } else {
            // For subsequent searches, just add a small indicator to the top of the page
            addSearchingIndicator();
        }
        
        // Check for required tokens
        if (!csrfToken || !csrfHeader) {
            console.error('CSRF tokens not found');
            
            if (isFirstSearch && jobsContainer) {
                jobsContainer.innerHTML = `
                    <div class="col-12 text-center">
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-circle-fill me-2"></i>
                            Security tokens not found. Please refresh the page.
                        </div>
                    </div>
                `;
            } else {
                // Show toast for non-first search
                showAlert('Security tokens not found. Please refresh the page.', 'danger');
            }
            return;
        }
        
        // Execute search
        fetch(`/api/jobs/search?${params.toString()}`, {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(jobs => {
            // Store in global state (shared memory)
            window.trackjobs.currentJobs = jobs;
            
            // Update counts only on initial load or when explicitly requested
            if (updateCounts) {
                updateStatusCounts(jobs);
            }
            
            // Sort jobs based on current sort option
            const sortOption = getElement('sortOption')?.value || 'datePosted';
            const sortedJobs = sortJobs(jobs, sortOption);
            
            // Update job count displays
            const jobsCount = getElement('jobsCount');
            if (jobsCount) {
                jobsCount.textContent = jobs.length;
            }
            
            // Update count text
            const countTextElement = getElement('jobsCountText');
            if (countTextElement) {
                const sortDisplayName = getSortDisplayName(sortOption);
                countTextElement.innerHTML = `Showing <span id="jobsCount">${jobs.length}</span> jobs (sorted by ${sortDisplayName})`;
            }
            
            // Efficiently display jobs
            displayJobs(sortedJobs);
            
            // Remove searching indicator if it exists
            removeSearchingIndicator();
            
            console.timeEnd('Search');
        })
        .catch(error => {
            console.error('Error searching jobs:', error);
            
            // Remove searching indicator
            removeSearchingIndicator();
            
            if (isFirstSearch && jobsContainer) {
                jobsContainer.innerHTML = `
                    <div class="col-12 text-center">
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-circle-fill me-2"></i>
                            Error searching jobs: ${error.message}
                        </div>
                        <button class="btn btn-outline-primary mt-3" onclick="searchJobs()">
                            <i class="bi bi-arrow-clockwise me-2"></i>Try Again
                        </button>
                    </div>
                `;
            } else {
                // Show error toast instead of clearing content
                showAlert(`Error searching jobs: ${error.message}`, 'danger');
            }
        });
    }
    
    /**
     * Add a small searching indicator to the top of the page
     */
    function addSearchingIndicator() {
        // Remove any existing indicator first
        removeSearchingIndicator();
        
        // Create indicator
        const indicator = document.createElement('div');
        indicator.id = 'searchingIndicator';
        indicator.className = 'searching-indicator';
        indicator.innerHTML = `
            <div class="searching-status">
                <div class="searching-dot"></div>
                <span>Searching...</span>
            </div>
        `;
        
        // Add styles if they don't exist
        if (!document.getElementById('searching-indicator-styles')) {
            const styles = document.createElement('style');
            styles.id = 'searching-indicator-styles';
            styles.textContent = `
                .searching-indicator {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background-color: rgba(255, 255, 255, 0.9);
                    padding: 8px 15px;
                    border-radius: 4px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    z-index: 1000;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                }
                .searching-status {
                    display: flex;
                    align-items: center;
                }
                .searching-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background-color: #007bff;
                    margin-right: 8px;
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 0.4; }
                    50% { opacity: 1; }
                    100% { opacity: 0.4; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Add to document
        document.body.appendChild(indicator);
    }
    
    /**
     * Remove the searching indicator
     */
    function removeSearchingIndicator() {
        const indicator = document.getElementById('searchingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    /**
     * Get search parameters efficiently
     * @return {URLSearchParams} URL search parameters
     */
    function getSearchParams() {
        const params = new URLSearchParams();
        
        // Get values once
        const keywords = getElement('searchKeywords')?.value?.trim();
        const location = getElement('searchLocation')?.value?.trim();
        const experienceLevel = getElement('searchExperienceLevel')?.value;
        const jobType = getElement('searchJobType')?.value;
        const daysOld = parseInt(getElement('searchDatePosted')?.value || '0');
        const remoteOnly = getElement('searchRemoteOnly')?.checked || false;
        const applicationStatus = getElement('searchApplicationStatus')?.value;
        
        // Debug output
        console.log('Search params - applicationStatus:', applicationStatus);
        
        // Only add non-empty parameters for smaller request
        if (keywords) params.append('keywords', keywords);
        if (location) params.append('location', location);
        if (experienceLevel) params.append('experienceLevel', experienceLevel);
        if (jobType) params.append('jobType', jobType);
        if (daysOld > 0) params.append('daysOld', daysOld.toString());
        params.append('remoteOnly', remoteOnly.toString());
        if (applicationStatus && applicationStatus !== 'ALL') {
            params.append('applicationStatus', applicationStatus);
        }
        
        return params;
    }
    
    /**
     * Handle sort option change
     */
    function handleSortChange() {
        const sortOption = this.value;
        
        // Only sort if we have jobs in memory
        if (window.trackjobs.currentJobs?.length > 0) {
            const sortedJobs = sortJobs(window.trackjobs.currentJobs, sortOption);
            
            // Update display
            const jobsCountElement = getElement('jobsCount');
            const countTextElement = getElement('jobsCountText');
            
            if (countTextElement) {
                const sortDisplayName = getSortDisplayName(sortOption);
                countTextElement.innerHTML = `Showing <span id="jobsCount">${sortedJobs.length}</span> jobs (sorted by ${sortDisplayName})`;
            }
            
            // Update the jobsCount reference if it changed
            if (jobsCountElement !== getElement('jobsCount')) {
                DOM.jobsCount = getElement('jobsCount');
            }
            
            // Display sorted jobs
            displayJobs(sortedJobs);
        } else {
            // If no jobs in memory, trigger a new search
            searchJobs();
        }
    }
    
    /**
     * Get display name for sort option
     * @param {String} sortOption - Sort option key
     * @return {String} Human-readable sort name
     */
    function getSortDisplayName(sortOption) {
        const names = {
            'datePosted': 'newest',
            'datePostedAsc': 'oldest',
            'status': 'application status',
            'company': 'company name',
            'title': 'job title'
        };
        return names[sortOption] || sortOption;
    }
    
    /**
     * Sort jobs with optimized algorithms
     * @param {Array} jobs - Array of job objects
     * @param {String} sortBy - Sorting criteria
     * @return {Array} Sorted jobs array
     */
    function sortJobs(jobs, sortBy) {
        if (!jobs || !jobs.length) return jobs;
        
        // Create a shallow copy for sorting
        const sortedJobs = jobs.slice();
        
        // Define sort functions - optimize with local variables
        switch(sortBy) {
            case 'datePosted':
                return sortedJobs.sort((a, b) => {
                    // Use nullish coalescing for cleaner code
                    const dateA = a.datePosted ? new Date(a.datePosted) : new Date(0);
                    const dateB = b.datePosted ? new Date(b.datePosted) : new Date(0);
                    return dateB - dateA; // Descending
                });
                
            case 'datePostedAsc':
                return sortedJobs.sort((a, b) => {
                    const dateA = a.datePosted ? new Date(a.datePosted) : new Date(0);
                    const dateB = b.datePosted ? new Date(b.datePosted) : new Date(0);
                    return dateA - dateB; // Ascending
                });
                
            case 'status':
                // Define order once outside the sort function
                const statusOrder = {
                    'OFFER': 1,
                    'INTERVIEWING': 2,
                    'APPLIED': 3,
                    'SAVED': 4,
                    'REJECTED': 5
                };
                
                return sortedJobs.sort((a, b) => {
                    // Ensure we have a valid status or default to SAVED
                    const statusA = statusOrder[a.applicationStatus || 'SAVED'] || 4; // Default to SAVED (4)
                    const statusB = statusOrder[b.applicationStatus || 'SAVED'] || 4;
                    return statusA - statusB;
                });
                
            case 'company':
                return sortedJobs.sort((a, b) => 
                    (a.company || '').localeCompare(b.company || ''));
                    
            case 'title':
                return sortedJobs.sort((a, b) => 
                    (a.title || '').localeCompare(b.title || ''));
                    
            default:
                return sortedJobs;
        }
    }
    
    /**
     * Open job details modal with optimized loading
     * @param {String|Number} jobId - ID of the job
     */
    function openJobDetailsModal(jobId) {
        // Don't use console.time here - it's causing the "Timer already exists" error
        
        // Cache modal elements
        const modal = document.getElementById('jobDetailsModal');
        const spinner = document.getElementById('jobDetailsSpinner');
        const content = document.getElementById('jobDetailsContent');
        const errorMsg = document.getElementById('jobDetailsError');
        
        if (!modal) {
            console.error('Job details modal not found');
            return;
        }
        
        // Show modal immediately for better UX
        try {
            // Check if Bootstrap is properly loaded
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                // First check if there's an existing modal instance
                let modalInstance = bootstrap.Modal.getInstance(modal);
                
                // If no instance exists, create a new one
                if (!modalInstance) {
                    modalInstance = new bootstrap.Modal(modal, {
                        backdrop: true,
                        keyboard: true,
                        focus: true
                    });
                }
                
                modalInstance.show();
            } else {
                console.warn('Bootstrap not available, using fallback modal display');
                // Fallback to manual showing if Bootstrap is not available
                modal.style.display = 'block';
                modal.classList.add('show');
                document.body.classList.add('modal-open');
                
                // Add backdrop if it doesn't exist
                let backdrop = document.querySelector('.modal-backdrop');
                if (!backdrop) {
                    backdrop = document.createElement('div');
                    backdrop.className = 'modal-backdrop fade show';
                    document.body.appendChild(backdrop);
                }
            }
        } catch (e) {
            console.error('Error showing modal:', e);
            // Fallback to simple display
            if (modal) {
                modal.style.display = 'block';
            }
        }
        
        // Prepare modal for loading
        if (spinner) spinner.style.display = 'block';
        if (content) content.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';
        
        // Check for cached job data in memory
        if (window.trackjobs && window.trackjobs.currentJobs) {
            const cachedJob = window.trackjobs.currentJobs.find(job => job.id == jobId);
            if (cachedJob && cachedJob.description) {
                // Use cached data
                console.log('Using cached job data');
                displayJobDetails(cachedJob);
                return;
            }
        }
        
        // Not in cache, load from API
        const csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.getAttribute('content');
        
        if (!csrfToken || !csrfHeader) {
            showModalError('Security tokens not found. Please refresh the page.');
            return;
        }
        
        // Fetch job details
        fetch(`/api/jobs/${jobId}`, {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(job => {
            // Cache job data for future use
            if (window.trackjobs && window.trackjobs.currentJobs) {
                const jobIndex = window.trackjobs.currentJobs.findIndex(j => j.id == jobId);
                if (jobIndex !== -1) {
                    window.trackjobs.currentJobs[jobIndex] = job;
                }
            }
            
            displayJobDetails(job);
        })
        .catch(error => {
            console.error('Error fetching job details:', error);
            showModalError(`Error loading job details: ${error.message}`);
        });
    }
    
    /**
     * Show error message in modal
     * @param {String} message - Error message
     */
    function showModalError(message) {
        const spinner = document.getElementById('jobDetailsSpinner');
        const content = document.getElementById('jobDetailsContent');
        const errorMsg = document.getElementById('jobDetailsError');
        
        if (spinner) spinner.style.display = 'none';
        if (content) content.style.display = 'none';
        
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        }
    }
    
    /**
     * Handle view details button click
     * @param {Event} event - Click event
     */
    function handleViewDetails(event) {
        event.preventDefault();
        
        const btn = event.target.closest('.view-job-details-btn');
        if (!btn) return;
        
        const jobId = btn.getAttribute('data-job-id');
        
        if (jobId) {
            openJobDetailsModal(jobId);
        }
    }
    
    /**
     * Handle job card click
     * @param {HTMLElement} jobCard - The clicked job card
     */
    function handleJobCardClick(jobCard) {
        if (!jobCard) return;
        
        const jobId = jobCard.getAttribute('data-job-id');
        if (jobId) {
            openJobDetailsModal(jobId);
        }
    }
    
    /**
     * Manually show modal if Bootstrap is unavailable
     * @param {HTMLElement} modal - Modal element
     */
    function manuallyShowModal(modal) {
        modal.classList.add('show');
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        // Add backdrop
        let backdrop = document.querySelector('.modal-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            document.body.appendChild(backdrop);
        }
    }
    
    /**
     * Display job details in modal with improved description handling
     * @param {Object} job - Job data
     */
    function displayJobDetails(job) {
        if (!job) return;
        
        // Update text content - batch DOM operations
        batchDomUpdates([
            { id: 'jobDetailTitle', textContent: job.title || 'Untitled Job' },
            { id: 'jobDetailCompany', textContent: job.company || 'Unknown Company' },
            { id: 'jobDetailLocation', textContent: job.location || 'Not specified' },
            { id: 'jobDetailJobType', textContent: job.jobType || 'Not specified' },
            { id: 'jobDetailExperienceLevel', textContent: job.experienceLevel || 'Not specified' },
            { id: 'jobDetailPosted', textContent: formatDate(job.datePosted) },
            { id: 'jobDetailScraped', textContent: formatDate(job.dateScraped) }
        ]);
        
        // Set status selection
        const status = job.applicationStatus || 'SAVED';
        const radios = document.querySelectorAll('.job-status-selector input[name="jobStatus"]');
        
        // Remove existing listeners and set state
        radios.forEach(radio => {
            const newRadio = radio.cloneNode(true);
            newRadio.checked = newRadio.value === status;
            
            // Add listener to new radio
            newRadio.addEventListener('change', function() {
                if (this.checked) {
                    updateJobStatusFromModal(job.id, this.value);
                }
            });
            
            radio.parentNode.replaceChild(newRadio, radio);
        });
        
        // Format description with improved error handling
        const descElement = getElement('jobDetailDescription');
        if (descElement) {
            if (job.description) {
                try {
                    descElement.innerHTML = formatJobDescription(job.description);
                    console.log(`Displayed job description (${job.description.length} chars)`);
                } catch (e) {
                    console.error('Error displaying job description:', e);
                    descElement.innerHTML = `<p class="text-danger">Error displaying description. Length: ${job.description.length} chars</p>`;
                    descElement.innerHTML += `<pre class="small bg-light p-2">${job.description.slice(0, 100)}...</pre>`;
                }
            } else {
                descElement.innerHTML = '<p class="text-muted">No detailed description available for this job.</p>';
            }
        }
        
        // Set LinkedIn link
        const linkedInLink = getElement('jobDetailLinkedInLink');
        if (linkedInLink) {
            if (job.url) {
                linkedInLink.href = job.url;
                linkedInLink.style.display = 'inline-block';
            } else {
                linkedInLink.style.display = 'none';
            }
        }
        
        // Set Claude AI document generation buttons job ID
        const generateTailoredResumeBtn = getElement('generateTailoredResumeBtn');
        const generateCoverLetterBtn = getElement('generateCoverLetterBtn');
        
        if (generateTailoredResumeBtn) {
            generateTailoredResumeBtn.dataset.jobId = job.id;
        }
        
        if (generateCoverLetterBtn) {
            generateCoverLetterBtn.dataset.jobId = job.id;
        }
        
        // Show content, hide spinner
        getElement('jobDetailsSpinner').style.display = 'none';
        getElement('jobDetailsContent').style.display = 'block';
    }
        
    /**
     * Batch multiple DOM updates for better performance
     * @param {Array} updates - Array of {id, prop, value} objects
     */
    function batchDomUpdates(updates) {
        // Use requestAnimationFrame for optimal timing
        requestAnimationFrame(() => {
            updates.forEach(update => {
                const element = getElement(update.id);
                if (element) {
                    if (update.textContent !== undefined) {
                        element.textContent = update.textContent;
                    } else if (update.html !== undefined) {
                        element.innerHTML = update.html;
                    } else if (update.prop && update.value !== undefined) {
                        element[update.prop] = update.value;
                    }
                }
            });
        });
    }
    
    /**
     * Show error message in modal
     * @param {String} message - Error message
     */
    function showModalError(message) {
        const spinner = getElement('jobDetailsSpinner');
        const content = getElement('jobDetailsContent');
        const errorMsg = getElement('jobDetailsError');
        
        if (spinner) spinner.style.display = 'none';
        if (content) content.style.display = 'none';
        
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        }
    }
    
    /**
     * Update job status from modal
     * @param {String|Number} jobId - ID of the job
     * @param {String} newStatus - New status value
     */
    function updateJobStatusFromModal(jobId, newStatus) {
        if (!csrfToken || !csrfHeader) {
            showAlert('Security tokens not found. Please refresh the page.', 'danger');
            return;
        }
        
        fetch(`/api/jobs/${jobId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify({ status: newStatus })
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Update UI
                const jobCard = document.querySelector(`.job-card[data-job-id="${jobId}"]`);
                if (jobCard) {
                    updateJobCardStatus(jobId, newStatus);
                }
                
                // Update in memory
                if (window.trackjobs.currentJobs) {
                    const jobIndex = window.trackjobs.currentJobs.findIndex(j => j.id == jobId);
                    if (jobIndex !== -1) {
                        window.trackjobs.currentJobs[jobIndex].applicationStatus = newStatus;
                        updateStatusCounts(window.trackjobs.currentJobs);
                    }
                }
                
                // Check if we need to refresh job list due to filtering
                const activeFilter = document.querySelector('.status-filter-pill.active');
                const activeStatus = activeFilter ? activeFilter.getAttribute('data-status') : 'ALL';
                
                if (activeStatus !== 'ALL' && activeStatus !== newStatus) {
                    // Job status changed and we're filtering - need to refresh
                    setTimeout(() => searchJobs(), 500);
                }
                
                showAlert(`Job status updated to ${STATUS.DISPLAY_NAMES[newStatus]}`, 'success');
            } else {
                throw new Error(data.message || 'Update failed');
            }
        })
        .catch(error => {
            console.error('Error updating status:', error);
            showAlert(`Error: ${error.message}`, 'danger');
        });
    }
    
    /**
     * Initialize scraper functionality
     */
    function initializeScraperFunctionality() {
        // Event handlers registered in main registration function
        
        // Initialize experience level select/clear buttons
        getElement('selectAllInclude')?.addEventListener('click', function() {
            document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
                checkbox.checked = true;
            });
        });

        getElement('clearAllInclude')?.addEventListener('click', function() {
            document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
                checkbox.checked = false;
            });
        });
    }
    
    /**
     * Start scraping process
     */
    function startScraping() {
        console.time('ScrapingStart');
        
        // Validate form
        const keywords = getElement('keywords')?.value?.trim();
        const location = getElement('location')?.value?.trim();
        
        if (!keywords || !location) {
            showAlert('Please enter both keywords and location', 'warning');
            return;
        }
        
        // Get form values
        const pagesToScrape = parseInt(getElement('pagesToScrape')?.value || 1);
        const remoteOnly = getElement('remoteOnly')?.checked || false;
        const jobType = getElement('jobType')?.value || '';
        const daysOld = parseInt(getElement('daysOld')?.value || 7);
        
        // Get advanced filters
        const titleIncludeWords = getElement('titleIncludeWords')?.value || '';
        const titleExcludeWords = getElement('titleExcludeWords')?.value || '';
        const companyExcludeWords = getElement('companyExcludeWords')?.value || '';
        const descriptionExcludeWords = getElement('descriptionExcludeWords')?.value || '';
        
        // Get experience levels in one batch
        const experienceLevelInclude = Array.from(
            document.querySelectorAll('input[name="expInclude"]:checked')
        ).map(cb => cb.value);
        
        // Create payload
        const payload = {
            keywords,
            location,
            pagesToScrape,
            remoteOnly,
            jobType,
            daysOld,
            titleIncludeWords: titleIncludeWords ? titleIncludeWords.split(',').map(s => s.trim()) : [],
            titleExcludeWords: titleExcludeWords ? titleExcludeWords.split(',').map(s => s.trim()) : [],
            companyExcludeWords: companyExcludeWords ? companyExcludeWords.split(',').map(s => s.trim()) : [],
            descriptionExcludeWords: descriptionExcludeWords ? descriptionExcludeWords.split(',').map(s => s.trim()) : [],
            experienceLevelInclude
        };
        
        // Show loading and reset UI state
        getElement('loadingIndicator').style.display = 'block';
        getElement('scrapeButton').disabled = true;
        
        const progressBar = getElement('scrapeProgressBar');
        const progressBarText = getElement('progressBarText');
        
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', '0');
        progressBarText.textContent = 'Starting scrape...';
        
        // Clear status updates
        const statusUpdatesList = getElement('statusUpdatesList');
        statusUpdatesList.innerHTML = '';
        addStatusUpdate(`Initializing scrape for "${keywords}" in "${location}"`);
        
        // Check tokens
        if (!csrfToken || !csrfHeader) {
            addStatusUpdate('Error: Security tokens not found. Please refresh the page.');
            getElement('loadingIndicator').style.display = 'none';
            getElement('scrapeButton').disabled = false;
            return;
        }
        
        // Calculate estimated completion time based on pages and experience levels
        const totalPages = pagesToScrape;
        const totalExpLevels = experienceLevelInclude.length || 1;
        const estimatedTimePerPage = 20; // seconds
        const estimatedTimeInSeconds = totalPages * totalExpLevels * estimatedTimePerPage;
        
        // Log estimated time
        const estimatedMinutes = Math.ceil(estimatedTimeInSeconds / 60);
        addStatusUpdate(`Estimated completion time: ~${estimatedMinutes} minutes (${totalPages} pages × ${totalExpLevels} experience levels)`);
        
        // Start scrape
        fetch('/api/jobs/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.timeEnd('ScrapingStart');
            
            if (data.success) {
                const scrapeId = data.scrapeId;
                addStatusUpdate('Scrape started successfully. ID: ' + scrapeId);
                
                // Setup progress polling with timeout
                const pollInterval = setInterval(() => {
                    pollScrapeProgress(scrapeId, pollInterval);
                }, 1000);
                
                // Calculate a more appropriate timeout based on the estimated completion time
                // Minimum 15 minutes, maximum 60 minutes
                const minTimeout = 15 * 60 * 1000; // 15 minutes
                const maxTimeout = 60 * 60 * 1000; // 60 minutes
                
                // Calculate dynamic timeout: 3x the estimated time (with min and max bounds)
                const dynamicTimeout = Math.min(
                    maxTimeout, 
                    Math.max(minTimeout, estimatedTimeInSeconds * 3 * 1000)
                );
                
                addStatusUpdate(`Monitoring will continue for up to ${Math.round(dynamicTimeout/60000)} minutes`);
                
                // Set a safety timeout for monitoring
                setTimeout(() => {
                    if (getElement('scrapeButton').disabled) {
                        clearInterval(pollInterval);
                        addStatusUpdate('Polling stopped due to timeout. The scrape is still running in the background.');
                        showAlert('Scrape monitoring timed out but may still be running. Come back later to see results.', 'warning');
                        getElement('loadingIndicator').style.display = 'none';
                        getElement('scrapeButton').disabled = false;
                    }
                }, dynamicTimeout);
            } else {
                throw new Error(data.message || 'Unknown error starting scrape');
            }
        })
        .catch(error => {
            console.error('Error starting scrape:', error);
            addStatusUpdate(`Error: ${error.message}`);
            showAlert(`Error: ${error.message}`, 'danger');
            
            getElement('loadingIndicator').style.display = 'none';
            getElement('scrapeButton').disabled = false;
        });
    }
    
    /**
     * Poll for scrape progress with optimized network requests
     * @param {String} scrapeId - ID of the scrape
     * @param {Number} pollInterval - Interval ID for clearing
     */
    function pollScrapeProgress(scrapeId, pollInterval) {
        if (!csrfToken || !csrfHeader) return;
        
        fetch(`/api/jobs/scrape/progress?scrapeId=${scrapeId}`, {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(progress => {
            // Update UI components
            updateScrapeProgress(progress);
            
            // Handle completion or error
            if (progress.percentComplete >= 100) {
                clearInterval(pollInterval);
                addStatusUpdate('Scraping completed successfully!');
                showAlert('Scraping completed successfully!', 'success');
                
                // Flag to indicate new jobs are available
                window.trackjobs.newJobsAvailable = true;
                
                // Update the search tab's job listings automatically
                fetchRecentlyScrapedJobs();
                resetScraperUI();
            } else if (progress.percentComplete < 0) {
                clearInterval(pollInterval);
                addStatusUpdate(`Error: ${progress.status}`);
                showAlert(`Error: ${progress.status}`, 'danger');
                resetScraperUI();
            }
        })
        .catch(error => {
            console.warn('Error polling for progress:', error);
            // Don't stop polling on first error - it might be temporary
            addStatusUpdate(`Warning: Progress update failed: ${error.message}`);
        });
    }
    
    /**
     * Update scrape progress UI
     * @param {Object} progress - Progress data from API
     */
    function updateScrapeProgress(progress) {
        const progressBar = getElement('scrapeProgressBar');
        const progressBarText = getElement('progressBarText');
        
        // Update progress bar
        if (progressBar) {
            progressBar.style.width = `${progress.percentComplete}%`;
            progressBar.setAttribute('aria-valuenow', progress.percentComplete);
        }
        
        // Update text
        if (progressBarText) {
            progressBarText.textContent = progress.status;
        }
        
        // Add status update if it's new
        if (progress.status) {
            const lastUpdate = getElement('statusUpdatesList').lastElementChild;
            if (!lastUpdate || !lastUpdate.textContent.includes(progress.status)) {
                addStatusUpdate(progress.status);
            }
        }
        
        // Update experience level progress
        if (progress.totalExperienceLevels > 0) {
            getElement('experienceLevelProgress').textContent = 
                `Experience level ${progress.experienceLevelIndex + 1}/${progress.totalExperienceLevels}: ${progress.currentExperienceLevel}`;
        }
        
        // Update page progress
        if (progress.totalPages > 0) {
            getElement('pageProgress').textContent = 
                `Pages: ${progress.currentPage}/${progress.totalPages}`;
        }
    }
    
    /**
     * Reset scraper UI after completion or error
     */
    function resetScraperUI() {
        getElement('loadingIndicator').style.display = 'none';
        getElement('scrapeButton').disabled = false;
    }
    
    /**
     * Add a status update to the list
     * @param {String} message - Status message
     */
    function addStatusUpdate(message) {
        const statusUpdatesList = getElement('statusUpdatesList');
        if (!statusUpdatesList) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item small';
        
        // Highlight based on content
        if (message.includes('experience level')) {
            listItem.className += ' list-group-item-info';
        } else if (message.includes('Error') || message.includes('error')) {
            listItem.className += ' list-group-item-danger';
        } else if (message.includes('completed successfully')) {
            listItem.className += ' list-group-item-success';
        }
        
        listItem.innerHTML = `<span class="text-muted">[${timestamp}]</span> ${message}`;
        
        // Use appendChild for better performance than innerHTML
        statusUpdatesList.appendChild(listItem);
        
        // Auto-scroll to bottom
        requestAnimationFrame(() => {
            statusUpdatesList.scrollTop = statusUpdatesList.scrollHeight;
        });
    }
    
    /**
     * Fetch recently scraped jobs
     */
    function fetchRecentlyScrapedJobs() {
        if (!csrfToken || !csrfHeader) return;
        
        addStatusUpdate('Fetching recently scraped jobs...');
        
        fetch('/api/jobs/search?daysOld=1', {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(jobs => {
            // Display the recent jobs in the scraper tab
            displayRecentScrapedJobs(jobs);
            addStatusUpdate(`Found ${jobs.length} recently scraped jobs.`);
            
            // Update the search tab's job list if it's currently visible
            if (window.trackjobs.activeTab === 'search') {
                console.log('Automatically updating search tab with new jobs');
                // Update the global job cache
                window.trackjobs.currentJobs = jobs;
                // Refresh the job listings
                setTimeout(() => searchJobs(true), 100);
            } else {
                // Mark that new jobs are available when switching back to search
                window.trackjobs.newJobsAvailable = true;
            }
        })
        .catch(error => {
            console.error('Error fetching recent jobs:', error);
            addStatusUpdate(`Error fetching recent jobs: ${error.message}`);
        });
    }
    
    /**
     * Display recently scraped jobs
     * @param {Array} jobs - Array of job objects
     */
    function displayRecentScrapedJobs(jobs) {
        const container = getElement('recentScrapedJobs');
        if (!container) return;
        
        // Clear container
        container.innerHTML = '';
        
        if (!jobs || jobs.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <p class="text-muted">No recently scraped jobs to display</p>
                </div>
            `;
            return;
        }
        
        // Create fragment for batch insertion
        const fragment = document.createDocumentFragment();
        const row = document.createElement('div');
        row.className = 'row';
        
        // Show latest jobs (up to 6 instead of 3 since we removed the "View All" button)
        const maxJobs = Math.min(jobs.length, 6);
        for (let i = 0; i < maxJobs; i++) {
            row.appendChild(createJobCardElement(jobs[i]));
        }
        
        // Add job count message if there are additional jobs not shown
        if (jobs.length > maxJobs) {
            const countInfoDiv = document.createElement('div');
            countInfoDiv.className = 'col-12 text-center mt-3';
            countInfoDiv.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    Showing ${maxJobs} of ${jobs.length} recently scraped jobs. 
                    Switch to the Search tab to see all jobs.
                </div>
            `;
            row.appendChild(countInfoDiv);
        }
        
        fragment.appendChild(row);
        container.appendChild(fragment);
    }
    
    /**
     * Handle view all jobs button click
     */
    function handleViewAllJobs() {
        // Switch to search tab
        switchToTab('search');
        
        // Update search form with the keywords and location from the scraper tab
        const searchKeywords = getElement('searchKeywords');
        const keywords = getElement('keywords');
        if (searchKeywords && keywords) {
            searchKeywords.value = keywords.value;
        }
        
        const searchLocation = getElement('searchLocation');
        const location = getElement('location');
        if (searchLocation && location) {
            searchLocation.value = location.value;
        }
        
        // Trigger search immediately to show the new jobs
        searchJobs(true); // true = update counts
    }
    
    /**
     * Display jobs with efficient DOM operations
     * @param {Array} jobs - Array of job objects
     */
    function displayJobDetails(job) {
        if (!job) return;
        
        // Update text content - batch DOM operations
        batchDomUpdates([
            { id: 'jobDetailTitle', textContent: job.title || 'Untitled Job' },
            { id: 'jobDetailCompany', textContent: job.company || 'Unknown Company' },
            { id: 'jobDetailLocation', textContent: job.location || 'Not specified' },
            { id: 'jobDetailJobType', textContent: job.jobType || 'Not specified' },
            { id: 'jobDetailExperienceLevel', textContent: job.experienceLevel || 'Not specified' },
            { id: 'jobDetailPosted', textContent: formatDate(job.datePosted) },
            { id: 'jobDetailScraped', textContent: formatDate(job.dateScraped) }
        ]);
        
        // Set status selection
        const status = job.applicationStatus || 'SAVED';
        const radios = document.querySelectorAll('.job-status-selector input[name="jobStatus"]');
        
        // Remove existing listeners and set state
        radios.forEach(radio => {
            const newRadio = radio.cloneNode(true);
            newRadio.checked = newRadio.value === status;
            
            // Add listener to new radio
            newRadio.addEventListener('change', function() {
                if (this.checked) {
                    updateJobStatusFromModal(job.id, this.value);
                }
            });
            
            radio.parentNode.replaceChild(newRadio, radio);
        });
        
        // Format description
        const descElement = getElement('jobDetailDescription');
        if (descElement) {
            descElement.innerHTML = job.description && job.description.trim() 
                ? formatJobDescription(job.description)
                : '<p class="text-muted">No detailed description available for this job.</p>';
        }
        
        // Set LinkedIn link
        const linkedInLink = getElement('jobDetailLinkedInLink');
        if (linkedInLink) {
            if (job.url) {
                linkedInLink.href = job.url;
                linkedInLink.style.display = 'inline-block';
            } else {
                linkedInLink.style.display = 'none';
            }
        }
        
        // Set Claude AI document generation buttons job ID
        const generateTailoredResumeBtn = getElement('generateTailoredResumeBtn');
        const generateCoverLetterBtn = getElement('generateCoverLetterBtn');
        
        if (generateTailoredResumeBtn) {
            generateTailoredResumeBtn.dataset.jobId = job.id;
        }
        
        if (generateCoverLetterBtn) {
            generateCoverLetterBtn.dataset.jobId = job.id;
        }
        
        // Show content, hide spinner
        getElement('jobDetailsSpinner').style.display = 'none';
        getElement('jobDetailsContent').style.display = 'block';
    }
    
    /**
     * Show no jobs message based on active filter
     */
    function showNoJobsMessage() {
        const jobsContainer = getElement('jobsContainer');
        if (!jobsContainer) return;
        
        // Get the currently selected status filter
        const activeFilter = document.querySelector('.status-filter-pill.active');
        const status = activeFilter ? activeFilter.getAttribute('data-status') : 'ALL';
        const statusName = status === 'ALL' ? 'jobs' : STATUS.DISPLAY_NAMES[status].toLowerCase() + ' jobs';
        
        jobsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle-fill me-2"></i>
                    No ${statusName} found. ${status === 'ALL' ? 'Try different search criteria or use the scraper to get new jobs.' : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Create job card element with optimized DOM operations
     * @param {Object} job - Job data
     * @return {HTMLElement} Job card element
     */
    function createJobCardElement(job) {
        // Ensure applicationStatus is never null/undefined/empty string
        // and always defaults to SAVED when any of those conditions are true
        let status = 'SAVED';
        if (job.applicationStatus && job.applicationStatus.trim() !== '') {
            status = job.applicationStatus;
        }
        
        const statusClass = `status-${status}`;
        const statusDisplay = STATUS.DISPLAY_NAMES[status];
        const statusIcon = STATUS.ICONS[status];
        
        // Generate status options once
        const statusOptionsHtml = Object.entries(STATUS.DISPLAY_NAMES)
            .map(([value, label]) => 
                `<option value="${value}" ${status === value ? 'selected' : ''}>
                    ${label}
                </option>`
            ).join('');
        
        // Create card container
        const cardDiv = document.createElement('div');
        cardDiv.className = 'col-md-4 mb-4';
        
        // Use template string for efficient HTML construction
        cardDiv.innerHTML = `
            <div class="card h-100 job-card ${statusClass}" data-job-id="${job.id}">
                ${status !== 'SAVED' ? `<div class="status-ribbon ${statusClass}">${statusDisplay}</div>` : ''}
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title">${escapeHtml(job.title)}</h5>
                    </div>
                    <h6 class="card-subtitle mb-2">${escapeHtml(job.company)}</h6>
                    
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="status-badge ${statusClass}" data-job-id="${job.id}">
                            ${statusIcon} ${statusDisplay}
                        </span>
                        
                        <div class="status-selector-container">
                            <select class="form-select form-select-sm job-status-select" data-job-id="${job.id}" aria-label="Update job status">
                                ${statusOptionsHtml}
                            </select>
                        </div>
                    </div>
                    
                    <p class="card-text">
                        <i class="bi bi-geo-alt-fill"></i> ${escapeHtml(job.location || 'Not specified')}<br>
                        <i class="bi bi-calendar"></i> ${formatDate(job.datePosted)}<br>
                        <i class="bi bi-briefcase-fill"></i> ${escapeHtml(job.experienceLevel || 'Not specified')}
                    </p>
                </div>
                <div class="card-footer bg-transparent d-flex justify-content-between">
                    <button class="btn btn-sm btn-primary view-job-details-btn" data-job-id="${job.id}">
                        <i class="bi bi-eye me-1"></i>View Details
                    </button>
                    ${job.url ? `
                        <a href="${escapeHtml(job.url)}" target="_blank" class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation();">
                            <i class="bi bi-linkedin me-1"></i>LinkedIn
                        </a>
                    ` : `
                        <button class="btn btn-sm btn-outline-secondary" disabled onclick="event.stopPropagation();">
                            No URL Available
                        </button>
                    `}
                </div>
            </div>
        `;
        
        return cardDiv;
    }
    
    /**
     * Update status counts with animation
     * @param {Array} jobs - Array of job objects
     */
    function updateStatusCounts(jobs) {
        if (!jobs) return;
        
        // Initialize counts object once
        const counts = {
            'ALL': jobs.length,
            'SAVED': 0,
            'APPLIED': 0,
            'INTERVIEWING': 0,
            'REJECTED': 0,
            'OFFER': 0
        };
        
        // Count jobs by status in one pass
        jobs.forEach(job => {
            const status = job.applicationStatus || 'SAVED';
            counts[status] = (counts[status] || 0) + 1;
        });
        
        // Update count elements efficiently
        updateCountElement('countAll', counts.ALL);
        updateCountElement('countSaved', counts.SAVED);
        updateCountElement('countApplied', counts.APPLIED);
        updateCountElement('countInterviewing', counts.INTERVIEWING);
        updateCountElement('countRejected', counts.REJECTED);
        updateCountElement('countOffer', counts.OFFER);
        
        console.log('Updated status counts:', counts);
    }
    
    /**
     * Update count element with animation
     * @param {String} id - Element ID
     * @param {Number} count - New count value
     */
    function updateCountElement(id, count) {
        const element = getElement(id);
        if (!element) return;
        
        const currentCount = parseInt(element.textContent || '0');
        if (currentCount === count) return;
        
        // Highlight change with subtle animation
        element.style.backgroundColor = '#e7f5ff';
        element.textContent = count;
        
        // Use RAF + transition for smooth animation
        requestAnimationFrame(() => {
            element.style.transition = 'background-color 0.5s';
            element.style.backgroundColor = '';
        });
    }
    
    /**
     * Format job description efficiently
     * @param {String} description - Raw job description
     * @return {String} Formatted HTML
     */
    function formatJobDescription(description) {
        if (!description || description.trim() === '') {
            return '<p class="text-muted">No detailed description available for this job.</p>';
        }
        
        // Process description whitespace
        const normalizedDesc = description
            .replace(/\r\n/g, '\n')  // Normalize line breaks
            .replace(/\n{3,}/g, '\n\n');  // Replace excessive line breaks
        
        // Detect if the description is already HTML
        const containsHtml = /<(?=.*? .*?\/ ?>|br|hr|input|link|img|meta|param|area|base|col|!--|!DOCTYPE).*?>/i.test(normalizedDesc);
        
        if (containsHtml) {
            // If it's HTML, return as is but wrapped in a container
            return `<div class="job-description-html">${normalizedDesc}</div>`;
        }
        
        // Otherwise, process as plain text
        try {
            // Split and filter paragraphs
            const paragraphs = normalizedDesc
                .split(/\n\s*\n/)
                .filter(p => p.trim().length > 0);
            
            // Process each paragraph
            return paragraphs
                .map(p => {
                    const trimmedP = p.trim();
                    
                    // Check if paragraph is a bullet list
                    if (/^[•\-\*\⁃\◦\‣\⦿\⁌\⁍]\s/.test(trimmedP)) {
                        // Convert to proper bullet list
                        const listItems = trimmedP
                            .split(/\n/)
                            .filter(line => line.trim())
                            .map(line => line.replace(/^[•\-\*\⁃\◦\‣\⦿\⁌\⁍]\s/, '').trim())
                            .map(item => `<li>${item}</li>`)
                            .join('');
                        
                        return `<ul>${listItems}</ul>`;
                    }
                    
                    // Check if it might be a heading (short and ends with :)
                    if (trimmedP.length < 50 && trimmedP.endsWith(':')) {
                        return `<h4>${trimmedP}</h4>`;
                    }
                    
                    // Regular paragraph with line break preservation
                    return `<p>${trimmedP.replace(/\n/g, '<br>')}</p>`;
                })
                .join('');
        } catch (e) {
            console.error('Error formatting job description:', e);
            // Fallback to basic formatting
            return `<p>${description.replace(/\n/g, '<br>')}</p>`;
        }
    }
    
    /**
     * Format date with caching to avoid repeated calculations
     * @param {String} dateString - Date string
     * @return {String} Formatted date string
     */
    function formatDate(dateString) {
        if (!dateString) return 'Not specified';
        
        if (dateCache[dateString]) {
            return dateCache[dateString];
        }
        
        try {
            const date = new Date(dateString);
            const formatted = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Cache result
            dateCache[dateString] = formatted;
            return formatted;
        } catch (error) {
            return dateString;
        }
    }
    
    /**
     * Escape HTML efficiently
     * @param {String} str - String to escape
     * @return {String} Escaped HTML string
     */
    function escapeHtml(str) {
        if (!str) return '';
        
        // Use template strings for faster processing
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    /**
     * Show alert message with cleanup
     * @param {String} message - Message to display
     * @param {String} type - Alert type
     */
    function showAlert(message, type) {
        // Create/get alert container
        let alertContainer = document.querySelector('.alert-container');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.className = 'alert-container position-fixed top-0 end-0 p-3';
            alertContainer.style.zIndex = '9999';
            document.body.appendChild(alertContainer);
        }
        
        // Limit number of alerts
        const currentAlerts = alertContainer.querySelectorAll('.alert');
        if (currentAlerts.length >= 3) {
            alertContainer.removeChild(currentAlerts[0]);
        }
        
        // Create alert
        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type} alert-dismissible fade show`;
        alertEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add to container
        alertContainer.appendChild(alertEl);
        
        // Auto dismiss after delay
        setTimeout(() => {
            if (alertEl.parentNode) {
                try {
                    if (typeof bootstrap !== 'undefined' && bootstrap.Alert) {
                        const bsAlert = new bootstrap.Alert(alertEl);
                        bsAlert.close();
                    } else {
                        // Fallback with animation
                        alertEl.classList.remove('show');
                        setTimeout(() => alertEl.remove(), 150);
                    }
                } catch (e) {
                    alertEl.remove();
                }
            }
        }, 5000);
    }
    
    /**
     * Initialize data management
     */
    function initializeDataManagement() {
        const deleteConfirmInput = getElement('deleteConfirmInput');
        const confirmDeleteBtn = getElement('confirmDeleteBtn');
        
        if (deleteConfirmInput && confirmDeleteBtn) {
            deleteConfirmInput.addEventListener('input', function() {
                confirmDeleteBtn.disabled = this.value !== 'DELETE';
            });
            
            // Reset on modal close
            getElement('wipeDataModal')?.addEventListener('hidden.bs.modal', function() {
                deleteConfirmInput.value = '';
                confirmDeleteBtn.disabled = true;
            });
        }
    }
    
    /**
     * Open save config modal
     */
    function openSaveConfigModal() {
        const modal = getElement('saveConfigModal');
        const configNameInput = getElement('configName');
        const saveConfigError = getElement('saveConfigError');
        
        // Reset modal state
        if (configNameInput) configNameInput.value = '';
        if (saveConfigError) {
            saveConfigError.textContent = '';
            saveConfigError.classList.add('d-none');
        }
        
        // Show modal
        if (typeof bootstrap !== 'undefined') {
            try {
                const modalInstance = new bootstrap.Modal(modal);
                modalInstance.show();
            } catch (e) {
                console.error('Error showing modal with Bootstrap', e);
                manuallyShowModal(modal);
            }
        } else {
            manuallyShowModal(modal);
        }
    }
    
    /**
     * Save current configuration
     */
    function saveCurrentConfig() {
        const configNameInput = getElement('configName');
        const saveConfigError = getElement('saveConfigError');
        
        if (!configNameInput || !saveConfigError) {
            console.error('Required modal elements not found');
            return;
        }
        
        const configName = configNameInput.value.trim();
        
        if (!configName) {
            saveConfigError.textContent = 'Please enter a configuration name';
            saveConfigError.classList.remove('d-none');
            return;
        }
        
        // Get form values efficiently
        const payload = getScraperConfig();
        payload.configName = configName;
        
        // Check tokens
        if (!csrfToken || !csrfHeader) {
            saveConfigError.textContent = 'Security tokens not found. Please refresh the page.';
            saveConfigError.classList.remove('d-none');
            return;
        }
        
        // Save config
        fetch('/api/configs/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Close modal
                try {
                    const modalEl = getElement('saveConfigModal');
                    if (typeof bootstrap !== 'undefined') {
                        const modal = bootstrap.Modal.getInstance(modalEl) 
                            || new bootstrap.Modal(modalEl);
                        modal.hide();
                    } else {
                        modalEl.classList.remove('show');
                        modalEl.style.display = 'none';
                        document.body.classList.remove('modal-open');
                        document.querySelector('.modal-backdrop')?.remove();
                    }
                } catch (e) {
                    console.error('Error closing modal:', e);
                }
                
                showAlert(`Configuration "${data.configName}" saved successfully`, 'success');
                loadSavedConfigs();
            } else {
                saveConfigError.textContent = data.message;
                saveConfigError.classList.remove('d-none');
            }
        })
        .catch(error => {
            console.error('Error saving config:', error);
            saveConfigError.textContent = `Error: ${error.message}`;
            saveConfigError.classList.remove('d-none');
        });
    }
    
    /**
     * Get current scraper configuration
     * @return {Object} Scraper configuration object
     */
    function getScraperConfig() {
        // Get form values
        const keywords = getElement('keywords')?.value?.trim() || '';
        const location = getElement('location')?.value?.trim() || '';
        const pagesToScrape = parseInt(getElement('pagesToScrape')?.value || 1);
        const remoteOnly = getElement('remoteOnly')?.checked || false;
        const jobType = getElement('jobType')?.value || '';
        const daysOld = parseInt(getElement('daysOld')?.value || 7);
        
        // Advanced filters
        const titleIncludeWords = getElement('titleIncludeWords')?.value || '';
        const titleExcludeWords = getElement('titleExcludeWords')?.value || '';
        const companyExcludeWords = getElement('companyExcludeWords')?.value || '';
        const descriptionExcludeWords = getElement('descriptionExcludeWords')?.value || '';
        
        // Experience levels
        const experienceLevelInclude = Array.from(
            document.querySelectorAll('input[name="expInclude"]:checked')
        ).map(cb => cb.value);
        
        // Create config object
        return {
            keywords,
            location,
            pagesToScrape,
            remoteOnly,
            jobType,
            daysOld,
            titleIncludeWords: titleIncludeWords ? titleIncludeWords.split(',').map(s => s.trim()) : [],
            titleExcludeWords: titleExcludeWords ? titleExcludeWords.split(',').map(s => s.trim()) : [],
            companyExcludeWords: companyExcludeWords ? companyExcludeWords.split(',').map(s => s.trim()) : [],
            descriptionExcludeWords: descriptionExcludeWords ? descriptionExcludeWords.split(',').map(s => s.trim()) : [],
            experienceLevelInclude
        };
    }
    
    /**
     * Load saved configurations efficiently
     */
    function loadSavedConfigs() {
        console.time('LoadConfigs');
        
        const savedConfigsList = getElement('savedConfigsList');
        if (!savedConfigsList) return;
        
        // Show loading state
        savedConfigsList.innerHTML = '<li><span class="dropdown-item text-muted">Loading configurations...</span></li>';
        
        // Check tokens
        if (!csrfToken || !csrfHeader) {
            savedConfigsList.innerHTML = '<li><span class="dropdown-item text-danger">Security tokens not found</span></li>';
            return;
        }
        
        // Fetch configs
        fetch('/api/configs', {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(configs => {
            // Prepare fragment for batch insert
            const fragment = document.createDocumentFragment();
            
            if (!configs || configs.length === 0) {
                const item = document.createElement('li');
                item.innerHTML = '<span class="dropdown-item text-muted">No saved configurations</span>';
                fragment.appendChild(item);
            } else {
                // Process all configs in one batch
                configs.forEach(config => {
                    const item = document.createElement('li');
                    const link = document.createElement('a');
                    link.className = 'dropdown-item';
                    link.href = '#';
                    link.setAttribute('data-config-id', config.id);
                    link.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center">
                            <span>${escapeHtml(config.name)}</span>
                            <button class="btn btn-sm btn-outline-danger delete-config-btn" data-config-id="${config.id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                        <small class="text-muted">${escapeHtml(config.keywords)} in ${escapeHtml(config.location)}</small>
                    `;
                    
                    item.appendChild(link);
                    fragment.appendChild(item);
                });
            }
            
            // Update DOM in one operation
            savedConfigsList.innerHTML = '';
            savedConfigsList.appendChild(fragment);
            
            console.timeEnd('LoadConfigs');
        })
        .catch(error => {
            console.error('Error loading configurations:', error);
            savedConfigsList.innerHTML = `<li><span class="dropdown-item text-danger">Error: ${error.message}</span></li>`;
        });
    }
    
    /**
     * Handle config item click
     * @param {HTMLElement} link - Clicked link element
     * @param {Event} event - Click event
     */
    function handleConfigClick(link, event) {
        event.preventDefault();
        
        const configId = link.getAttribute('data-config-id');
        if (configId) {
            loadConfig(configId);
        }
    }
    
    /**
     * Handle delete config button click
     * @param {HTMLElement} btn - Clicked button
     * @param {Event} event - Click event
     */
    function handleDeleteConfig(btn, event) {
        event.preventDefault();
        event.stopPropagation();
        
        const configId = btn.getAttribute('data-config-id');
        if (configId && confirm('Are you sure you want to delete this configuration?')) {
            deleteConfig(configId);
        }
    }
    
    /**
     * Load a specific configuration
     * @param {String|Number} configId - ID of the configuration
     */
    function loadConfig(configId) {
        console.time('LoadConfig');
        
        // Switch to scraper tab
        switchToTab('scraper');
        
        // Check tokens
        if (!csrfToken || !csrfHeader) {
            showAlert('Security tokens not found. Please refresh the page.', 'danger');
            return;
        }
        
        // Fetch config details
        fetch(`/api/configs/${configId}`, {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(config => {
            // Update form fields in batch
            batchDomUpdates([
                { id: 'keywords', prop: 'value', value: config.keywords || '' },
                { id: 'location', prop: 'value', value: config.location || '' },
                { id: 'pagesToScrape', prop: 'value', value: config.pagesToScrape || 1 },
                { id: 'remoteOnly', prop: 'checked', value: config.remoteOnly || false },
                { id: 'jobType', prop: 'value', value: config.jobType || '' },
                { id: 'daysOld', prop: 'value', value: config.daysOld || 7 },
                { id: 'titleIncludeWords', prop: 'value', value: config.titleIncludeWords?.join(',') || '' },
                { id: 'titleExcludeWords', prop: 'value', value: config.titleExcludeWords?.join(',') || '' },
                { id: 'companyExcludeWords', prop: 'value', value: config.companyExcludeWords?.join(',') || '' },
                { id: 'descriptionExcludeWords', prop: 'value', value: config.descriptionExcludeWords?.join(',') || '' }
            ]);
            
            // Set experience levels
            document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
                checkbox.checked = config.experienceLevelInclude?.includes(checkbox.value) || false;
            });
            
            showAlert('Configuration loaded successfully', 'success');
            console.timeEnd('LoadConfig');
            
            // Switch to experience tab to show loaded values
            try {
                const expTab = document.getElementById('experience-filters-tab');
                if (expTab && typeof bootstrap !== 'undefined') {
                    const bsTab = new bootstrap.Tab(expTab);
                    bsTab.show();
                }
            } catch (e) {
                console.warn('Error switching to experience tab:', e);
            }
        })
        .catch(error => {
            console.error('Error loading configuration:', error);
            showAlert(`Error loading configuration: ${error.message}`, 'danger');
        });
    }
    
    /**
     * Delete a configuration
     * @param {String|Number} configId - ID of the configuration
     */
    function deleteConfig(configId) {
        // Check tokens
        if (!csrfToken || !csrfHeader) {
            showAlert('Security tokens not found. Please refresh the page.', 'danger');
            return;
        }
        
        // Delete config
        fetch(`/api/configs/${configId}`, {
            method: 'DELETE',
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showAlert('Configuration deleted successfully', 'success');
                loadSavedConfigs();
            } else {
                throw new Error(data.message || 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Error deleting config:', error);
            showAlert(`Error deleting configuration: ${error.message}`, 'danger');
        });
    }
    
    /**
     * Debounce function for search inputs
     * @param {Function} func - Function to debounce
     * @param {Number} wait - Wait time in milliseconds
     * @return {Function} Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    /**
     * Display jobs with efficient DOM operations
     * @param {Array} jobs - Array of job objects
     */
    function displayJobs(jobs) {
        console.time('DisplayJobs');
        
        const jobsContainer = document.getElementById('jobsContainer');
        if (!jobsContainer) {
            console.error('Jobs container not found');
            return;
        }
        
        // Show no jobs message if empty
        if (!jobs || jobs.length === 0) {
            showNoJobsMessage();
            console.timeEnd('DisplayJobs');
            return;
        }
        
        // Record current container state
        const currentScrollPos = window.scrollY;
        const currentHeight = jobsContainer.offsetHeight;
        
        // Create a temporary container that will hold our new content
        const tempContainer = document.createElement('div');
        tempContainer.className = 'row temp-jobs-container';
        tempContainer.style.opacity = '0';
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px'; // Hide it off-screen initially
        tempContainer.style.width = jobsContainer.clientWidth + 'px'; // Match width for accurate height calculation
        
        // Use DocumentFragment for batch insertion to the temp container
        const fragment = document.createDocumentFragment();
        
        // Add all job cards
        for (let i = 0; i < jobs.length; i++) {
            fragment.appendChild(createJobCardElement(jobs[i]));
        }
        
        // Append all job cards to the temporary container
        tempContainer.appendChild(fragment);
        
        // Add the temp container to the DOM (still invisible)
        document.body.appendChild(tempContainer);
        
        // Get the height of the new content
        const newHeight = tempContainer.offsetHeight;
        
        // Add the necessary transition styles if they don't exist
        if (!document.getElementById('jobs-transition-styles')) {
            const styles = document.createElement('style');
            styles.id = 'jobs-transition-styles';
            styles.textContent = `
                .jobs-fade-out {
                    opacity: 0.6;
                    transition: opacity 150ms ease-out;
                }
                .jobs-fade-in {
                    opacity: 0;
                    animation: fadeJobsIn 300ms forwards;
                }
                .jobs-height-transition {
                    transition: height 400ms ease-out;
                    overflow: hidden;
                }
                @keyframes fadeJobsIn {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Now perform the transition
        requestAnimationFrame(() => {
            // Step 1: Set explicit height and add transition class
            jobsContainer.style.height = currentHeight + 'px';
            jobsContainer.classList.add('jobs-height-transition');
            
            // Step 2: Add fade-out class to current content
            jobsContainer.classList.add('jobs-fade-out');
            
            // Step 3: After fade out, change content and animate height
            setTimeout(() => {
                // Clear current container
                jobsContainer.innerHTML = '';
                
                // Get all the job cards from the temp container
                const jobCards = tempContainer.querySelectorAll('.col-md-4');
                jobCards.forEach(card => {
                    jobsContainer.appendChild(card);
                });
                
                // Adjust to new height
                jobsContainer.style.height = newHeight + 'px';
                
                // Remove the temporary container
                tempContainer.remove();
                
                // Restore scroll position
                window.scrollTo(0, currentScrollPos);
                
                // Remove fade-out and add fade-in
                jobsContainer.classList.remove('jobs-fade-out');
                jobsContainer.classList.add('jobs-fade-in');
                
                // Step 4: After height transition completes, clean up
                setTimeout(() => {
                    jobsContainer.classList.remove('jobs-height-transition');
                    jobsContainer.classList.remove('jobs-fade-in');
                    jobsContainer.style.height = '';
                }, 400); // Match the height transition duration
            }, 150); // Match the fade-out duration
        });
        
        console.timeEnd('DisplayJobs');
    }

    /**
     * Show no jobs message based on active filter
     */
    function showNoJobsMessage() {
        const jobsContainer = document.getElementById('jobsContainer');
        if (!jobsContainer) return;
        
        // Get the currently selected status filter
        const activeFilter = document.querySelector('.status-filter-pill.active');
        const status = activeFilter ? activeFilter.getAttribute('data-status') : 'ALL';
        const statusName = status === 'ALL' ? 'jobs' : STATUS.DISPLAY_NAMES[status].toLowerCase() + ' jobs';
        
        jobsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle-fill me-2"></i>
                    No ${statusName} found. ${status === 'ALL' ? 'Try different search criteria or use the scraper to get new jobs.' : ''}
                </div>
            </div>
        `;
    }

    /**
     * Create job card element with optimized DOM operations
     * @param {Object} job - Job data
     * @return {HTMLElement} Job card element
     */
    function createJobCardElement(job) {
        // Set defaults to avoid null checks
        const status = job.applicationStatus || 'SAVED';
        const statusClass = `status-${status}`;
        const statusDisplay = STATUS.DISPLAY_NAMES[status];
        const statusIcon = STATUS.ICONS[status];
        
        // Generate status options once
        const statusOptionsHtml = Object.entries(STATUS.DISPLAY_NAMES)
            .map(([value, label]) => 
                `<option value="${value}" ${status === value ? 'selected' : ''}>
                    ${label}
                </option>`
            ).join('');
        
        // Create card container
        const cardDiv = document.createElement('div');
        cardDiv.className = 'col-md-4 mb-4';
        
        // Use template string for efficient HTML construction
        cardDiv.innerHTML = `
            <div class="card h-100 job-card ${statusClass}" data-job-id="${job.id}">
                ${status !== 'SAVED' ? `<div class="status-ribbon ${statusClass}">${statusDisplay}</div>` : ''}
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title">${escapeHtml(job.title)}</h5>
                    </div>
                    <h6 class="card-subtitle mb-2">${escapeHtml(job.company)}</h6>
                    
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="status-badge ${statusClass}" data-job-id="${job.id}">
                            ${statusIcon} ${statusDisplay}
                        </span>
                        
                        <div class="status-selector-container">
                            <select class="form-select form-select-sm job-status-select" data-job-id="${job.id}" aria-label="Update job status">
                                ${statusOptionsHtml}
                            </select>
                        </div>
                    </div>
                    
                    <p class="card-text">
                        <i class="bi bi-geo-alt-fill"></i> ${escapeHtml(job.location || 'Not specified')}<br>
                        <i class="bi bi-calendar"></i> ${formatDate(job.datePosted)}<br>
                        <i class="bi bi-briefcase-fill"></i> ${escapeHtml(job.experienceLevel || 'Not specified')}
                    </p>
                </div>
                <div class="card-footer bg-transparent d-flex justify-content-between">
                    <button class="btn btn-sm btn-primary view-job-details-btn" data-job-id="${job.id}">
                        <i class="bi bi-eye me-1"></i>View Details
                    </button>
                    ${job.url ? `
                        <a href="${escapeHtml(job.url)}" target="_blank" class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation();">
                            <i class="bi bi-linkedin me-1"></i>LinkedIn
                        </a>
                    ` : `
                        <button class="btn btn-sm btn-outline-secondary" disabled onclick="event.stopPropagation();">
                            No URL Available
                        </button>
                    `}
                </div>
            </div>
        `;
        
        return cardDiv;
    }

    /**
     * Escape HTML efficiently
     * @param {String} str - String to escape
     * @return {String} Escaped HTML string
     */
    function escapeHtml(str) {
        if (!str) return '';
        
        // Use template strings for faster processing
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();