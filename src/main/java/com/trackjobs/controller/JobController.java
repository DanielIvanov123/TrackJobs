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

import java.util.List;
import java.util.Map;

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
            // Extract parameters from request
            String keywords = (String) request.getOrDefault("keywords", "");
            String location = (String) request.getOrDefault("location", "");
            int pagesToScrape = Integer.parseInt(request.getOrDefault("pagesToScrape", "1").toString());
            
            // Additional parameters (optional)
            String experienceLevel = (String) request.getOrDefault("experienceLevel", "");
            String jobType = (String) request.getOrDefault("jobType", "");
            boolean remoteOnly = Boolean.parseBoolean(request.getOrDefault("remoteOnly", "false").toString());
            int daysOld = Integer.parseInt(request.getOrDefault("daysOld", "7").toString());
            
            if (keywords.isEmpty() || location.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Keywords and location are required"
                ));
            }
            
            // Create scraping configuration
            ScrapingConfig config = ScrapingConfig.builder()
                .keywords(keywords)
                .location(location)
                .pagesToScrape(pagesToScrape)
                .experienceLevel(experienceLevel)
                .jobType(jobType)
                .remoteOnly(remoteOnly)
                .daysOld(daysOld)
                .build();
            
            log.info("Starting job scrape with keywords: {}, location: {}", keywords, location);
            
            // Run the scrape
            List<Job> scrapedJobs = jobService.scrapeLinkedInJobs(config);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "jobsFound", scrapedJobs.size(),
                "jobs", scrapedJobs
            ));
        } catch (Exception e) {
            log.error("Error during job scrape: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "Error scraping jobs: " + e.getMessage()
            ));
        }
    }
}