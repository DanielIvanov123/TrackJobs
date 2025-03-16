package com.trackjobs.service;

import com.trackjobs.model.Job;
import com.trackjobs.model.ScrapingConfig;
import com.trackjobs.model.User;
import com.trackjobs.repository.JobRepository;
import lombok.extern.slf4j.Slf4j;
import com.trackjobs.model.ScrapingProgress;

import com.trackjobs.service.UserService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
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
        String applicationStatus = (String) searchParams.get("applicationStatus");
        
        log.info("Advanced search with params - Keywords: '{}', Location: '{}', Experience Level: '{}', " +
                "Job Type: '{}', Days Old: {}, Remote Only: {}, Application Status: '{}'", 
                keywords, location, experienceLevel, jobType, daysOld, remoteOnly, applicationStatus);
        
        // For ALL status (or null/empty status param), just get all jobs without status filtering 
        if (applicationStatus == null || applicationStatus.isEmpty() || "ALL".equals(applicationStatus)) {
            log.info("Getting all jobs without status filtering");
            
            // Start with getting jobs either filtered by keyword and location, or all jobs
            List<Job> allJobs;
            if (!isBlank(keywords) && !isBlank(location)) {
                allJobs = jobRepository.findByUserAndKeywordAndLocation(currentUser, keywords, location);
            } else if (!isBlank(keywords)) {
                allJobs = jobRepository.findByUserAndTitleContainingIgnoreCaseOrCompanyContainingIgnoreCase(
                    currentUser, keywords, keywords);
            } else if (!isBlank(location)) {
                allJobs = jobRepository.findByUserAndLocationContainingIgnoreCase(currentUser, location);
            } else {
                allJobs = jobRepository.findByUser(currentUser);
            }
            
            log.info("Initial search found {} jobs total (all statuses)", allJobs.size());
            
            // Only apply non-status filters
            return applyNonStatusFilters(allJobs, searchParams);
        }
        
        // If specific status filter is specified (not "ALL"), handle that case
        try {
            // Special case for SAVED status (include jobs with null status too)
            if ("SAVED".equals(applicationStatus)) {
                log.info("Filtering by SAVED status (including null status)");
                List<Job> savedJobs = jobRepository.findByUserAndSavedStatus(currentUser);
                
                // Apply additional filters if needed
                if (!isBlank(keywords) || !isBlank(location) || !isBlank(experienceLevel) || 
                    !isBlank(jobType) || daysOld > 0 || remoteOnly) {
                    
                    return applyNonStatusFilters(savedJobs, searchParams);
                }
                
                log.info("Returning {} jobs with SAVED status", savedJobs.size());
                return savedJobs;
            }
            
            // Normal case for other statuses
            Job.ApplicationStatus status = Job.ApplicationStatus.valueOf(applicationStatus);
            log.info("Filtering directly by application status: {}", status);
            
            // Get jobs with the requested status directly from the repository
            List<Job> statusFilteredJobs = jobRepository.findByUserAndApplicationStatus(currentUser, status);
            
            // Apply additional filters if needed
            if (!isBlank(keywords) || !isBlank(location) || !isBlank(experienceLevel) || 
                !isBlank(jobType) || daysOld > 0 || remoteOnly) {
                
                return applyNonStatusFilters(statusFilteredJobs, searchParams);
            }
            
            log.info("Returning {} jobs with status {}", statusFilteredJobs.size(), status);
            return statusFilteredJobs;
        } catch (IllegalArgumentException e) {
            log.warn("Invalid application status: {}", applicationStatus);
            
            // Fall back to all jobs search if status is invalid
            List<Job> allJobs = jobRepository.findByUser(currentUser);
            return applyNonStatusFilters(allJobs, searchParams);
        }
    }

    private List<Job> applyNonStatusFilters(List<Job> jobs, Map<String, Object> searchParams) {
        String experienceLevel = (String) searchParams.get("experienceLevel");
        String jobType = (String) searchParams.get("jobType");
        Integer daysOld = (Integer) searchParams.get("daysOld");
        Boolean remoteOnly = (Boolean) searchParams.get("remoteOnly");
        
        List<Job> filteredJobs = new ArrayList<>(jobs);
        
        // Filter by experience level if specified
        if (!isBlank(experienceLevel)) {
            filteredJobs = filteredJobs.stream()
                .filter(job -> job.getExperienceLevel() != null && 
                            job.getExperienceLevel().equalsIgnoreCase(experienceLevel))
                .collect(Collectors.toList());
            log.info("After experience level filter: {} jobs", filteredJobs.size());
        }
        
        // Filter by job type if specified
        if (!isBlank(jobType)) {
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
     * Helper method to check if a string is null, empty, or blank
     */
    private boolean isBlank(String str) {
        return str == null || str.trim().isEmpty();
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