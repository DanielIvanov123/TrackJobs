package com.trackjobs.controller;

import com.trackjobs.model.Job;
import com.trackjobs.service.UserService;
import com.trackjobs.model.ScrapingConfig;
import com.trackjobs.service.JobService;
import com.trackjobs.model.SavedScraperConfig;
import com.trackjobs.service.ScraperConfigService;
import com.trackjobs.service.LinkedInScraperService;
import lombok.extern.slf4j.Slf4j;
import com.trackjobs.model.ScrapingProgress;
import com.trackjobs.model.User;
import com.trackjobs.repository.JobRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.HashMap;

@Controller
@Slf4j
public class JobController {

    @Autowired
    private JobService jobService;

    @Autowired
    private ScraperConfigService scraperConfigService;
    
    @Autowired
    private LinkedInScraperService linkedInScraperService;

    @Autowired
    private UserService userService;

    @Autowired
    private JobRepository jobRepository;
    
    /**
     * Main page - display job listings
     */
    @GetMapping("/")
    public String index(Model model) {
        // Get the most recently scraped jobs
        List<Job> recentJobs = jobService.getRecentJobs();
        model.addAttribute("jobs", recentJobs);
        return "index";
    }
    
    /**
     * API endpoint to get all jobs
     */
    @GetMapping("/api/jobs")
    @ResponseBody
    public List<Job> getAllJobs() {
        return jobService.getAllJobs();
    }
    
    /**
     * API endpoint to search for jobs with enhanced filtering
     */
    @GetMapping("/api/jobs/search")
    @ResponseBody
    public List<Job> searchJobs(
            @RequestParam(required = false) String keywords,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String experienceLevel,
            @RequestParam(required = false) String jobType,
            @RequestParam(required = false, defaultValue = "0") Integer daysOld,
            @RequestParam(required = false, defaultValue = "false") Boolean remoteOnly) {
        
        log.info("Search request - Keywords: '{}', Location: '{}', Experience Level: '{}', Job Type: '{}', Days Old: {}, Remote Only: {}", 
                keywords, location, experienceLevel, jobType, daysOld, remoteOnly);
        
        // Create search parameters map
        Map<String, Object> searchParams = new HashMap<>();
        searchParams.put("keywords", keywords);
        searchParams.put("location", location);
        searchParams.put("experienceLevel", experienceLevel);
        searchParams.put("jobType", jobType);
        searchParams.put("daysOld", daysOld);
        searchParams.put("remoteOnly", remoteOnly);
        
        return jobService.searchJobsAdvanced(searchParams);
    }
    
    /**
     * API endpoint to run a LinkedIn scrape
     */
    @PostMapping("/api/jobs/scrape")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> scrapeJobs(@RequestBody Map<String, Object> request) {
        try {
            // Record start time
            LocalDateTime startTime = LocalDateTime.now();
            
            // Extract basic parameters from request
            String keywords = (String) request.getOrDefault("keywords", "");
            String location = (String) request.getOrDefault("location", "");
            int pagesToScrape = Integer.parseInt(request.getOrDefault("pagesToScrape", "1").toString());
            
            // Additional parameters (optional)
            String experienceLevel = (String) request.getOrDefault("experienceLevel", "");
            String jobType = (String) request.getOrDefault("jobType", "");
            boolean remoteOnly = Boolean.parseBoolean(request.getOrDefault("remoteOnly", "false").toString());
            int daysOld = Integer.parseInt(request.getOrDefault("daysOld", "7").toString());
            
            // Advanced filters
            List<String> titleIncludeWords = parseStringList(request.get("titleIncludeWords"));
            List<String> titleExcludeWords = parseStringList(request.get("titleExcludeWords"));
            List<String> companyExcludeWords = parseStringList(request.get("companyExcludeWords"));
            List<String> descriptionExcludeWords = parseStringList(request.get("descriptionExcludeWords"));
            List<String> experienceLevelInclude = parseStringList(request.get("experienceLevelInclude"));
            
            if (keywords.isEmpty() || location.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Keywords and location are required"
                ));
            }
            
            // Log scraping request
            log.info("New scraping request - Keywords: '{}', Location: '{}', Pages: {}", 
                    keywords, location, pagesToScrape);
            log.info("Advanced filters - Title include: {}, Title exclude: {}, Company exclude: {}, Description exclude: {}", 
                    titleIncludeWords, titleExcludeWords, companyExcludeWords, descriptionExcludeWords);
            
            // Generate a unique scrape ID for tracking progress
            String scrapeId = UUID.randomUUID().toString();
            log.info("Generated scrape ID for progress tracking: {}", scrapeId);
            
            // Create scraping configuration
            ScrapingConfig config = ScrapingConfig.builder()
                .keywords(keywords)
                .location(location)
                .pagesToScrape(pagesToScrape)
                .experienceLevel(experienceLevel)
                .jobType(jobType)
                .remoteOnly(remoteOnly)
                .daysOld(daysOld)
                .titleIncludeWords(titleIncludeWords)
                .titleExcludeWords(titleExcludeWords)
                .companyExcludeWords(companyExcludeWords)
                .descriptionExcludeWords(descriptionExcludeWords)
                .experienceLevelInclude(experienceLevelInclude)
                .build();
            
            // Get the current user before launching the async thread
            User currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "You must be logged in to scrape jobs"
                ));
            }
            
            // Set the user in the config
            config.setUser(currentUser);
            
            // Start the scrape in a separate thread to avoid blocking the response
            CompletableFuture.runAsync(() -> {
                try {
                    // Pass the scrapeId to be used for progress tracking
                    linkedInScraperService.scrapeJobs(config, scrapeId);
                } catch (Exception e) {
                    log.error("Async scraping error: ", e);
                }
            });
            
            // Return immediately with the scrape ID for progress tracking
            return ResponseEntity.ok(Map.of(
                "success", true,
                "scrapeId", scrapeId,
                "message", "Scraping started. Use the scrapeId to track progress."
            ));
        } catch (Exception e) {
            log.error("Error during job scrape: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "Error scraping jobs: " + e.getMessage(),
                "stackTrace", Arrays.stream(e.getStackTrace())
                    .limit(5)
                    .map(StackTraceElement::toString)
                    .collect(Collectors.toList())
            ));
        }
    }
    
    /**
     * Helper method to parse string list from request
     */
    @SuppressWarnings("unchecked")
    private List<String> parseStringList(Object value) {
        if (value == null) {
            return List.of();
        }
        
        if (value instanceof List) {
            return (List<String>) value;
        } else if (value instanceof String) {
            String strValue = (String) value;
            if (strValue.trim().isEmpty()) {
                return List.of();
            }
            return Arrays.asList(strValue.split(","));
        }
        
        return List.of();
    }
    
    /**
     * API endpoint to get scraping stats
     */
    @GetMapping("/api/jobs/stats")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getJobStats() {
        long totalJobs = jobService.countAllJobs();
        long recentJobs = jobService.countRecentJobs(7); // Last 7 days
        LocalDate lastScrapeDate = jobService.getLastScrapeDate();
        
        return ResponseEntity.ok(Map.of(
            "totalJobs", totalJobs,
            "recentJobs", recentJobs,
            "lastScrapeDate", lastScrapeDate != null ? 
                lastScrapeDate.format(DateTimeFormatter.ISO_LOCAL_DATE) : "Never"
        ));
    }

    /**
     * API endpoint to save a scraper configuration
     */
    @PostMapping("/api/configs/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveScraperConfig(@RequestBody Map<String, Object> request) {
        try {
            String configName = (String) request.getOrDefault("configName", "");
            if (configName.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Configuration name is required"
                ));
            }
            
            // Extract parameters from request (same as in scrapeJobs)
            String keywords = (String) request.getOrDefault("keywords", "");
            String location = (String) request.getOrDefault("location", "");
            int pagesToScrape = Integer.parseInt(request.getOrDefault("pagesToScrape", "1").toString());
            String experienceLevel = (String) request.getOrDefault("experienceLevel", "");
            String jobType = (String) request.getOrDefault("jobType", "");
            boolean remoteOnly = Boolean.parseBoolean(request.getOrDefault("remoteOnly", "false").toString());
            int daysOld = Integer.parseInt(request.getOrDefault("daysOld", "7").toString());
            
            // Advanced filters
            List<String> titleIncludeWords = parseStringList(request.get("titleIncludeWords"));
            List<String> titleExcludeWords = parseStringList(request.get("titleExcludeWords"));
            List<String> companyExcludeWords = parseStringList(request.get("companyExcludeWords"));
            List<String> descriptionExcludeWords = parseStringList(request.get("descriptionExcludeWords"));
            List<String> experienceLevelInclude = parseStringList(request.get("experienceLevelInclude"));
            
            // Create config object
            ScrapingConfig config = ScrapingConfig.builder()
                .keywords(keywords)
                .location(location)
                .pagesToScrape(pagesToScrape)
                .experienceLevel(experienceLevel)
                .jobType(jobType)
                .remoteOnly(remoteOnly)
                .daysOld(daysOld)
                .titleIncludeWords(titleIncludeWords)
                .titleExcludeWords(titleExcludeWords)
                .companyExcludeWords(companyExcludeWords)
                .descriptionExcludeWords(descriptionExcludeWords)
                .experienceLevelInclude(experienceLevelInclude)
                .build();
            
            // Save the configuration
            SavedScraperConfig savedConfig = scraperConfigService.saveConfig(configName, config);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "configId", savedConfig.getId(),
                "configName", savedConfig.getName(),
                "message", "Configuration saved successfully"
            ));
            
        } catch (Exception e) {
            log.error("Error saving scraper config: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "Error saving configuration: " + e.getMessage()
            ));
        }
    }
    
    /**
     * API endpoint to get all user configurations
     */
    @GetMapping("/api/configs")
    @ResponseBody
    public List<Map<String, Object>> getUserConfigs() {
        List<SavedScraperConfig> configs = scraperConfigService.getUserConfigs();
        
        return configs.stream().map(config -> {
            Map<String, Object> configMap = new HashMap<>();
            configMap.put("id", config.getId());
            configMap.put("name", config.getName());
            configMap.put("keywords", config.getKeywords());
            configMap.put("location", config.getLocation());
            configMap.put("createdAt", config.getCreatedAt());
            configMap.put("lastUsed", config.getLastUsed());
            return configMap;
        }).collect(Collectors.toList());
    }
    
    /**
     * API endpoint to load a specific configuration
     */
    @GetMapping("/api/configs/{id}")
    @ResponseBody
    public ResponseEntity<Object> getConfig(@PathVariable Long id) {
        try {
            ScrapingConfig config = scraperConfigService.loadConfig(id);
            return ResponseEntity.ok(config);
        } catch (Exception e) {
            log.error("Error loading config: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "Error loading configuration: " + e.getMessage()
            ));
        }
    }
    
    /**
     * API endpoint to delete a configuration
     */
    @DeleteMapping("/api/configs/{id}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteConfig(@PathVariable Long id) {
        try {
            scraperConfigService.deleteConfig(id);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Configuration deleted successfully"
            ));
        } catch (Exception e) {
            log.error("Error deleting config: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "Error deleting configuration: " + e.getMessage()
            ));
        }
    }

    /**
     * API endpoint to get scraping progress
     */
    @GetMapping("/api/jobs/scrape/progress")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScrapingProgress(
            @RequestParam(required = true) String scrapeId) {
        
        // Get progress information from the service
        ScrapingProgress progress = linkedInScraperService.getProgress(scrapeId);
        
        // Convert to response map
        Map<String, Object> response = new HashMap<>();
        response.put("percentComplete", progress.getPercentComplete());
        response.put("currentPage", progress.getCurrentPage());
        response.put("totalPages", progress.getTotalPages());
        response.put("status", progress.getStatus());
        response.put("experienceLevelIndex", progress.getExperienceLevelIndex());
        response.put("totalExperienceLevels", progress.getTotalExperienceLevels());
        response.put("currentExperienceLevel", progress.getCurrentExperienceLevel());
        
        return ResponseEntity.ok(response);
    }

    /**
     * API endpoint to get a single job by ID
     */
    @GetMapping("/api/jobs/{id}")
    @ResponseBody
    public ResponseEntity<Object> getJobById(@PathVariable Long id) {
        try {
            // Get current user
            User currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "success", false,
                    "message", "You must be logged in to view job details"
                ));
            }
            
            // Fetch the job
            Optional<Job> jobOpt = jobRepository.findByIdAndUser(id, currentUser);
            
            if (jobOpt.isPresent()) {
                return ResponseEntity.ok(jobOpt.get());
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "success", false,
                    "message", "Job not found"
                ));
            }
        } catch (Exception e) {
            log.error("Error getting job details: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "Error retrieving job details: " + e.getMessage()
            ));
        }
    }

    /**
     * API endpoint to update job application status
     */
    @PostMapping("/api/jobs/{id}/status")
    @ResponseBody
    public ResponseEntity<Object> updateJobStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        try {
            // Get the current user
            User currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "success", false,
                    "message", "You must be logged in to update job status"
                ));
            }
            
            // Validate input
            String statusStr = request.get("status");
            if (statusStr == null || statusStr.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Status is required"
                ));
            }
            
            // Find the job
            Optional<Job> jobOpt = jobRepository.findByIdAndUser(id, currentUser);
            if (jobOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "success", false,
                    "message", "Job not found"
                ));
            }
            
            // Update the status
            Job job = jobOpt.get();
            try {
                Job.ApplicationStatus newStatus = Job.ApplicationStatus.valueOf(statusStr);
                job.setApplicationStatus(newStatus);
                jobRepository.save(job);
                
                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Job status updated successfully",
                    "job", job
                ));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Invalid status value: " + statusStr
                ));
            }
        } catch (Exception e) {
            log.error("Error updating job status: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "Error updating job status: " + e.getMessage()
            ));
        }
    }

    /**
     * API endpoint to get jobs filtered by status
     */
    @GetMapping("/api/jobs/status/{status}")
    @ResponseBody
    public List<Job> getJobsByStatus(@PathVariable String status) {
        // Get current user
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return Collections.emptyList();
        }
        
        try {
            Job.ApplicationStatus applicationStatus = Job.ApplicationStatus.valueOf(status);
            return jobRepository.findByUserAndApplicationStatus(currentUser, applicationStatus);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid status: {}", status);
            return Collections.emptyList();
        }
    }
}