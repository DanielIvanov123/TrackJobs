package com.trackjobs.service;

import com.trackjobs.model.Job;
import com.trackjobs.model.ScrapingConfig;
import com.trackjobs.model.User;
import com.trackjobs.repository.JobRepository;
import lombok.extern.slf4j.Slf4j;
import com.trackjobs.service.UserService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
public class JobService {

    @Autowired
    private JobRepository jobRepository;
    
    @Autowired
    private LinkedInScraperService linkedInScraperService;
    
    @Autowired
    private UserService userService;
    
    /**
     * Get all jobs from the database for the current user
     */
    public List<Job> getAllJobs() {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return Collections.emptyList();
        }
        return jobRepository.findByUser(currentUser);
    }
    
    /**
     * Get jobs scraped on the most recent scrape date for the current user
     */
    public List<Job> getRecentJobs() {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return Collections.emptyList();
        }
        return jobRepository.findMostRecentlyScrapedByUser(currentUser);
    }
    
    /**
     * Basic search for jobs by keyword and location for the current user
     */
    public List<Job> searchJobs(String keyword, String location) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return Collections.emptyList();
        }
        
        if (keyword != null && !keyword.isEmpty() && 
            location != null && !location.isEmpty()) {
            return jobRepository.findByUserAndKeywordAndLocation(currentUser, keyword, location);
        } else if (keyword != null && !keyword.isEmpty()) {
            return jobRepository.findByUserAndTitleContainingIgnoreCaseOrCompanyContainingIgnoreCase(
                currentUser, keyword, keyword);
        } else if (location != null && !location.isEmpty()) {
            return jobRepository.findByUserAndLocationContainingIgnoreCase(currentUser, location);
        } else {
            return jobRepository.findByUser(currentUser);
        }
    }
    
    /**
     * Advanced search for jobs with multiple filter criteria
     */
    @Transactional(readOnly = true)
    public List<Job> searchJobsAdvanced(Map<String, Object> searchParams) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return Collections.emptyList();
        }
        
        String keywords = (String) searchParams.get("keywords");
        String location = (String) searchParams.get("location");
        String experienceLevel = (String) searchParams.get("experienceLevel");
        String jobType = (String) searchParams.get("jobType");
        Integer daysOld = (Integer) searchParams.get("daysOld");
        Boolean remoteOnly = (Boolean) searchParams.get("remoteOnly");
        
        // Start with getting jobs either filtered by keyword and location, or all jobs
        List<Job> filteredJobs;
        if (keywords != null && !keywords.isEmpty() && 
            location != null && !location.isEmpty()) {
            filteredJobs = jobRepository.findByUserAndKeywordAndLocation(currentUser, keywords, location);
        } else if (keywords != null && !keywords.isEmpty()) {
            filteredJobs = jobRepository.findByUserAndTitleContainingIgnoreCaseOrCompanyContainingIgnoreCase(
                currentUser, keywords, keywords);
        } else if (location != null && !location.isEmpty()) {
            filteredJobs = jobRepository.findByUserAndLocationContainingIgnoreCase(currentUser, location);
        } else {
            filteredJobs = jobRepository.findByUser(currentUser);
        }
        
        log.info("Initial search found {} jobs", filteredJobs.size());
        
        // Apply additional filters using stream operations
        // Filter by experience level if specified
        if (experienceLevel != null && !experienceLevel.isEmpty()) {
            filteredJobs = filteredJobs.stream()
                .filter(job -> job.getExperienceLevel() != null && 
                               job.getExperienceLevel().equalsIgnoreCase(experienceLevel))
                .collect(Collectors.toList());
            log.info("After experience level filter: {} jobs", filteredJobs.size());
        }
        
        // Filter by job type if specified
        if (jobType != null && !jobType.isEmpty()) {
            filteredJobs = filteredJobs.stream()
                .filter(job -> job.getJobType() != null && 
                               job.getJobType().equalsIgnoreCase(jobType))
                .collect(Collectors.toList());
            log.info("After job type filter: {} jobs", filteredJobs.size());
        }
        
        // Filter by date posted if specified
        if (daysOld != null && daysOld > 0) {
            LocalDate cutoffDate = LocalDate.now().minusDays(daysOld);
            filteredJobs = filteredJobs.stream()
                .filter(job -> job.getDatePosted() != null && 
                               !job.getDatePosted().isBefore(cutoffDate))
                .collect(Collectors.toList());
            log.info("After date filter (last {} days): {} jobs", daysOld, filteredJobs.size());
        }
        
        // Filter for remote jobs if specified
        if (remoteOnly != null && remoteOnly) {
            filteredJobs = filteredJobs.stream()
                .filter(job -> job.getLocation() != null && 
                               (job.getLocation().toLowerCase().contains("remote") || 
                                job.getLocation().toLowerCase().contains("anywhere")))
                .collect(Collectors.toList());
            log.info("After remote filter: {} jobs", filteredJobs.size());
        }
        
        log.info("Final filtered results: {} jobs", filteredJobs.size());
        return filteredJobs;
    }
    
    /**
     * Find jobs posted in the last X days for the current user
     */
    public List<Job> getRecentlyPostedJobs(int days) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return Collections.emptyList();
        }
        
        LocalDate cutoffDate = LocalDate.now().minusDays(days);
        return jobRepository.findByUserAndDatePostedGreaterThanEqual(currentUser, cutoffDate);
    }
    
    /**
     * Run a LinkedIn scrape with the given configuration for the current user
     */
    @Transactional
    public List<Job> scrapeLinkedInJobs(ScrapingConfig config) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("You must be logged in to scrape jobs");
        }
        
        // Log for debugging
        log.info("Scraping jobs for user: {} (ID: {})", currentUser.getUsername(), currentUser.getId());
        
        // Set the current user in the config
        config.setUser(currentUser);
        
        return linkedInScraperService.scrapeJobs(config);
    }
    
    /**
     * Count all jobs in the database for the current user
     */
    public long countAllJobs() {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return 0;
        }
        return jobRepository.countByUser(currentUser);
    }
    
    /**
     * Count jobs posted in the last X days for the current user
     */
    public long countRecentJobs(int days) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return 0;
        }
        
        LocalDate cutoffDate = LocalDate.now().minusDays(days);
        return jobRepository.countByUserAndDatePostedGreaterThanEqual(currentUser, cutoffDate);
    }
    
    /**
     * Get the date of the most recent scrape for the current user
     */
    public LocalDate getLastScrapeDate() {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return null;
        }
        
        Optional<LocalDate> lastDate = jobRepository.findMostRecentScrapeDateByUser(currentUser);
        return lastDate.orElse(null);
    }
}