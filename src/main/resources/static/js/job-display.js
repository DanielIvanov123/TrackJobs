/**
 * job-display.js - Job display and rendering functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the global object if it doesn't exist
    window.trackjobs = window.trackjobs || {};
    window.trackjobs.elements = window.trackjobs.elements || {};
    
    // Store the jobs container reference if it doesn't exist yet
    if (!window.trackjobs.elements.jobsContainer) {
        window.trackjobs.elements.jobsContainer = document.getElementById('jobsContainer');
    }
});

/**
 * Display jobs in the container with click handlers for job details
 */
function displayJobs(jobs) {
    // Get the jobs container from trackjobs object
    const jobsContainer = window.trackjobs.elements.jobsContainer;
    
    // Ensure jobs container exists
    if (!jobsContainer) {
        jobsContainer = document.getElementById('jobsContainer');
        if (!jobsContainer) {
            console.error('Jobs container not found');
            return;
        }
    }

    // Find main jobs container if not already set
    if (!window.jobsContainer) {
        window.jobsContainer = document.getElementById('jobsContainer');
    }
    
    // Clear container
    jobsContainer.innerHTML = '';
    
    if (!jobs || jobs.length === 0) {
        showNoJobsMessage();
        return;
    }
    
    // Create a card for each job
    jobs.forEach(job => {
        const status = job.applicationStatus || 'SAVED';
        const statusClass = `status-${status}`;
        const statusDisplay = getStatusDisplayName(status);
        const statusIcon = getStatusIcon(status);
        
        const jobCard = document.createElement('div');
        jobCard.className = 'col-md-4 mb-4';
        jobCard.innerHTML = `
            <div class="card h-100 job-card ${statusClass}" data-job-id="${job.id}">
                ${status !== 'SAVED' ? `<div class="status-ribbon ${statusClass}">${statusDisplay}</div>` : ''}
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title">${escapeHtml(job.title)}</h5>
                    </div>
                    <h6 class="card-subtitle mb-3">${escapeHtml(job.company)}</h6>
                    
                    <span class="status-badge ${statusClass} mb-3">
                        ${statusIcon} ${statusDisplay}
                    </span>
                    
                    <p class="card-text">
                        <i class="bi bi-geo-alt-fill"></i> ${escapeHtml(job.location)}<br>
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
        
        jobsContainer.appendChild(jobCard);
    });
    
    // Add click handlers to job cards
    addJobCardClickHandlers();
}

/**
 * Display recently scraped jobs
 */
function displayRecentScrapedJobs(jobs) {
    const recentScrapedJobsContainer = document.getElementById('recentScrapedJobs');
    if (!recentScrapedJobsContainer) return;
    
    // Clear container
    recentScrapedJobsContainer.innerHTML = '';
    
    if (!jobs || jobs.length === 0) {
        showNoRecentJobsMessage();
        return;
    }
    
    // Create a row for the jobs
    const row = document.createElement('div');
    row.className = 'row';
    
    // Create a card for each job (limit to 3)
    const maxJobsToShow = Math.min(jobs.length, 3);
    for (let i = 0; i < maxJobsToShow; i++) {
        const job = jobs[i];
        const status = job.applicationStatus || 'SAVED';
        const statusClass = `status-${status}`;
        const statusDisplay = getStatusDisplayName(status);
        const statusIcon = getStatusIcon(status);
        
        const jobCard = document.createElement('div');
        jobCard.className = 'col-md-4 mb-4';
        jobCard.innerHTML = `
            <div class="card h-100 job-card ${statusClass}" data-job-id="${job.id}">
                ${status !== 'SAVED' ? `<div class="status-ribbon ${statusClass}">${statusDisplay}</div>` : ''}
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title">${escapeHtml(job.title)}</h5>
                    </div>
                    <h6 class="card-subtitle mb-3">${escapeHtml(job.company)}</h6>
                    
                    <span class="status-badge ${statusClass} mb-3">
                        ${statusIcon} ${statusDisplay}
                    </span>
                    
                    <p class="card-text">
                        <i class="bi bi-geo-alt-fill"></i> ${escapeHtml(job.location)}<br>
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
        
        row.appendChild(jobCard);
    }
    
    // Add view all button if needed
    if (jobs.length > 3) {
        const viewAllDiv = document.createElement('div');
        viewAllDiv.className = 'col-12 text-center mt-3';
        viewAllDiv.innerHTML = `
            <button class="btn btn-outline-primary" id="viewAllJobsBtn">
                <i class="bi bi-list me-2"></i>View All ${jobs.length} Jobs
            </button>
        `;
        row.appendChild(viewAllDiv);
        
        // Add event listener
        setTimeout(() => {
            const viewAllBtn = document.getElementById('viewAllJobsBtn');
            if (viewAllBtn) {
                viewAllBtn.addEventListener('click', function() {
                    // Switch to search tab
                    if (typeof showSearchTab === 'function') {
                        showSearchTab();
                    } else {
                        // Fallback if function isn't available
                        document.getElementById('searchTabLink')?.click();
                    }
                    
                    // Update the search form to match the scrape
                    if (document.getElementById('searchKeywords') && document.getElementById('keywords')) {
                        document.getElementById('searchKeywords').value = document.getElementById('keywords').value;
                    }
                    if (document.getElementById('searchLocation') && document.getElementById('location')) {
                        document.getElementById('searchLocation').value = document.getElementById('location').value;
                    }
                    
                    // Trigger a search
                    setTimeout(() => {
                        if (typeof searchJobs === 'function') {
                            searchJobs();
                        }
                    }, 500);
                });
            }
        }, 100);
    }
    
    recentScrapedJobsContainer.appendChild(row);
    
    // Add click handlers to job cards
    addJobCardClickHandlers();
}

/**
 * Add click handlers to all job cards on the page
 */
function addJobCardClickHandlers() {
    console.log('Setting up job card click handlers');
    
    // Add event listener to view details buttons specifically (more reliable)
    document.querySelectorAll('.view-job-details-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            // Stop event propagation to prevent duplicate handling
            e.preventDefault();
            e.stopPropagation();
            
            // Get job ID
            const jobId = this.getAttribute('data-job-id');
            console.log('View details button clicked for job ID:', jobId);
            
            if (jobId) {
                // Open the details modal
                if (typeof openJobDetailsModal === 'function') {
                    openJobDetailsModal(jobId);
                } else {
                    console.error('openJobDetailsModal function not found');
                }
            } else {
                console.error('No job ID found on button');
            }
        });
    });
    
    // Add event listener to job cards as a secondary option
    document.querySelectorAll('.job-card').forEach(card => {
        card.addEventListener('click', function(e) {
            // Get job ID
            const jobId = this.getAttribute('data-job-id');
            console.log('Job card clicked for job ID:', jobId);
            
            if (jobId) {
                // Open the details modal
                if (typeof openJobDetailsModal === 'function') {
                    openJobDetailsModal(jobId);
                } else {
                    console.error('openJobDetailsModal function not found');
                }
            } else {
                console.error('No job ID found on card');
            }
        });
    });
}

/**
 * Show no jobs message
 */
function showNoJobsMessage() {
    // Get the currently selected status filter
    const activeFilter = document.querySelector('.status-filter-pill.active');
    const status = activeFilter ? activeFilter.getAttribute('data-status') : 'ALL';
    const statusName = status === 'ALL' ? 'jobs' : getStatusDisplayName(status).toLowerCase() + ' jobs';
    
    if (jobsContainer) {
        jobsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle-fill me-2"></i>
                    No ${statusName} found. ${status === 'ALL' ? 'Try different search criteria or use the scraper to get new jobs.' : ''}
                </div>
            </div>
        `;
    }
}

/**
 * Show no recent jobs message
 */
function showNoRecentJobsMessage() {
    const recentScrapedJobsContainer = document.getElementById('recentScrapedJobs');
    if (!recentScrapedJobsContainer) return;
    
    recentScrapedJobsContainer.innerHTML = `
        <div class="col-12 text-center">
            <p class="text-muted">No recently scraped jobs to display</p>
        </div>
    `;
}