package com.trackjobs.controller;

import com.trackjobs.service.ClaudeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Controller for Claude API integration endpoints
 * Handles resume tailoring and cover letter generation
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ClaudeController {

    private final ClaudeService claudeService;
    
    /**
     * API endpoint to generate a tailored resume
     */
    @PostMapping("/api/claude/tailor-resume")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> tailorResume(@RequestBody Map<String, Object> request) {
        try {
            // Get job ID
            Long jobId = Long.parseLong(request.get("jobId").toString());
            
            // Generate tailored resume
            String tailoredResume = claudeService.generateTailoredResume(jobId);
            
            // Return response
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("content", tailoredResume);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error generating tailored resume: {}", e.getMessage(), e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Error generating tailored resume: " + e.getMessage());
            
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    /**
     * API endpoint to generate a cover letter
     */
    @PostMapping("/api/claude/cover-letter")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> generateCoverLetter(@RequestBody Map<String, Object> request) {
        try {
            // Get job ID
            Long jobId = Long.parseLong(request.get("jobId").toString());
            
            // Generate cover letter
            String coverLetter = claudeService.generateCoverLetter(jobId);
            
            // Return response
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("content", coverLetter);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error generating cover letter: {}", e.getMessage(), e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Error generating cover letter: " + e.getMessage());
            
            return ResponseEntity.badRequest().body(response);
        }
    }
}