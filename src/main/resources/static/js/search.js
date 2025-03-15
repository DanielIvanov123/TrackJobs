/**
 * search.js - Job search and filtering functionality
 * Optimized for search performance and memory efficiency
 */

(function() {
    // Cache DOM elements
    let searchButton, searchKeywordsInput, searchLocationInput;
    let searchExperienceLevelSelect, searchJobTypeSelect;
    let searchDatePostedSelect, searchRemoteOnlyCheckbox;
    let sortOptionSelect, jobsContainer, jobsCount;
    
    // Add debouncing for search input fields
    let searchTimeout;
    const SEARCH_DEBOUNCE_TIME = 300; // milliseconds
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        // Get references to DOM elements
        searchButton = document.getElementById('searchButton');
        searchKeywordsInput = document.getElementById('searchKeywords');
        searchLocationInput = document.getElementById('searchLocation');
        searchExperienceLevelSelect = document.getElementById('searchExperienceLevel');
        searchJobTypeSelect = document.getElementById('searchJobType');
        searchDatePostedSelect = document.getElementById('searchDatePosted');
        searchRemoteOnlyCheckbox = document.getElementById('searchRemoteOnly');
        sortOptionSelect = document.getElementById('sortOption');
        jobsContainer = document.getElementById('jobsContainer');
        jobsCount = document.getElementById('jobsCount');
        
        // Store these in window object for other modules to access
        window.trackjobs = window.trackjobs || {};
        window.trackjobs.elements = window.trackjobs.elements || {};
        
        window.trackjobs.elements.searchButton = searchButton;
        window.trackjobs.elements.searchKeywordsInput = searchKeywordsInput;
        window.trackjobs.elements.searchLocationInput = searchLocationInput;
        window.trackjobs.elements.searchExperienceLevelSelect = searchExperienceLevelSelect;
        window.trackjobs.elements.searchJobTypeSelect = searchJobTypeSelect;
        window.trackjobs.elements.searchDatePostedSelect = searchDatePostedSelect;
        window.trackjobs.elements.searchRemoteOnlyCheckbox = searchRemoteOnlyCheckbox;
        window.trackjobs.elements.sortOptionSelect = sortOptionSelect;
        window.trackjobs.elements.jobsContainer = jobsContainer;
        window.trackjobs.elements.jobsCount = jobsCount;
        
        // Add event listeners
        if (searchButton) {
            searchButton.addEventListener('click', searchJobs);
        }
        
        // Add debounced search on input fields
        if (searchKeywordsInput) {
            searchKeywordsInput.addEventListener('input', debounceSearch);
        }
        
        if (searchLocationInput) {
            searchLocationInput.addEventListener('input', debounceSearch);
        }
        
        // Add immediate search on select/checkbox changes
        [searchExperienceLevelSelect, searchJobTypeSelect, 
         searchDatePostedSelect, searchRemoteOnlyCheckbox].forEach(element => {
            if (element) {
                element.addEventListener('change', searchJobs);
            }
        });
        
        if (sortOptionSelect) {
            sortOptionSelect.addEventListener('change', handleSortChange);
        }
    });
    
    /**
     * Debounce search to prevent too many requests
     */
    function debounceSearch() {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        searchTimeout = setTimeout(searchJobs, SEARCH_DEBOUNCE_TIME);
    }
    
    /**
     * Search for jobs with current filters
     * @param {Event} [event] - Optional event object
     */
    function searchJobs(event) {
        // Prevent form submission if called from submit event
        if (event && event.preventDefault) {
            event.preventDefault();
        }
        
        console.log('Searching for jobs in database');
        
        // Get DOM elements if not already cached
        if (!searchKeywordsInput) {
            initializeDomCache();
        }
        
        // Get CSRF token from meta tag
        const csrfToken = getCsrfToken();
        const csrfHeader = getCsrfHeader();
        
        if (!csrfToken || !csrfHeader) {
            console.error('CSRF tokens not found');
            showAlert('Error: Security tokens not found', 'danger');
            return;
        }
        
        // Get search form values (with fallbacks for safety)
        const keywords = searchKeywordsInput?.value.trim() || '';
        const location = searchLocationInput?.value.trim() || '';
        const experienceLevel = searchExperienceLevelSelect?.value || '';
        const jobType = searchJobTypeSelect?.value || '';
        const daysOld = parseInt(searchDatePostedSelect?.value || '0');
        const remoteOnly = searchRemoteOnlyCheckbox?.checked || false;
        const applicationStatus = document.getElementById('searchApplicationStatus')?.value || '';
        
        // Log search parameters
        console.log('Search parameters:', {
            keywords, location, experienceLevel, jobType, daysOld, remoteOnly, applicationStatus
        });
        
        // Show loading message in jobs container
        if (jobsContainer) {
            jobsContainer.innerHTML = `
                <div class="col-12 text-center my-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Searching jobs...</p>
                </div>
            `;
        }
        
        // Create query params in an optimized way
        const queryParams = new URLSearchParams();
        
        // Only add non-empty parameters to reduce URL size
        if (keywords) queryParams.append('keywords', keywords);
        if (location) queryParams.append('location', location);
        if (experienceLevel) queryParams.append('experienceLevel', experienceLevel);
        if (jobType) queryParams.append('jobType', jobType);
        if (daysOld > 0) queryParams.append('daysOld', daysOld.toString());
        queryParams.append('remoteOnly', remoteOnly.toString());
        if (applicationStatus && applicationStatus !== 'ALL') {
            queryParams.append('applicationStatus', applicationStatus);
        }
        
        const queryString = queryParams.toString();
        console.log('Query string:', queryString);
        
        // Start timing the request
        const startTime = performance.now();
        
        // Make API request to search jobs with caching
        const cacheKey = `searchResults_${queryString}`;
        const cachedResults = sessionStorage.getItem(cacheKey);
        
        if (cachedResults && !daysOld) {
            try {
                // Use cached results if available and not time-sensitive
                const cachedData = JSON.parse(cachedResults);
                const cacheTime = cachedData.timestamp;
                
                // Only use cache if less than 5 minutes old
                if (Date.now() - cacheTime < 5 * 60 * 1000) {
                    console.log('Using cached search results');
                    processSearchResults(cachedData.jobs);
                    return;
                }
            } catch (e) {
                console.warn('Error parsing cached results:', e);
                // Continue with fetch if cache parsing fails
            }
        }
        
        // No valid cache, perform fetch
        fetch(`/api/jobs/search?${queryString}`, {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(jobs => {
            // Cache the results in sessionStorage
            if (!daysOld) { // Only cache if not date dependent
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        jobs: jobs,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.warn('Error caching search results:', e);
                    // Continue even if caching fails
                }
            }
            
            processSearchResults(jobs);
        })
        .catch(error => {
            console.error('Error searching jobs:', error);
            if (jobsContainer) {
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
            }
            showAlert(`Error searching jobs: ${error.message}`, 'danger');
        });
    }
    
    /**
     * Process and display search results
     * @param {Array} jobs - Array of job objects
     */
    function processSearchResults(jobs) {
        const searchTime = performance.now() - startTime;
        console.log(`Received ${jobs.length} jobs from server in ${searchTime.toFixed(0)}ms`);
        
        // Store jobs in global state for re-sorting
        window.trackjobs.currentJobs = jobs;
        
        // Update status counts if function exists
        if (typeof updateStatusCounts === 'function') {
            updateStatusCounts(jobs);
        }
        
        // Sort the jobs based on selected criteria
        const sortOption = sortOptionSelect?.value || 'datePosted';
        const sortedJobs = sortJobs(jobs, sortOption);
        
        // Update job count
        if (jobsCount) {
            jobsCount.textContent = sortedJobs.length;
        }
        
        // Update the count text to reflect the sort
        const countTextElement = document.getElementById('jobsCountText');
        if (countTextElement) {
            countTextElement.innerHTML = `Showing <span id="jobsCount">${sortedJobs.length}</span> jobs (sorted by ${getSortDisplayName(sortOption)})`;
        }
        
        // Display the jobs
        if (typeof displayJobs === 'function') {
            displayJobs(sortedJobs);
        } else {
            console.error('displayJobs function not found');
        }
        
        // Show success message (only for user-initiated searches)
        if (event) {
            showAlert(`Found ${sortedJobs.length} matching jobs`, 'success');
        }
    }
    
    /**
     * Initialize DOM element cache
     */
    function initializeDomCache() {
        searchKeywordsInput = document.getElementById('searchKeywords');
        searchLocationInput = document.getElementById('searchLocation');
        searchExperienceLevelSelect = document.getElementById('searchExperienceLevel');
        searchJobTypeSelect = document.getElementById('searchJobType');
        searchDatePostedSelect = document.getElementById('searchDatePosted');
        searchRemoteOnlyCheckbox = document.getElementById('searchRemoteOnly');
        sortOptionSelect = document.getElementById('sortOption');
        jobsContainer = document.getElementById('jobsContainer');
        jobsCount = document.getElementById('jobsCount');
    }
    
    /**
     * Handle sort option change
     */
    function handleSortChange() {
        const sortOption = this.value;
        console.log('Sort option changed to:', sortOption);
        
        // Re-sort current jobs without making a new request
        if (window.trackjobs.currentJobs?.length > 0) {
            const sortedJobs = sortJobs(window.trackjobs.currentJobs, sortOption);
            
            // Display the sorted jobs
            if (typeof displayJobs === 'function') {
                displayJobs(sortedJobs);
            }
            
            // Update the count text to reflect the sort
            const countTextElement = document.getElementById('jobsCountText');
            if (countTextElement) {
                countTextElement.innerHTML = `Showing <span id="jobsCount">${sortedJobs.length}</span> jobs (sorted by ${getSortDisplayName(sortOption)})`;
            }
        } else {
            // If no jobs in memory, trigger a new search
            searchJobs();
        }
    }
    
    /**
     * Sort jobs based on selected criteria with optimized algorithms
     * @param {Array} jobs - Array of job objects
     * @param {String} sortBy - Sort criteria
     * @return {Array} Sorted jobs array
     */
    function sortJobs(jobs, sortBy) {
        if (!sortBy || !jobs || jobs.length === 0) return jobs;
        
        // Create a new array to avoid mutating the original
        const sortedJobs = [...jobs];
        
        // Optimization: Prepare comparison functions once
        const compareFunctions = {
            datePosted: (a, b) => {
                const dateA = a.datePosted ? new Date(a.datePosted) : new Date(0);
                const dateB = b.datePosted ? new Date(b.datePosted) : new Date(0);
                return dateB - dateA; // Newest first
            },
            datePostedAsc: (a, b) => {
                const dateA = a.datePosted ? new Date(a.datePosted) : new Date(0);
                const dateB = b.datePosted ? new Date(b.datePosted) : new Date(0);
                return dateA - dateB; // Oldest first
            },
            status: (a, b) => {
                const statusOrder = {
                    'OFFER': 1,
                    'INTERVIEWING': 2,
                    'APPLIED': 3,
                    'SAVED': 4,
                    'REJECTED': 5
                };
                const statusA = statusOrder[a.applicationStatus || 'SAVED'] || 99;
                const statusB = statusOrder[b.applicationStatus || 'SAVED'] || 99;
                return statusA - statusB;
            },
            company: (a, b) => (a.company || '').localeCompare(b.company || ''),
            title: (a, b) => (a.title || '').localeCompare(b.title || '')
        };
        
        // Use the appropriate comparison function
        return sortedJobs.sort(compareFunctions[sortBy] || compareFunctions.datePosted);
    }
    
    /**
     * Get display name for sort option with caching
     * @param {String} sortOption - Sort option key
     * @return {String} Display name for the sort option
     */
    const sortOptionDisplayNames = {
        'datePosted': 'newest',
        'datePostedAsc': 'oldest',
        'status': 'application status',
        'company': 'company name',
        'title': 'job title'
    };
    
    function getSortDisplayName(sortOption) {
        return sortOptionDisplayNames[sortOption] || sortOption;
    }
    
    // Expose functions to global scope
    window.searchJobs = searchJobs;
    window.handleSortChange = handleSortChange;
})();