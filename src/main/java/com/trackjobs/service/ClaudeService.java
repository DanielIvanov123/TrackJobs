package com.trackjobs.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.context.annotation.Bean;
import com.trackjobs.model.Job;
import com.trackjobs.model.Resume;
import com.trackjobs.model.User;
import com.trackjobs.repository.JobRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

// Document processing imports
import org.apache.tika.Tika;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.Parser;
import org.apache.tika.sax.BodyContentHandler;
import org.xml.sax.ContentHandler;

/**
 * Service for Claude API integration
 * Handles resume tailoring and cover letter generation
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ClaudeService {

    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String CLAUDE_MODEL = "claude-3-opus-20240229";
    
    private final ApiKeyService apiKeyService;
    private final ResumeService resumeService;
    private final JobRepository jobRepository;
    private final UserService userService;
    @Qualifier("apiRestTemplate")
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    
    /**
     * Extract text content from various file formats (PDF, DOCX, etc.)
     * 
     * @param fileBytes The binary file content
     * @param contentType The MIME type of the file
     * @return Extracted text content
     */
    private String extractTextContent(byte[] fileBytes, String contentType) {
        try {
            log.info("Extracting text from file of type: {}", contentType);
            
            // For plain text files, just return the content
            if (contentType.equals("text/plain")) {
                return new String(fileBytes, StandardCharsets.UTF_8);
            }
            
            // For other formats, use Apache Tika to extract text
            ContentHandler handler = new BodyContentHandler(-1); // -1 means no limit
            Metadata metadata = new Metadata();
            Parser parser = new AutoDetectParser();
            ParseContext context = new ParseContext();
            
            try (ByteArrayInputStream stream = new ByteArrayInputStream(fileBytes)) {
                parser.parse(stream, handler, metadata, context);
                String extractedText = handler.toString().trim();
                
                // Log a sample of the extracted content
                String previewText = extractedText.length() > 200 ? 
                        extractedText.substring(0, 200) + "..." : extractedText;
                log.info("Extracted text sample (first 200 chars): {}", previewText);
                
                // If no text was extracted, try with Tika's facade for simple extraction
                if (extractedText.isEmpty()) {
                    log.info("No text extracted with parser, trying with Tika facade");
                    Tika tika = new Tika();
                    extractedText = tika.parseToString(new ByteArrayInputStream(fileBytes));
                }
                
                return extractedText;
            }
        } catch (Exception e) {
            log.error("Error extracting text from file: {}", e.getMessage(), e);
            // Return a message about the error that will be visible in the Claude request
            return "[Error extracting resume text. Please check the file format.]";
        }
    }
    
    /**
     * Generate a tailored resume for a specific job
     * 
     * @param jobId ID of the job
     * @return Generated resume content as a string
     * @throws Exception If an error occurs during generation
     */
    public String generateTailoredResume(Long jobId) throws Exception {
        log.info("Starting tailored resume generation for job ID: {}", jobId);
        // Get current user
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            log.error("No authenticated user found");
            throw new IllegalStateException("You must be logged in to use this feature");
        }
        
        // Get Claude API key
        String apiKey = apiKeyService.getClaudeApiKey()
                .orElseThrow(() -> {
                    log.error("Claude API key not found for user: {}", currentUser.getUsername());
                    return new IllegalStateException("Claude API key not found. Please add your key in the settings.");
                });
        
        log.info("Found Claude API key for user: {}", currentUser.getUsername());
        
        // Get current user's resume
        Optional<Resume> resumeOpt = resumeService.getCurrentUserResume();
        if (resumeOpt.isEmpty()) {
            log.error("No resume found for user: {}", currentUser.getUsername());
            throw new IllegalStateException("You must upload a resume first");
        }
        
        Resume resume = resumeOpt.get();
        log.info("Found resume for user: {}, file type: {}", currentUser.getUsername(), resume.getContentType());
        
        // Get resume content
        byte[] resumeBytes = resumeService.getResumeFile(resume.getId());
        if (resumeBytes == null || resumeBytes.length == 0) {
            log.error("Resume file is empty for user: {}", currentUser.getUsername());
            throw new IllegalStateException("Your resume file appears to be empty. Please upload a valid resume.");
        }
        
        log.info("Resume file loaded, size: {} bytes", resumeBytes.length);
        
        // Extract text content from the resume file based on its type
        String resumeContent = extractTextContent(resumeBytes, resume.getContentType());
        
        if (resumeContent.isEmpty()) {
            log.error("Could not extract text from resume file for user: {}", currentUser.getUsername());
            throw new IllegalStateException("Could not extract text from your resume file. Please make sure it contains text content.");
        }
        
        log.info("Resume text extracted, content length: {} characters", resumeContent.length());
        
        // Get job details
        Optional<Job> jobOpt = jobRepository.findByIdAndUser(jobId, currentUser);
        if (jobOpt.isEmpty()) {
            log.error("Job not found: {} for user: {}", jobId, currentUser.getUsername());
            throw new IllegalArgumentException("Job not found or you don't have permission to access it");
        }
        
        Job job = jobOpt.get();
        log.info("Found job: {} - {} at {}", job.getId(), job.getTitle(), job.getCompany());
        
        // Create request to Claude API
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("anthropic-version", "2023-06-01");
        headers.set("x-api-key", apiKey);
        
        // Create request body
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("model", CLAUDE_MODEL);
        requestBody.put("max_tokens", 4000);
        
        // Set system prompt as a top-level parameter
        requestBody.put("system", "You are a professional resume writer. Your task is to tailor a resume for a specific job posting.");
        
        // Create messages array
        ArrayNode messages = objectMapper.createArrayNode();
        ObjectNode userMessage = objectMapper.createObjectNode();
        userMessage.put("role", "user");
        
        // Format prompt with resume and job details
        String prompt = String.format(
                "Here is my current resume:\n\n%s\n\nHere is the job I'm applying for:\n\nTitle: %s\nCompany: %s\nLocation: %s\nDescription: %s\n\nPlease tailor my resume specifically for this job position, highlighting relevant skills and experiences. Format it professionally. Format it in a similar way to the provided resume.",
                resumeContent,
                job.getTitle(),
                job.getCompany(),
                job.getLocation(),
                job.getDescription()
        );
        
        userMessage.put("content", prompt);
        messages.add(userMessage);
        requestBody.set("messages", messages);
        
        // Convert to JSON and log for debugging
        String requestJson = objectMapper.writeValueAsString(requestBody);
        log.info("Prepared Claude API request (length: {} chars)", requestJson.length());
        
        // Make request to Claude API
        HttpEntity<String> request = new HttpEntity<>(requestJson, headers);
        
        try {
            log.info("Sending request to Claude API...");
            String response = restTemplate.postForObject(CLAUDE_API_URL, request, String.class);
            log.info("Received response from Claude API (length: {} chars)", response != null ? response.length() : 0);
            
            // Parse response
            JsonNode responseNode = objectMapper.readTree(response);
            
            // Debug log to see full structure
            log.debug("Claude API response structure: {}", responseNode.toString());
            
            // Check if content array exists
            if (!responseNode.has("content") || !responseNode.path("content").isArray() || responseNode.path("content").size() == 0) {
                log.error("Unexpected response format, missing content array: {}", responseNode);
                throw new Exception("Invalid response format from Claude API");
            }
            
            String content = responseNode.path("content").path(0).path("text").asText();
            
            if (content == null || content.isEmpty()) {
                log.error("Empty content returned from Claude API: {}", responseNode);
                throw new Exception("Empty response from Claude API");
            }
            
            log.info("Successfully generated tailored resume (length: {} chars)", content.length());
            return content;
        } catch (Exception e) {
            log.error("Error calling Claude API: {}", e.getMessage(), e);
            // Include more details in the exception message
            String errorDetails = (e instanceof org.springframework.web.client.HttpStatusCodeException) 
                ? ((org.springframework.web.client.HttpStatusCodeException) e).getResponseBodyAsString()
                : e.getMessage();
            throw new Exception("Error generating tailored resume: " + errorDetails);
        }
    }
    
    /**
     * Generate a cover letter for a specific job
     * 
     * @param jobId ID of the job
     * @return Generated cover letter content as a string
     * @throws Exception If an error occurs during generation
     */
    public String generateCoverLetter(Long jobId) throws Exception {
        // Get current user
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("You must be logged in to use this feature");
        }
        
        // Get Claude API key
        String apiKey = apiKeyService.getClaudeApiKey()
                .orElseThrow(() -> new IllegalStateException("Claude API key not found. Please add your key in the settings."));
        
        // Get current user's resume
        Optional<Resume> resumeOpt = resumeService.getCurrentUserResume();
        if (resumeOpt.isEmpty()) {
            throw new IllegalStateException("You must upload a resume first");
        }
        
        Resume resume = resumeOpt.get();
        log.info("Found resume for cover letter generation, file type: {}", resume.getContentType());
        
        // Get resume content
        byte[] resumeBytes = resumeService.getResumeFile(resume.getId());
        if (resumeBytes == null || resumeBytes.length == 0) {
            throw new IllegalStateException("Your resume file appears to be empty. Please upload a valid resume.");
        }
        
        // Extract text content from the resume file based on its type
        String resumeContent = extractTextContent(resumeBytes, resume.getContentType());
        
        if (resumeContent.isEmpty()) {
            throw new IllegalStateException("Could not extract text from your resume file. Please make sure it contains text content.");
        }
        
        log.info("Resume text extracted for cover letter, content length: {} characters", resumeContent.length());
        
        // Get job details
        Optional<Job> jobOpt = jobRepository.findByIdAndUser(jobId, currentUser);
        if (jobOpt.isEmpty()) {
            throw new IllegalArgumentException("Job not found or you don't have permission to access it");
        }
        
        Job job = jobOpt.get();
        
        // Create request to Claude API
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("anthropic-version", "2023-06-01");
        headers.set("x-api-key", apiKey);
        
        // Create request body
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("model", CLAUDE_MODEL);
        requestBody.put("max_tokens", 4000);
        
        // Set system prompt
        requestBody.put("system", "You are a professional cover letter writer. Your task is to create a compelling cover letter for a specific job posting.");
        
        // Create messages array
        ArrayNode messages = objectMapper.createArrayNode();
        ObjectNode userMessage = objectMapper.createObjectNode();
        userMessage.put("role", "user");
        
        // Format prompt with resume and job details
        String prompt = String.format(
                "Here is my resume for reference:\n\n%s\n\nHere is the job I'm applying for:\n\nTitle: %s\nCompany: %s\nLocation: %s\nDescription: %s\n\nPlease create a compelling cover letter for this position, highlighting how my skills and experiences make me a great fit.",
                resumeContent,
                job.getTitle(),
                job.getCompany(),
                job.getLocation(),
                job.getDescription()
        );
        
        userMessage.put("content", prompt);
        messages.add(userMessage);
        requestBody.set("messages", messages);
        
        // Convert to JSON
        String requestJson = objectMapper.writeValueAsString(requestBody);
        log.info("Prepared Claude API request for cover letter (length: {} chars)", requestJson.length());
        
        // Make request to Claude API
        HttpEntity<String> request = new HttpEntity<>(requestJson, headers);
        
        try {
            log.info("Sending cover letter request to Claude API...");
            String response = restTemplate.postForObject(CLAUDE_API_URL, request, String.class);
            log.info("Received response from Claude API (length: {} chars)", response != null ? response.length() : 0);
            
            // Parse response
            JsonNode responseNode = objectMapper.readTree(response);
            
            // Check if content array exists
            if (!responseNode.has("content") || !responseNode.path("content").isArray() || responseNode.path("content").size() == 0) {
                log.error("Unexpected response format for cover letter, missing content array: {}", responseNode);
                throw new Exception("Invalid response format from Claude API");
            }
            
            String content = responseNode.path("content").path(0).path("text").asText();
            
            if (content == null || content.isEmpty()) {
                log.error("Empty content returned from Claude API for cover letter: {}", responseNode);
                throw new Exception("Empty response from Claude API");
            }
            
            log.info("Successfully generated cover letter (length: {} chars)", content.length());
            return content;
        } catch (Exception e) {
            log.error("Error calling Claude API for cover letter: {}", e.getMessage(), e);
            // Include more details in the exception message
            String errorDetails = (e instanceof org.springframework.web.client.HttpStatusCodeException) 
                ? ((org.springframework.web.client.HttpStatusCodeException) e).getResponseBodyAsString()
                : e.getMessage();
            throw new Exception("Error generating cover letter: " + errorDetails);
        }
    }
}