/**
 * status-management.js - Updated with improved status handling
 * Fixed version with properly defined functions
 */

(function() {
    // Cache DOM elements
    let statusFilterPills;
    
    // Add event listeners when document is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Get all status filter pills
        statusFilterPills = document.querySelectorAll('.status-filter-pill');
        
        // Add event listeners to status filter pills
        statusFilterPills.forEach(pill => {
            pill.addEventListener('click', handleStatusFilterClick);
        });
    });
    
    /**
     * Handle status filter pill click with enhanced visual feedback
     */
    function handleStatusFilterClick() {
        // Add active class for clicked pill and remove from others
        statusFilterPills.forEach(p => {
            p.classList.remove('active');
        });
        this.classList.add('active');
        
        // Animate the transition
        this.style.transform = 'scale(1.05)';
        setTimeout(() => {
            this.style.transform = '';
        }, 200);
        
        // Get status to filter by
        const status = this.getAttribute('data-status');
        
        // Set the dropdown value to match
        const statusDropdown = document.getElementById('searchApplicationStatus');
        if (statusDropdown) {
            statusDropdown.value = status;
        }
        
        // Trigger search with new filter
        if (typeof searchJobs === 'function') {
            searchJobs();
        }
    }
    
    /**
     * Update job application status with improved error handling and optimistic UI updates
     * @param {String|Number} jobId - ID of the job to update
     * @param {String} newStatus - New status value
     * @return {Promise} Promise resolving to updated job object
     */
    function updateJobStatus(jobId, newStatus) {
        // Get CSRF token
        const csrfToken = getCsrfToken();
        const csrfHeader = getCsrfHeader();
        
        if (!csrfToken || !csrfHeader) {
            return Promise.reject(new Error('Security tokens not found'));
        }
        
        // Create request payload
        const payload = {
            status: newStatus
        };
        
        console.log(`Updating job ${jobId} status to ${newStatus}`);
        
        // Make API request to update job status
        return fetch(`/api/jobs/${jobId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Update local job cache if available
                if (window.trackjobs && window.trackjobs.currentJobs) {
                    const jobIndex = window.trackjobs.currentJobs.findIndex(job => job.id == jobId);
                    if (jobIndex !== -1) {
                        window.trackjobs.currentJobs[jobIndex].applicationStatus = newStatus;
                    }
                }
                
                return data.job;
            } else {
                throw new Error(data.message || 'Unknown error updating job status');
            }
        });
    }
    
    /**
     * Update status counts in filter pills with animation
     * @param {Array} jobs - Array of job objects
     */
    function updateStatusCounts(jobs) {
        if (!jobs) return;
        
        // Initialize counts
        const counts = {
            'ALL': jobs.length,
            'SAVED': 0,
            'APPLIED': 0,
            'INTERVIEWING': 0,
            'REJECTED': 0,
            'OFFER': 0
        };
        
        // Count jobs by status
        jobs.forEach(job => {
            const status = job.applicationStatus || 'SAVED';
            counts[status] = (counts[status] || 0) + 1;
        });
        
        // Update count elements with animation
        updateCountWithAnimation('countAll', counts['ALL']);
        updateCountWithAnimation('countSaved', counts['SAVED']);
        updateCountWithAnimation('countApplied', counts['APPLIED']);
        updateCountWithAnimation('countInterviewing', counts['INTERVIEWING']);
        updateCountWithAnimation('countRejected', counts['REJECTED']);
        updateCountWithAnimation('countOffer', counts['OFFER']);
    }
    
    /**
     * Update count element with animation
     * @param {String} elementId - ID of count element
     * @param {Number} newCount - New count value
     */
    function updateCountWithAnimation(elementId, newCount) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const currentCount = parseInt(element.textContent);
        
        // Skip animation if counts are the same
        if (currentCount === newCount) return;
        
        // Simple animation using highlight
        element.style.backgroundColor = '#e7f5ff';
        element.textContent = newCount;
        
        // Fade back to normal
        setTimeout(() => {
            element.style.transition = 'background-color 0.5s';
            element.style.backgroundColor = '';
        }, 10);
    }
    
    /**
     * Get display name for application status
     * @param {String} status - Status code
     * @return {String} Human-readable status name
     */
    function getStatusDisplayName(status) {
        const statusMap = {
            'SAVED': 'Saved',
            'APPLIED': 'Applied',
            'INTERVIEWING': 'Interviewing',
            'REJECTED': 'Rejected',
            'OFFER': 'Offer'
        };
        
        return statusMap[status] || 'Saved';
    }
    
    /**
     * Get icon for application status
     * @param {String} status - Status code
     * @return {String} HTML for the status icon
     */
    function getStatusIcon(status) {
        const iconMap = {
            'SAVED': '<i class="bi bi-bookmark"></i>',
            'APPLIED': '<i class="bi bi-send"></i>',
            'INTERVIEWING': '<i class="bi bi-people"></i>',
            'REJECTED': '<i class="bi bi-x-circle"></i>',
            'OFFER': '<i class="bi bi-trophy"></i>'
        };
        
        return iconMap[status] || '<i class="bi bi-bookmark"></i>';
    }
    
    // Expose functions to global scope
    window.updateJobStatus = updateJobStatus;
    window.updateStatusCounts = updateStatusCounts;
    window.getStatusDisplayName = getStatusDisplayName;
    window.getStatusIcon = getStatusIcon;
})();