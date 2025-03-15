/**
 * status-management.js - Application status management
 */

document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners to status filter pills
    document.querySelectorAll('.status-filter-pill').forEach(pill => {
        pill.addEventListener('click', handleStatusFilterClick);
    });
});

/**
 * Handle status filter pill click
 */
function handleStatusFilterClick() {
    // Update active pill
    document.querySelectorAll('.status-filter-pill').forEach(p => {
        p.classList.remove('active');
    });
    this.classList.add('active');
    
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
 * Update job application status
 */
function updateJobStatus(jobId, newStatus) {
    // Get CSRF token from meta tag
    const csrfToken = getCsrfToken();
    const csrfHeader = getCsrfHeader();
    
    if (!csrfToken || !csrfHeader) {
        return Promise.reject(new Error('CSRF tokens not found'));
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
            showAlert('Job status updated successfully', 'success');
            return data.job;
        } else {
            throw new Error(data.message || 'Unknown error updating job status');
        }
    });
}

/**
 * Update status counts in filter pills
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
    
    // Update count elements
    setTextContentSafely('countAll', counts['ALL']);
    setTextContentSafely('countSaved', counts['SAVED']);
    setTextContentSafely('countApplied', counts['APPLIED']);
    setTextContentSafely('countInterviewing', counts['INTERVIEWING']);
    setTextContentSafely('countRejected', counts['REJECTED']);
    setTextContentSafely('countOffer', counts['OFFER']);
}

/**
 * Get display name for application status
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