/**
 * job-display.js - Updated with individual status selectors
 * Optimized for efficient DOM manipulation and rendering performance
 */

(function() {
    // Cache DOM references
    let jobsContainer;
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        // Get reference to the jobs container
        jobsContainer = window.trackjobs?.elements?.jobsContainer || document.getElementById('jobsContainer');
        
        // Store the reference in the global object
        if (window.trackjobs && !window.trackjobs.elements.jobsContainer) {
            window.trackjobs.elements.jobsContainer = jobsContainer;
        }
        
        // Use event delegation for job card interactions
        document.addEventListener('click', function(event) {
            // Handle view details button click
            const viewButton = event.target.closest('.view-job-details-btn');
            if (viewButton) {
                event.preventDefault();
                event.stopPropagation();
                
                const jobId = viewButton.getAttribute('data-job-id');
                if (jobId && typeof openJobDetailsModal === 'function') {
                    openJobDetailsModal(jobId);
                }
                return;
            }
            
            // Handle job card click
            const jobCard = event.target.closest('.job-card');
            if (jobCard && !event.target.closest('select') && !event.target.closest('a')) {
                const jobId = jobCard.getAttribute('data-job-id');
                if (jobId && typeof openJobDetailsModal === 'function') {
                    openJobDetailsModal(jobId);
                }
            }
        });
        
        // Add event listener for status selectors
        document.addEventListener('change', function(event) {
            const statusSelect = event.target.closest('.job-status-select');
            if (statusSelect) {
                const jobId = statusSelect.getAttribute('data-job-id');
                const newStatus = statusSelect.value;
                
                if (jobId && newStatus && typeof updateJobStatus === 'function') {
                    // Show updating indicator
                    const statusBadge = document.querySelector(`.status-badge[data-job-id="${jobId}"]`);
                    if (statusBadge) {
                        statusBadge.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i> Updating...';
                    }
                    
                    // Update job status
                    updateJobStatus(jobId, newStatus)
                        .then(() => {
                            // Apply visual updates to the card
                            const jobCard = document.querySelector(`.job-card[data-job-id="${jobId}"]`);
                            if (jobCard) {
                                // Remove existing status classes
                                jobCard.classList.forEach(className => {
                                    if (className.startsWith('status-')) {
                                        jobCard.classList.remove(className);
                                    }
                                });
                                
                                // Add new status class
                                jobCard.classList.add(`status-${newStatus}`);
                                
                                // Update status badge
                                if (statusBadge) {
                                    // Remove existing status classes
                                    statusBadge.classList.forEach(className => {
                                        if (className.startsWith('status-')) {
                                            statusBadge.classList.remove(className);
                                        }
                                    });
                                    
                                    // Add new status class
                                    statusBadge.classList.add(`status-${newStatus}`);
                                    statusBadge.innerHTML = `${getStatusIcon(newStatus)} ${getStatusDisplayName(newStatus)}`;
                                }
                                
                                // Update ribbon if needed
                                let ribbon = jobCard.querySelector('.status-ribbon');
                                if (newStatus !== 'SAVED') {
                                    if (ribbon) {
                                        // Update existing ribbon
                                        ribbon.className = `status-ribbon status-${newStatus}`;
                                        ribbon.textContent = getStatusDisplayName(newStatus);
                                    } else {
                                        // Create new ribbon
                                        ribbon = document.createElement('div');
                                        ribbon.className = `status-ribbon status-${newStatus}`;
                                        ribbon.textContent = getStatusDisplayName(newStatus);
                                        jobCard.appendChild(ribbon);
                                    }
                                } else if (ribbon) {
                                    // Remove ribbon for SAVED status
                                    ribbon.remove();
                                }
                            }
                            
                            // Show success message
                            showAlert(`Job status updated to ${getStatusDisplayName(newStatus)}`, 'success');
                            
                            // Update status counts if available
                            if (typeof updateStatusCounts === 'function' && window.trackjobs?.currentJobs) {
                                // Find and update job in current jobs array
                                const jobIndex = window.trackjobs.currentJobs.findIndex(j => j.id == jobId);
                                if (jobIndex !== -1) {
                                    window.trackjobs.currentJobs[jobIndex].applicationStatus = newStatus;
                                    updateStatusCounts(window.trackjobs.currentJobs);
                                }
                            }
                        })
                        .catch(error => {
                            console.error('Error updating job status:', error);
                            showAlert(`Error updating status: ${error.message}`, 'danger');
                            
                            // Reset selector to original value
                            const jobCard = document.querySelector(`.job-card[data-job-id="${jobId}"]`);
                            if (statusBadge && jobCard) {
                                // Find current status from card classes
                                let originalStatus = 'SAVED';
                                jobCard.classList.forEach(className => {
                                    if (className.startsWith('status-')) {
                                        originalStatus = className.replace('status-', '');
                                    }
                                });
                                
                                statusBadge.innerHTML = `${getStatusIcon(originalStatus)} ${getStatusDisplayName(originalStatus)}`;
                                statusSelect.value = originalStatus;
                            }
                        });
                }
            }
        });
    });
    
    /**
     * Display jobs with optimized DOM operations and individual status selectors
     * @param {Array} jobs - Array of job objects
     */
    function displayJobs(jobs) {
        // Ensure jobs container exists
        if (!jobsContainer) {
            jobsContainer = document.getElementById('jobsContainer');
            if (!jobsContainer) {
                console.error('Jobs container not found');
                return;
            }
        }
        
        // Clear container - optimized by setting innerHTML once
        jobsContainer.innerHTML = '';
        
        if (!jobs || jobs.length === 0) {
            showNoJobsMessage();
            return;
        }
        
        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();
        
        // Process jobs in batches for better UI responsiveness
        const batchSize = 20;
        const totalBatches = Math.ceil(jobs.length / batchSize);
        
        // Process first batch immediately
        processBatch(0);
        
        /**
         * Process a batch of jobs for rendering
         * @param {Number} batchIndex - Current batch index
         */
        function processBatch(batchIndex) {
            if (batchIndex >= totalBatches) {
                // All batches processed
                jobsContainer.appendChild(fragment);
                return;
            }
            
            const startIdx = batchIndex * batchSize;
            const endIdx = Math.min(startIdx + batchSize, jobs.length);
            
            for (let i = startIdx; i < endIdx; i++) {
                const job = jobs[i];
                const status = job.applicationStatus || 'SAVED';
                const statusClass = `status-${status}`;
                const statusDisplay = getStatusDisplayName(status);
                const statusIcon = getStatusIcon(status);
                
                // Create job card
                const jobCard = document.createElement('div');
                jobCard.className = 'col-md-4 mb-4';
                
                // Generate status selector HTML
                const statusOptions = [
                    { value: 'SAVED', label: 'Saved', icon: 'bookmark' },
                    { value: 'APPLIED', label: 'Applied', icon: 'send' },
                    { value: 'INTERVIEWING', label: 'Interviewing', icon: 'people' },
                    { value: 'OFFER', label: 'Offer', icon: 'trophy' },
                    { value: 'REJECTED', label: 'Rejected', icon: 'x-circle' }
                ];
                
                const statusSelectOptions = statusOptions.map(option => 
                    `<option value="${option.value}" ${status === option.value ? 'selected' : ''}>
                        ${option.label}
                    </option>`
                ).join('');
                
                // Set innerHTML for the job card with status selector
                jobCard.innerHTML = `
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
                                        ${statusSelectOptions}
                                    </select>
                                </div>
                            </div>
                            
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
                
                fragment.appendChild(jobCard);
            }
            
            // Schedule next batch using requestAnimationFrame for better performance
            requestAnimationFrame(() => {
                processBatch(batchIndex + 1);
            });
        }
    }
    
    /**
     * Display recently scraped jobs with improved performance
     * @param {Array} jobs - Array of job objects
     */
    function displayRecentScrapedJobs(jobs) {
        const recentScrapedJobsContainer = document.getElementById('recentScrapedJobs');
        if (!recentScrapedJobsContainer) return;
        
        // Clear container once
        recentScrapedJobsContainer.innerHTML = '';
        
        if (!jobs || jobs.length === 0) {
            showNoRecentJobsMessage();
            return;
        }
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
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
            
            // Generate status selector HTML
            const statusOptions = [
                { value: 'SAVED', label: 'Saved', icon: 'bookmark' },
                { value: 'APPLIED', label: 'Applied', icon: 'send' },
                { value: 'INTERVIEWING', label: 'Interviewing', icon: 'people' },
                { value: 'OFFER', label: 'Offer', icon: 'trophy' },
                { value: 'REJECTED', label: 'Rejected', icon: 'x-circle' }
            ];
            
            const statusSelectOptions = statusOptions.map(option => 
                `<option value="${option.value}" ${status === option.value ? 'selected' : ''}>
                    ${option.label}
                </option>`
            ).join('');
            
            // Create job card with status selector
            const jobCard = document.createElement('div');
            jobCard.className = 'col-md-4 mb-4';
            jobCard.innerHTML = `
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
                                    ${statusSelectOptions}
                                </select>
                            </div>
                        </div>
                        
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
        }
        
        fragment.appendChild(row);
        recentScrapedJobsContainer.appendChild(fragment);
        
        // Add event handlers
        if (jobs.length > 3) {
            const viewAllBtn = document.getElementById('viewAllJobsBtn');
            if (viewAllBtn) {
                viewAllBtn.addEventListener('click', function() {
                    // Switch to search tab
                    if (typeof showSearchTab === 'function') {
                        showSearchTab();
                    } else {
                        // Fallback
                        const searchTabLink = document.getElementById('searchTabLink');
                        if (searchTabLink) searchTabLink.click();
                    }
                    
                    // Update the search form to match the scrape
                    const searchKeywords = document.getElementById('searchKeywords');
                    const keywords = document.getElementById('keywords');
                    if (searchKeywords && keywords) {
                        searchKeywords.value = keywords.value;
                    }
                    
                    const searchLocation = document.getElementById('searchLocation');
                    const location = document.getElementById('location');
                    if (searchLocation && location) {
                        searchLocation.value = location.value;
                    }
                    
                    // Trigger a search
                    setTimeout(() => {
                        if (typeof searchJobs === 'function') {
                            searchJobs();
                        }
                    }, 100);
                });
            }
        }
    }
    
    /**
     * Show no jobs message
     */
    function showNoJobsMessage() {
        if (!jobsContainer) return;
        
        // Get the currently selected status filter
        const activeFilter = document.querySelector('.status-filter-pill.active');
        const status = activeFilter ? activeFilter.getAttribute('data-status') : 'ALL';
        const statusName = status === 'ALL' ? 'jobs' : getStatusDisplayName(status).toLowerCase() + ' jobs';
        
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
    
    // Add animation class for updating status
    const style = document.createElement('style');
    style.textContent = `
        .spin {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Expose functions to the global scope
    window.displayJobs = displayJobs;
    window.displayRecentScrapedJobs = displayRecentScrapedJobs;
    window.showNoJobsMessage = showNoJobsMessage;
})();