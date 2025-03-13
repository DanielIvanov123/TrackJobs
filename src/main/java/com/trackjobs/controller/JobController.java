package com.trackjobs.controller;

import com.trackjobs.model.Job;
import com.trackjobs.model.ScrapingConfig;
import com.trackjobs.service.JobService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Controller
@Slf4j
public class JobController {

    @Autowired
    private JobService jobService;
    
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
     * API endpoint to search for jobs
     */
    @GetMapping("/api/jobs/search")
    @ResponseBody
    public List<Job> searchJobs(
            @RequestParam(required = false) String keywords,
            @RequestParam(required = false) String location) {
        return jobService.searchJobs(keywords, location);
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
            List<String> experienceLevelExclude = parseStringList(request.get("experienceLevelExclude"));
            
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
                .experienceLevelExclude(experienceLevelExclude)
                .build();
            
            // Run the scrape
            List<Job> scrapedJobs = jobService.scrapeLinkedInJobs(config);
            
            // Calculate runtime
            LocalDateTime endTime = LocalDateTime.now();
            Duration duration = Duration.between(startTime, endTime);
            String formattedDuration = String.format("%02d:%02d:%02d", 
                    duration.toHours(), 
                    duration.toMinutesPart(), 
                    duration.toSecondsPart());
            
            // Format the current date and time
            String timestamp = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").format(endTime);
            
            // Prepare the response with detailed statistics
            return ResponseEntity.ok(Map.of(
                "success", true,
                "timestamp", timestamp,
                "keywords", keywords,
                "location", location,
                "jobsFound", scrapedJobs.size(),
                "totalJobsScraped", config.getTotalJobsFound(),
                "pagesScraped", config.getPagesScraped(),
                "duplicatesSkipped", config.getDuplicatesSkipped(),
                "scrapingTimeMs", config.getScrapingTimeMs(),
                "formattedDuration", formattedDuration,
                "jobs", scrapedJobs,
                "message", String.format("Scraping completed in %s. Found %d jobs after filtering from %d total jobs scraped.",
                        formattedDuration, scrapedJobs.size(), config.getTotalJobsFound())
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
}