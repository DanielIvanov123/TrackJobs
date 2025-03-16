/**
 * claude-document-generator.js - Handles document generation using Claude API
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize document generation
    initDocumentGeneration();
});

/**
 * Show alert message with cleanup
 * @param {String} message - Message to display
 * @param {String} type - Alert type (success, danger, warning, info)
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
 * Initialize document generation functionality
 */
function initDocumentGeneration() {
    // Cache DOM elements
    const jobDetailsModal = document.getElementById('jobDetailsModal');
    const generateTailoredResumeBtn = document.getElementById('generateTailoredResumeBtn');
    const generateCoverLetterBtn = document.getElementById('generateCoverLetterBtn');
    
    // Check if generate buttons exist
    if (generateTailoredResumeBtn || generateCoverLetterBtn) {
        // Check if job details modal exists
        if (jobDetailsModal) {
            // Add event listener to modal to check for API key
            jobDetailsModal.addEventListener('show.bs.modal', async function() {
                try {
                    // Check if user has Claude API key
                    const hasClaudeApiKey = await checkClaudeApiKey();
                    
                    // Enable/disable generate buttons based on API key
                    if (generateTailoredResumeBtn) {
                        generateTailoredResumeBtn.disabled = !hasClaudeApiKey;
                        
                        if (!hasClaudeApiKey) {
                            generateTailoredResumeBtn.title = 'Claude API key required';
                        } else {
                            generateTailoredResumeBtn.title = 'Generate a tailored resume for this job';
                        }
                    }
                    
                    if (generateCoverLetterBtn) {
                        generateCoverLetterBtn.disabled = !hasClaudeApiKey;
                        
                        if (!hasClaudeApiKey) {
                            generateCoverLetterBtn.title = 'Claude API key required';
                        } else {
                            generateCoverLetterBtn.title = 'Generate a cover letter for this job';
                        }
                    }
                } catch (error) {
                    console.error('Error checking Claude API key:', error);
                }
            });
        }
    }
    
    // Add event listeners to generate buttons
    if (generateTailoredResumeBtn) {
        generateTailoredResumeBtn.addEventListener('click', function() {
            const jobId = this.dataset.jobId;
            if (jobId) {
                generateDocument('resume', jobId);
            }
        });
    }
    
    if (generateCoverLetterBtn) {
        generateCoverLetterBtn.addEventListener('click', function() {
            const jobId = this.dataset.jobId;
            if (jobId) {
                generateDocument('coverLetter', jobId);
            }
        });
    }
}

// Store the current document type and content globally for download
let currentDocumentType = '';
let currentDocumentContent = '';

/**
 * Generate a document using Claude API
 * @param {string} type - Type of document to generate ('resume' or 'coverLetter')
 * @param {string} jobId - ID of the job
 */
function generateDocument(type, jobId) {
    // Update UI to show loading state
    const button = type === 'resume' ? document.getElementById('generateTailoredResumeBtn') : document.getElementById('generateCoverLetterBtn');
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
    button.disabled = true;
    
    // Store the document type
    currentDocumentType = type;
    
    // Show alert for user to know generation is in progress
    showAlert(`Generating ${type === 'resume' ? 'tailored resume' : 'cover letter'}. This may take a minute...`, 'info');
    
    // Show the generation modal in advance with loading indicator
    showGeneratedDocumentModalWithLoading(type);
    
    // Get CSRF token
    const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
    const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
    
    // Determine API endpoint based on document type
    const endpoint = type === 'resume' ? '/api/claude/tailor-resume' : '/api/claude/cover-letter';
    
    // Make API request to generate document
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            [csrfHeader]: csrfToken
        },
        body: JSON.stringify({ jobId: jobId })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(errorData)}`);
            }).catch(e => {
                // If we can't parse the JSON, just throw with status
                throw new Error(`${response.status} ${response.statusText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        // Reset button state
        button.innerHTML = originalText;
        button.disabled = false;
        
        if (data.success && data.content) {
            // Store the document content for later use
            currentDocumentContent = data.content;
            
            // Update the already open modal with content
            updateGeneratedDocumentContent(data.content);
        } else {
            throw new Error(data.message || `Failed to generate ${type === 'resume' ? 'tailored resume' : 'cover letter'}`);
        }
    })
    .catch(error => {
        // Reset button state
        button.innerHTML = originalText;
        button.disabled = false;
        
        console.error(`Error generating ${type === 'resume' ? 'tailored resume' : 'cover letter'}:`, error);
        
        // Show error message
        showAlert(`Error: ${error.message}`, 'danger');
        
        // Update error in the modal instead of closing it
        const documentModal = document.getElementById('generatedDocumentModal');
        if (documentModal) {
            const loadingElement = documentModal.querySelector('#documentGenerationLoading');
            const contentElement = documentModal.querySelector('#generatedDocumentContent');
            const errorElement = documentModal.querySelector('#documentGenerationError');
            
            // Hide loading, show error
            if (loadingElement) loadingElement.style.display = 'none';
            if (contentElement) contentElement.style.display = 'none';
            if (errorElement) {
                errorElement.textContent = `Error: ${error.message}`;
                errorElement.classList.remove('d-none');
            }
        }
    });
}

/**
 * Show modal with loading indicator first
 * @param {string} type - Type of document ('resume' or 'coverLetter')
 */
function showGeneratedDocumentModalWithLoading(type) {
    // Create modal if it doesn't exist
    let documentModal = document.getElementById('generatedDocumentModal');
    
    if (!documentModal) {
        // Create modal element
        documentModal = document.createElement('div');
        documentModal.className = 'modal fade';
        documentModal.id = 'generatedDocumentModal';
        documentModal.tabIndex = '-1';
        documentModal.setAttribute('aria-labelledby', 'generatedDocumentModalLabel');
        documentModal.setAttribute('aria-hidden', 'true');
        
        // Create modal content
        documentModal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="generatedDocumentModalLabel">Generated Document</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div id="documentGenerationLoading" class="text-center my-5">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Generating document...</span>
                            </div>
                            <p class="mt-2">Generating document with Claude AI. This may take a minute...</p>
                        </div>
                        <div id="generatedDocumentContent" class="bg-light p-3 rounded overflow-auto generated-document" style="max-height: 60vh; display: none;"></div>
                        <div id="documentGenerationError" class="alert alert-danger mt-3 d-none"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="copyDocumentBtn">
                            <i class="bi bi-clipboard me-1"></i>Copy to Clipboard
                        </button>
                        <button type="button" class="btn btn-outline-primary" id="downloadDocumentBtn">
                            <i class="bi bi-download me-1"></i>Download as Text
                        </button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to document
        document.body.appendChild(documentModal);
    }
    
    // Update modal title based on document type
    const modalTitle = documentModal.querySelector('.modal-title');
    modalTitle.textContent = type === 'resume' ? 'Tailored Resume' : 'Cover Letter';
    
    // Get loading and content elements
    const loadingElement = documentModal.querySelector('#documentGenerationLoading');
    const contentElement = documentModal.querySelector('#generatedDocumentContent');
    
    // Make sure loading is visible and content is hidden
    if (loadingElement) loadingElement.style.display = 'block';
    if (contentElement) contentElement.style.display = 'none';
    
    // Show modal with loading indicator
    const bsModal = new bootstrap.Modal(documentModal);
    bsModal.show();
    
    // Setup event listeners once the modal is shown
    setupModalEventListeners();
}

/**
 * Setup event listeners for the document modal
 */
function setupModalEventListeners() {
    // Add event listener to copy button
    const copyBtn = document.getElementById('copyDocumentBtn');
    if (copyBtn) {
        // Remove any existing listeners
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
        
        // Add new listener
        newCopyBtn.addEventListener('click', function() {
            const content = currentDocumentContent || document.getElementById('generatedDocumentContent').textContent;
            
            navigator.clipboard.writeText(content)
                .then(() => {
                    // Show success message
                    const originalText = this.innerHTML;
                    this.innerHTML = '<i class="bi bi-check-lg me-1"></i>Copied!';
                    
                    // Reset button after 2 seconds
                    setTimeout(() => {
                        this.innerHTML = originalText;
                    }, 2000);
                })
                .catch(err => {
                    console.error('Error copying text: ', err);
                    showAlert('Failed to copy to clipboard', 'danger');
                });
        });
    }
    
    // Add event listener to download button
    const downloadBtn = document.getElementById('downloadDocumentBtn');
    if (downloadBtn) {
        // Remove any existing listeners
        const newDownloadBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
        
        // Add new listener
        newDownloadBtn.addEventListener('click', function() {
            downloadGeneratedDocument();
        });
    }
}

/**
 * Download the generated document as a text file
 */
function downloadGeneratedDocument() {
    console.log("Download triggered. Type:", currentDocumentType, "Content length:", currentDocumentContent.length);
    
    // Get content either from global variable or from DOM
    const content = currentDocumentContent || document.getElementById('generatedDocumentContent').textContent;
    
    // Create filename based on document type
    const docType = currentDocumentType === 'resume' ? 'Tailored_Resume' : 'Cover_Letter';
    const fileName = `${docType}_${new Date().toISOString().split('T')[0]}.txt`;
    
    // Create a blob with the text content
    const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a download link
    const element = document.createElement('a');
    element.href = url;
    element.download = fileName;
    element.style.display = 'none';
    
    // Add to DOM, trigger download, and clean up
    document.body.appendChild(element);
    element.click();
    
    // Cleanup
    setTimeout(() => {
        document.body.removeChild(element);
        URL.revokeObjectURL(url);
    }, 100);
    
    // Show confirmation
    showAlert(`Downloaded ${docType.replace('_', ' ')}`, 'success');
}

/**
 * Update the content of the already open document modal
 * @param {string} content - The content to display
 */
function updateGeneratedDocumentContent(content) {
    const documentModal = document.getElementById('generatedDocumentModal');
    if (!documentModal) return;
    
    // Get loading and content elements
    const loadingElement = documentModal.querySelector('#documentGenerationLoading');
    const contentElement = documentModal.querySelector('#generatedDocumentContent');
    const errorElement = documentModal.querySelector('#documentGenerationError');
    
    // Hide any error message
    if (errorElement) errorElement.classList.add('d-none');
    
    // Update content
    if (contentElement) {
        contentElement.innerHTML = formatDocumentContent(content);
        
        // Hide loading, show content
        if (loadingElement) loadingElement.style.display = 'none';
        contentElement.style.display = 'block';
        
        console.log('Document content updated and displayed');
    }
}

/**
 * Format document content for display
 * @param {string} content - Document content
 * @returns {string} Formatted HTML content
 */
function formatDocumentContent(content) {
    // Split content into paragraphs
    const paragraphs = content.split('\n\n');
    
    // Create HTML content
    let html = '';
    
    for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
            // Check if paragraph is a heading (starts with #)
            if (paragraph.startsWith('#')) {
                const level = paragraph.match(/^#+/)[0].length;
                const text = paragraph.replace(/^#+\s*/, '');
                html += `<h${level}>${text}</h${level}>`;
            }
            // Check if paragraph is a bullet list (starts with * or -)
            else if (paragraph.match(/^[\*\-] /m)) {
                const items = paragraph.split('\n').filter(line => line.trim());
                html += '<ul>';
                for (const item of items) {
                    const cleanItem = item.replace(/^[\*\-] /, '');
                    html += `<li>${cleanItem}</li>`;
                }
                html += '</ul>';
            }
            // Regular paragraph
            else {
                html += `<p>${paragraph.replace(/\n/g, '<br>')}</p>`;
            }
        }
    }
    
    return html;
}