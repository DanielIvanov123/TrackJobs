package com.trackjobs.service;

import com.trackjobs.model.Resume;
import com.trackjobs.model.User;
import com.trackjobs.repository.ResumeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Service for handling resume operations
 */
@Service
@Slf4j
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final FileStorageService fileStorageService;
    
    // Use constructor injection without @RequiredArgsConstructor to handle circular dependency
    private final UserService userService;

    public ResumeService(
            ResumeRepository resumeRepository,
            FileStorageService fileStorageService,
            @Lazy UserService userService) {
        this.resumeRepository = resumeRepository;
        this.fileStorageService = fileStorageService;
        this.userService = userService;
    }
    
    /**
     * Upload a resume for the current user
     * 
     * @param file The resume file to upload
     * @return The saved resume entity
     * @throws Exception If an error occurs during upload
     */
    @Transactional
    public Resume uploadResume(MultipartFile file) throws Exception {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Resume file cannot be empty");
        }
        
        // Check file size (limit to 5MB)
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("Resume file size exceeds the maximum limit of 5MB");
        }
        
        // Check file type (allow only PDF, DOC, DOCX)
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equals("application/pdf") && 
                !contentType.equals("application/msword") && 
                !contentType.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))) {
            throw new IllegalArgumentException("Invalid file type. Only PDF, DOC, and DOCX files are allowed");
        }
        
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("You must be logged in to upload a resume");
        }
        
        // Get the original filename
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            originalFilename = "resume" + (contentType.equals("application/pdf") ? ".pdf" : 
                    contentType.equals("application/msword") ? ".doc" : ".docx");
        }
        
        // Store the file
        String filePath = fileStorageService.storeFile(file, currentUser.getId());
        
        // Delete any existing resumes for this user
        List<Resume> existingResumes = resumeRepository.findByUser(currentUser);
        for (Resume existingResume : existingResumes) {
            fileStorageService.deleteFile(existingResume.getFilePath());
            resumeRepository.delete(existingResume);
        }
        
        // Create a new resume entity
        Resume resume = Resume.builder()
                .fileName(originalFilename)
                .contentType(contentType)
                .filePath(filePath)
                .fileSize(file.getSize())
                .uploadedAt(LocalDateTime.now())
                .user(currentUser)
                .build();
        
        // Save and return the resume
        Resume savedResume = resumeRepository.save(resume);
        log.info("Resume uploaded for user {}: {}", currentUser.getUsername(), savedResume.getFileName());
        
        return savedResume;
    }
    
    /**
     * Get the resume of the current user
     * 
     * @return Optional containing the resume, or empty if not found
     */
    @Transactional(readOnly = true)
    public Optional<Resume> getCurrentUserResume() {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return Optional.empty();
        }
        
        List<Resume> resumes = resumeRepository.findByUser(currentUser);
        return resumes.isEmpty() ? Optional.empty() : Optional.of(resumes.get(0));
    }
    
    /**
     * Get a resume file by its ID
     * 
     * @param resumeId The ID of the resume
     * @return A byte array containing the resume file
     * @throws Exception If the resume is not found or cannot be read
     */
    @Transactional(readOnly = true)
    public byte[] getResumeFile(Long resumeId) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("You must be logged in to access resumes");
        }
        
        Resume resume = resumeRepository.findByIdAndUser(resumeId, currentUser)
                .orElseThrow(() -> new IllegalArgumentException("Resume not found or you don't have permission to access it"));
        
        return fileStorageService.getFile(resume.getFilePath());
    }
    
    /**
     * Delete a resume by its ID
     * 
     * @param resumeId The ID of the resume to delete
     * @return true if the resume was deleted, false otherwise
     */
    @Transactional
    public boolean deleteResume(Long resumeId) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return false;
        }
        
        Optional<Resume> resumeOpt = resumeRepository.findByIdAndUser(resumeId, currentUser);
        if (resumeOpt.isEmpty()) {
            return false;
        }
        
        Resume resume = resumeOpt.get();
        boolean fileDeleted = fileStorageService.deleteFile(resume.getFilePath());
        
        if (fileDeleted) {
            resumeRepository.delete(resume);
            log.info("Resume deleted for user {}: {}", currentUser.getUsername(), resume.getFileName());
            return true;
        }
        
        return false;
    }
    
    /**
     * Delete all resumes for a user (used during account deletion)
     * 
     * @param user The user whose resumes should be deleted
     */
    @Transactional
    public void deleteAllResumesForUser(User user) {
        List<Resume> resumes = resumeRepository.findByUser(user);
        
        for (Resume resume : resumes) {
            fileStorageService.deleteFile(resume.getFilePath());
        }
        
        resumeRepository.deleteByUser(user);
        log.info("All resumes deleted for user {}", user.getUsername());
    }
}