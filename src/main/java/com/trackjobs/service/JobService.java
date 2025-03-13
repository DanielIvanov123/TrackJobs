package com.trackjobs.service;

import com.trackjobs.model.Job;
import com.trackjobs.model.ScrapingConfig;
import com.trackjobs.repository.JobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@Slf4j
public class JobService {

    @Autowired
    private JobRepository jobRepository;
    
    @Autowired
    private LinkedInScraperService linkedInScraperService;
    
    /**
     * Get all jobs from the database
     */
    public List<Job> getAllJobs() {
        return jobRepository.findAll();
    }
    
    /**
     * Get jobs scraped on the most recent scrape date
     */
    public List<Job> getRecentJobs() {
        return jobRepository.findMostRecentlyScraped();
    }
    
    /**
     * Search for jobs by keyword and location
     */
    public List<Job> searchJobs(String keyword, String location) {
        if (keyword != null && !keyword.isEmpty() && 
            location != null && !location.isEmpty()) {
            return jobRepository.findByKeywordAndLocation(keyword, location);
        } else if (keyword != null && !keyword.isEmpty()) {
            return jobRepository.findByTitleContainingIgnoreCaseOrCompanyContainingIgnoreCase(keyword, keyword);
        } else if (location != null && !location.isEmpty()) {
            return jobRepository.findByLocationContainingIgnoreCase(location);
        } else {
            return jobRepository.findAll();
        }
    }
    
    /**
     * Find jobs posted in the last X days
     */
    public List<Job> getRecentlyPostedJobs(int days) {
        LocalDate cutoffDate = LocalDate.now().minusDays(days);
        return jobRepository.findByDatePostedGreaterThanEqual(cutoffDate);
    }
    
    /**
     * Run a LinkedIn scrape with the given configuration
     */
    public List<Job> scrapeLinkedInJobs(ScrapingConfig config) {
        return linkedInScraperService.scrapeJobs(config);
    }
}