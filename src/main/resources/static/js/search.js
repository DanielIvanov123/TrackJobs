/**
 * search.js - Job search and filtering functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Reference necessary DOM elements
    const searchButton = document.getElementById('searchButton');
    const searchKeywordsInput = document.getElementById('searchKeywords');
    const searchLocationInput = document.getElementById('searchLocation');
    const searchExperienceLevelSelect = document.getElementById('searchExperienceLevel');
    const searchJobTypeSelect = document.getElementById('searchJobType');
    const searchDatePostedSelect = document.getElementById('searchDatePosted');
    const searchRemoteOnlyCheckbox = document.getElementById('searchRemoteOnly');
    const sortOptionSelect = document.getElementById('sortOption');
    
    // Store these in window object for other modules to access
    window.trackjobs = window.trackjobs || {};
    window.trackjobs.elements = window.trackjobs.elements || {};
    
    // Store elements in the trackjobs global object
    window.trackjobs.elements.searchButton = searchButton;
    window.trackjobs.elements.searchKeywordsInput = searchKeywordsInput;
    window.trackjobs.elements.searchLocationInput = searchLocationInput;
    window.trackjobs.elements.searchExperienceLevelSelect = searchExperienceLevelSelect;
    window.trackjobs.elements.searchJobTypeSelect = searchJobTypeSelect;
    window.trackjobs.elements.searchDatePostedSelect = searchDatePostedSelect;
    window.trackjobs.elements.searchRemoteOnlyCheckbox = searchRemoteOnlyCheckbox;
    window.trackjobs.elements.sortOptionSelect = sortOptionSelect;
    window.trackjobs.elements.jobsContainer = document.getElementById('jobsContainer');
    window.trackjobs.elements.jobsCount = document.getElementById('jobsCount');
    
    // Add event listeners
    if (searchButton) {
        searchButton.addEventListener('click', searchJobs);
    }
    
    if (sortOptionSelect) {
        sortOptionSelect.addEventListener('change', handleSortChange);
    }
});
/**
 * Search for jobs with current filters
 */
function searchJobs() {
    console.log('Searching for jobs in database');

    // Get DOM elements from trackjobs object
    const searchKeywordsInput = window.trackjobs.elements.searchKeywordsInput;
    const searchLocationInput = window.trackjobs.elements.searchLocationInput;
    const searchExperienceLevelSelect = window.trackjobs.elements.searchExperienceLevelSelect;
    const searchJobTypeSelect = window.trackjobs.elements.searchJobTypeSelect;
    const searchDatePostedSelect = window.trackjobs.elements.searchDatePostedSelect;
    const searchRemoteOnlyCheckbox = window.trackjobs.elements.searchRemoteOnlyCheckbox;
    const jobsContainer = window.trackjobs.elements.jobsContainer;
    const jobsCount = window.trackjobs.elements.jobsCount;
    
    // Get CSRF token from meta tag
    const csrfToken = getCsrfToken();
    const csrfHeader = getCsrfHeader();
    
    if (!csrfToken || !csrfHeader) {
        console.error('CSRF tokens not found');
        showAlert('Error: Security tokens not found', 'danger');
        return;
    }
    
    // Get search form values
    const keywords = searchKeywordsInput?.value.trim() || '';
    const location = searchLocationInput?.value.trim() || '';
    const experienceLevel = searchExperienceLevelSelect?.value || '';
    const jobType = searchJobTypeSelect?.value || '';
    const daysOld = parseInt(searchDatePostedSelect?.value || '0');
    const remoteOnly = searchRemoteOnlyCheckbox?.checked || false;
    const applicationStatus = document.getElementById('searchApplicationStatus')?.value || '';
    
    // Log search parameters for debugging
    console.log('Search parameters:', {
        keywords,
        location,
        experienceLevel,
        jobType,
        daysOld,
        remoteOnly,
        applicationStatus
    });
    
    // Show loading message in jobs container
    if (jobsContainer) {
        jobsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Searching jobs...</p>
            </div>
        `;
    }
    
    // Create query params
    let queryParams = new URLSearchParams();
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
    
    // Make API request to search jobs
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
        console.log(`Received ${jobs.length} jobs from server`);
        
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
        
        // Show success message
        showAlert(`Found ${sortedJobs.length} matching jobs`, 'success');
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
                </div>
            `;
        }
        showAlert(`Error searching jobs: ${error.message}`, 'danger');
    });
}

/**
 * Handle sort option change
 */
function handleSortChange() {
    console.log('Sort option changed to:', this.value);
    
    // Re-sort current jobs without making a new request
    if (window.trackjobs.currentJobs?.length > 0) {
        const sortedJobs = sortJobs(window.trackjobs.currentJobs, this.value);
        
        // Display the sorted jobs
        if (typeof displayJobs === 'function') {
            displayJobs(sortedJobs);
        }
        
        // Update the count text to reflect the sort
        const countTextElement = document.getElementById('jobsCountText');
        if (countTextElement) {
            countTextElement.innerHTML = `Showing <span id="jobsCount">${sortedJobs.length}</span> jobs (sorted by ${getSortDisplayName(this.value)})`;
        }
    } else {
        // If no jobs in memory, trigger a new search
        searchJobs();
    }
}

/**
 * Sort jobs based on selected criteria
 */
function sortJobs(jobs, sortBy) {
    if (!sortBy || !jobs || jobs.length === 0) return jobs;
    
    const sortedJobs = [...jobs]; // Create a copy to sort
    
    switch (sortBy) {
        case 'datePosted':
            // Newest first (descending)
            return sortedJobs.sort((a, b) => {
                const dateA = a.datePosted ? new Date(a.datePosted) : new Date(0);
                const dateB = b.datePosted ? new Date(b.datePosted) : new Date(0);
                return dateB - dateA;
            });
            
        case 'datePostedAsc':
            // Oldest first (ascending)
            return sortedJobs.sort((a, b) => {
                const dateA = a.datePosted ? new Date(a.datePosted) : new Date(0);
                const dateB = b.datePosted ? new Date(b.datePosted) : new Date(0);
                return dateA - dateB;
            });
            
        case 'status':
            // Order by application status
            return sortedJobs.sort((a, b) => {
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
            });
            
        case 'company':
            // Alphabetical by company
            return sortedJobs.sort((a, b) => {
                return (a.company || '').localeCompare(b.company || '');
            });
            
        case 'title':
            // Alphabetical by job title
            return sortedJobs.sort((a, b) => {
                return (a.title || '').localeCompare(b.title || '');
            });
            
        default:
            return sortedJobs;
    }
}

/**
 * Get display name for sort option
 */
function getSortDisplayName(sortOption) {
    const sortOptions = {
        'datePosted': 'newest',
        'datePostedAsc': 'oldest',
        'status': 'application status',
        'company': 'company name',
        'title': 'job title'
    };
    
    return sortOptions[sortOption] || sortOption;
}