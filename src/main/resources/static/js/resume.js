/**
 * resume.js - Handles resume upload, download, and management
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize resume management
    initResumeManagement();
});

/**
 * Initialize resume management functionality
 */
function initResumeManagement() {
    // Cache DOM elements
    const resumeModal = document.getElementById('resumeModal');
    const resumeUploadForm = document.getElementById('resumeUploadForm');
    const resumeFile = document.getElementById('resumeFile');
    const uploadResumeBtn = document.getElementById('uploadResumeBtn');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = uploadProgress.querySelector('.progress-bar');
    const resumeUploadError = document.getElementById('resumeUploadError');
    const resumeUploadSuccess = document.getElementById('resumeUploadSuccess');
    const currentResumeInfo = document.getElementById('currentResumeInfo');
    const resumeFileName = document.getElementById('resumeFileName');
    const resumeFileSize = document.getElementById('resumeFileSize');
    const resumeUploadDate = document.getElementById('resumeUploadDate');
    const downloadResumeBtn = document.getElementById('downloadResumeBtn');
    const deleteResumeBtn = document.getElementById('deleteResumeBtn');
    const uploadResumeTitle = document.getElementById('uploadResumeTitle');
    
    // Load resume info when modal is opened
    if (resumeModal) {
        resumeModal.addEventListener('show.bs.modal', function() {
            loadResumeInfo();
        });
    }
    
    // Handle resume upload form submission
    if (resumeUploadForm) {
        resumeUploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Reset error and success messages
            resumeUploadError.classList.add('d-none');
            resumeUploadSuccess.classList.add('d-none');
            
            // Check if a file is selected
            if (!resumeFile.files || resumeFile.files.length === 0) {
                resumeUploadError.textContent = 'Please select a resume file';
                resumeUploadError.classList.remove('d-none');
                return;
            }
            
            const file = resumeFile.files[0];
            
            // Validate file type
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!allowedTypes.includes(file.type)) {
                resumeUploadError.textContent = 'Invalid file type. Only PDF, DOC, and DOCX files are allowed';
                resumeUploadError.classList.remove('d-none');
                return;
            }
            
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                resumeUploadError.textContent = 'File size exceeds the maximum limit of 5MB';
                resumeUploadError.classList.remove('d-none');
                return;
            }
            
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            
            // Get CSRF token
            const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
            const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
            
            // Show progress bar
            uploadProgress.classList.remove('d-none');
            progressBar.style.width = '0%';
            progressBar.setAttribute('aria-valuenow', '0');
            progressBar.textContent = '0%';
            
            // Disable upload button
            uploadResumeBtn.disabled = true;
            
            // Upload the resume
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = percent + '%';
                    progressBar.setAttribute('aria-valuenow', percent);
                    progressBar.textContent = percent + '%';
                }
            });
            
            // Handle upload completion
            xhr.addEventListener('load', function() {
                uploadResumeBtn.disabled = false;
                
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        
                        if (response.success) {
                            // Show success message
                            resumeUploadSuccess.textContent = 'Resume uploaded successfully';
                            resumeUploadSuccess.classList.remove('d-none');
                            
                            // Clear file input
                            resumeFile.value = '';
                            
                            // Reload resume info
                            loadResumeInfo();
                            
                            // Hide progress after a delay
                            setTimeout(function() {
                                uploadProgress.classList.add('d-none');
                                resumeUploadSuccess.classList.add('d-none');
                            }, 3000);
                        } else {
                            // Show error message
                            resumeUploadError.textContent = response.message || 'Error uploading resume';
                            resumeUploadError.classList.remove('d-none');
                            uploadProgress.classList.add('d-none');
                        }
                    } catch (e) {
                        resumeUploadError.textContent = 'Error parsing server response';
                        resumeUploadError.classList.remove('d-none');
                        uploadProgress.classList.add('d-none');
                    }
                } else {
                    resumeUploadError.textContent = 'Error uploading resume: ' + xhr.statusText;
                    resumeUploadError.classList.remove('d-none');
                    uploadProgress.classList.add('d-none');
                }
            });
            
            // Handle network errors
            xhr.addEventListener('error', function() {
                uploadResumeBtn.disabled = false;
                resumeUploadError.textContent = 'Network error. Please try again';
                resumeUploadError.classList.remove('d-none');
                uploadProgress.classList.add('d-none');
            });
            
            // Send the request
            xhr.open('POST', '/api/resume/upload');
            xhr.setRequestHeader(csrfHeader, csrfToken);
            xhr.send(formData);
        });
    }
    
    // Handle resume deletion
    if (deleteResumeBtn) {
        deleteResumeBtn.addEventListener('click', function() {
            if (!confirm('Are you sure you want to delete your resume?')) {
                return;
            }
            
            // Get resume ID from button data attribute
            const resumeId = this.dataset.resumeId;
            if (!resumeId) {
                return;
            }
            
            // Get CSRF token
            const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
            const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
            
            // Delete the resume
            fetch(`/api/resume/${resumeId}`, {
                method: 'DELETE',
                headers: {
                    [csrfHeader]: csrfToken
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    resumeUploadSuccess.textContent = 'Resume deleted successfully';
                    resumeUploadSuccess.classList.remove('d-none');
                    
                    // Hide current resume info
                    currentResumeInfo.classList.add('d-none');
                    
                    // Update upload form title
                    uploadResumeTitle.textContent = 'Upload Your Resume';
                    
                    // Hide success message after a delay
                    setTimeout(function() {
                        resumeUploadSuccess.classList.add('d-none');
                    }, 3000);
                } else {
                    // Show error message
                    resumeUploadError.textContent = data.message || 'Error deleting resume';
                    resumeUploadError.classList.remove('d-none');
                }
            })
            .catch(error => {
                resumeUploadError.textContent = 'Error deleting resume: ' + error.message;
                resumeUploadError.classList.remove('d-none');
            });
        });
    }
    
    /**
     * Load resume information from the server
     */
    function loadResumeInfo() {
        // Reset UI
        currentResumeInfo.classList.add('d-none');
        resumeUploadError.classList.add('d-none');
        resumeUploadSuccess.classList.add('d-none');
        uploadProgress.classList.add('d-none');
        
        // Get CSRF token
        const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
        
        // Get resume info
        fetch('/api/resume/info', {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.hasResume) {
                    // Update resume info
                    resumeFileName.textContent = data.resume.fileName;
                    
                    // Format file size (KB or MB)
                    const sizeInKB = Math.round(data.resume.fileSize / 1024);
                    resumeFileSize.textContent = sizeInKB >= 1024 ? 
                        (Math.round(sizeInKB / 102.4) / 10) + ' MB' : 
                        sizeInKB + ' KB';
                    
                    // Format upload date
                    const uploadDate = new Date(data.resume.uploadedAt);
                    resumeUploadDate.textContent = uploadDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    
                    // Set download URL
                    downloadResumeBtn.href = `/api/resume/download/${data.resume.id}`;
                    
                    // Set resume ID for delete button
                    deleteResumeBtn.dataset.resumeId = data.resume.id;
                    
                    // Show current resume info
                    currentResumeInfo.classList.remove('d-none');
                    
                    // Update upload form title
                    uploadResumeTitle.textContent = 'Update Your Resume';
                }
            } else {
                resumeUploadError.textContent = data.message || 'Error loading resume information';
                resumeUploadError.classList.remove('d-none');
            }
        })
        .catch(error => {
            resumeUploadError.textContent = 'Error loading resume information: ' + error.message;
            resumeUploadError.classList.remove('d-none');
        });
    }
}