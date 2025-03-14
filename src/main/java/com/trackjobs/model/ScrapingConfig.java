package com.trackjobs.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScrapingConfig {
    private String keywords;
    private String location;
    private int pagesToScrape;
    private String experienceLevel;  // e.g., "ENTRY_LEVEL", "MID_SENIOR"
    private String jobType;  // e.g., "FULL_TIME", "PART_TIME", "CONTRACT"
    
    // Optional configs
    private boolean remoteOnly;
    private int daysOld;
    
    // Advanced filters from codebase1
    private List<String> titleIncludeWords;
    private List<String> titleExcludeWords;
    private List<String> companyExcludeWords;
    private List<String> descriptionExcludeWords;
    private List<String> experienceLevelInclude;
    
    // User who initiated the scrape
    private User user;
    
    // Scraping stats (to be populated during scraping)
    private int pagesScraped;
    private int totalJobsFound;
    private int jobsAfterFiltering;
    private int duplicatesSkipped;
    private long scrapingTimeMs;
}