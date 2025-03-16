package com.trackjobs.controller;

import com.trackjobs.model.Resume;
import com.trackjobs.service.ResumeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Controller for handling resume uploads and downloads
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ResumeController {

    private final ResumeService resumeService;

    /**
     * API endpoint to upload a resume
     */
    @PostMapping("/api/resume/upload")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> uploadResume(@RequestParam("file") MultipartFile file) {
        try {
            Resume resume = resumeService.uploadResume(file);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Resume uploaded successfully");
            response.put("resume", Map.of(
                "id", resume.getId(),
                "fileName", resume.getFileName(),
                "fileSize", resume.getFileSize(),
                "uploadedAt", resume.getUploadedAt()
            ));
            
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid resume upload request: {}", e.getMessage());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            log.error("Error uploading resume: {}", e.getMessage(), e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Error uploading resume: " + e.getMessage());
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * API endpoint to get resume info for the current user
     */
    @GetMapping("/api/resume/info")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getResumeInfo() {
        Optional<Resume> resumeOpt = resumeService.getCurrentUserResume();
        
        Map<String, Object> response = new HashMap<>();
        if (resumeOpt.isPresent()) {
            Resume resume = resumeOpt.get();
            response.put("success", true);
            response.put("hasResume", true);
            response.put("resume", Map.of(
                "id", resume.getId(),
                "fileName", resume.getFileName(),
                "fileSize", resume.getFileSize(),
                "uploadedAt", resume.getUploadedAt()
            ));
        } else {
            response.put("success", true);
            response.put("hasResume", false);
        }
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * API endpoint to download a resume
     */
    @GetMapping("/api/resume/download/{id}")
    public ResponseEntity<byte[]> downloadResume(@PathVariable Long id) {
        try {
            byte[] resumeData = resumeService.getResumeFile(id);
            Optional<Resume> resumeOpt = resumeService.getCurrentUserResume();
            
            if (resumeOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            
            Resume resume = resumeOpt.get();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(resume.getContentType()));
            headers.setContentDispositionFormData("attachment", resume.getFileName());
            headers.setContentLength(resumeData.length);
            
            return new ResponseEntity<>(resumeData, headers, HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid resume download request: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error downloading resume: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * API endpoint to delete a resume
     */
    @DeleteMapping("/api/resume/{id}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteResume(@PathVariable Long id) {
        boolean deleted = resumeService.deleteResume(id);
        
        Map<String, Object> response = new HashMap<>();
        if (deleted) {
            response.put("success", true);
            response.put("message", "Resume deleted successfully");
            return ResponseEntity.ok(response);
        } else {
            response.put("success", false);
            response.put("message", "Resume not found or could not be deleted");
            return ResponseEntity.badRequest().body(response);
        }
    }
}