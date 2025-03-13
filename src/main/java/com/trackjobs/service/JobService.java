package com.trackjobs.service;

import com.trackjobs.model.Job;
import com.trackjobs.model.ScrapingConfig;
import com.trackjobs.model.User;
import com.trackjobs.repository.JobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

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
     * Search for jobs by keyword and location for the current user
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
    public List<Job> scrapeLinkedInJobs(ScrapingConfig config) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("You must be logged in to scrape jobs");
        }
        
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