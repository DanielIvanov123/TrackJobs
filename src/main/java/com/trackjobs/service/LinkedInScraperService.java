// src/main/java/com/trackjobs/service/LinkedInScraperService.java
package com.trackjobs.service;

import com.trackjobs.model.Job;
import com.trackjobs.model.ScrapingConfig;
import com.trackjobs.repository.JobRepository;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
@Slf4j
public class LinkedInScraperService {

    @Autowired
    private JobRepository jobRepository;
    
    @Value("${linkedin.scraper.user-agent}")
    private String userAgent;
    
    @Value("${linkedin.scraper.request-delay}")
    private int requestDelay;
    
    @Value("${linkedin.scraper.max-pages}")
    private int maxPages;
    
    // List of user agents to rotate through for requests
    private final List<String> USER_AGENTS = Arrays.asList(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0"
    );
    
    /**
     * Scrape LinkedIn jobs based on the provided configuration
     * 
     * @param config The scraping configuration
     * @return A list of scraped jobs
     */
    public List<Job> scrapeJobs(ScrapingConfig config) {
        log.info("Starting LinkedIn job scraping with keywords: {}, location: {}", 
                config.getKeywords(), config.getLocation());
        
        // Initialize stats
        config.setPagesScraped(0);
        config.setTotalJobsFound(0);
        config.setJobsAfterFiltering(0);
        config.setDuplicatesSkipped(0);
        
        // Record start time for performance tracking
        long startTime = System.currentTimeMillis();
        
        // Ensure pages to scrape doesn't exceed the maximum
        int pagesToScrape = Math.min(config.getPagesToScrape(), maxPages);
        List<Job> allScrapedJobs = new ArrayList<>();  // All jobs found from scraping
        List<Job> filteredJobs = new ArrayList<>();    // Jobs after filtering
        Map<String, String> cookies = new HashMap<>();
        
        // Set scrape date to track this batch
        LocalDate scrapeDate = LocalDate.now();
        
        try {
            // Initialize session by getting cookies
            initializeSession(cookies);
            log.info("LinkedIn session initialized successfully");
            
            // Scrape each page
            for (int page = 0; page < pagesToScrape; page++) {
                log.info("Scraping page {} of {}", page + 1, pagesToScrape);
                config.setPagesScraped(page + 1);
                
                // Build the search URL for this page
                String url = buildSearchUrl(config, page);
                
                // Get the page content
                log.debug("Requesting URL: {}", url);
                Document doc = getPageWithRetry(url, cookies);
                if (doc == null) {
                    log.warn("Failed to retrieve page {} after retries", page + 1);
                    continue;
                }
                
                // Extract jobs from the page
                List<Job> pageJobs = extractJobsFromPage(doc, scrapeDate, config);
                config.setTotalJobsFound(config.getTotalJobsFound() + pageJobs.size());
                
                if (pageJobs.isEmpty()) {
                    log.info("No jobs found on page {}, ending scrape", page + 1);
                    break;
                }
                
                allScrapedJobs.addAll(pageJobs);
                log.info("Found {} jobs on page {}", pageJobs.size(), page + 1);
                
                // Get job details for each job (if we have less than 50 jobs to keep it reasonable)
                if (pageJobs.size() <= 50) {
                    int jobCount = 0;
                    for (Job job : pageJobs) {
                        try {
                            jobCount++;
                            log.info("Getting details for job {}/{}: {} at {}", 
                                    jobCount, pageJobs.size(), job.getTitle(), job.getCompany());
                            
                            // Add a delay between requests to avoid rate limiting
                            Thread.sleep(requestDelay);
                            
                            // Get the job details page if URL is available
                            if (job.getUrl() != null && !job.getUrl().isEmpty()) {
                                Document jobDoc = getPageWithRetry(job.getUrl(), cookies);
                                if (jobDoc != null) {
                                    // Extract job description from the details page
                                    String description = extractJobDescription(jobDoc);
                                    job.setDescription(description);
                                    log.debug("Successfully extracted description for job: {}", job.getTitle());
                                }
                            }
                        } catch (Exception e) {
                            log.warn("Error getting details for job {}: {}", job.getTitle(), e.getMessage());
                        }
                    }
                } else {
                    log.info("Skipping detailed job scraping for page {} as there are too many jobs ({})", 
                            page + 1, pageJobs.size());
                }
                
                // Add a delay before next page to avoid rate limiting
                if (page < pagesToScrape - 1) {
                    log.debug("Waiting for {} ms before scraping next page", requestDelay);
                    Thread.sleep(requestDelay);
                }
            }
            
            // Apply filters to the scraped jobs
            filteredJobs = filterJobs(allScrapedJobs, config);
            config.setJobsAfterFiltering(filteredJobs.size());
            
            log.info("Filtering complete: {} jobs after filtering (from {} total jobs)", 
                    filteredJobs.size(), allScrapedJobs.size());
            
            // Save filtered jobs to database
            saveJobs(filteredJobs, config);
            
        } catch (Exception e) {
            log.error("Error during LinkedIn scraping: {}", e.getMessage(), e);
        }
        
        // Set scraping time
        long endTime = System.currentTimeMillis();
        config.setScrapingTimeMs(endTime - startTime);
        
        log.info("LinkedIn scraping completed in {} ms", config.getScrapingTimeMs());
        log.info("Scraping summary: Pages: {}, Total jobs: {}, After filtering: {}, Duplicates skipped: {}", 
                config.getPagesScraped(), config.getTotalJobsFound(), config.getJobsAfterFiltering(), 
                config.getDuplicatesSkipped());
        
        return filteredJobs;
    }
    
    /**
     * Initialize a LinkedIn session to get cookies
     */
    private void initializeSession(Map<String, String> cookies) throws IOException {
        log.debug("Initializing LinkedIn session");
        
        // Get random user agent
        String randomUserAgent = getRandomUserAgent();
        
        // Connect to LinkedIn homepage to get initial cookies
        Connection.Response response = Jsoup.connect("https://www.linkedin.com/")
            .userAgent(randomUserAgent)
            .method(Connection.Method.GET)
            .timeout(30000)
            .execute();
        
        // Save cookies for future requests
        cookies.putAll(response.cookies());
        
        log.debug("Session initialized with {} cookies", cookies.size());
    }
    
    /**
     * Get a random user agent from the list
     */
    private String getRandomUserAgent() {
        int index = new Random().nextInt(USER_AGENTS.size());
        return USER_AGENTS.get(index);
    }
    
    /**
     * Build a LinkedIn search URL based on the configuration and page number
     */
    private String buildSearchUrl(ScrapingConfig config, int page) {
        StringBuilder urlBuilder = new StringBuilder();
        urlBuilder.append("https://www.linkedin.com/jobs/search?");
        
        // Add keywords parameter (required)
        urlBuilder.append("keywords=").append(encodeUrlParam(config.getKeywords()));
        
        // Add location parameter (required)
        urlBuilder.append("&location=").append(encodeUrlParam(config.getLocation()));
        
        // Add pagination parameter (25 jobs per page)
        urlBuilder.append("&start=").append(page * 25);
        
        // Add remote filter if specified
        if (config.isRemoteOnly()) {
            urlBuilder.append("&f_WT=2");  // 2 is LinkedIn's code for remote jobs
        }
        
        // Add experience level filter if specified
        if (config.getExperienceLevel() != null && !config.getExperienceLevel().isEmpty()) {
            urlBuilder.append("&f_E=").append(mapExperienceLevelToLinkedInCode(config.getExperienceLevel()));
        }
        
        // Add job type filter if specified
        if (config.getJobType() != null && !config.getJobType().isEmpty()) {
            urlBuilder.append("&f_JT=").append(mapJobTypeToLinkedInCode(config.getJobType()));
        }
        
        // Add date posted filter based on days old
        if (config.getDaysOld() > 0) {
            String dateCode = mapDaysOldToLinkedInCode(config.getDaysOld());
            if (dateCode != null) {
                urlBuilder.append("&f_TPR=").append(dateCode);
            }
        }
        
        // Add additional experience level filters if specified (from codebase1)
        if (config.getExperienceLevelInclude() != null && !config.getExperienceLevelInclude().isEmpty()) {
            for (String level : config.getExperienceLevelInclude()) {
                urlBuilder.append("&f_E=").append(level);
            }
        }
        
        String url = urlBuilder.toString();
        log.debug("Built search URL: {}", url);
        return url;
    }
    
    /**
     * URL encode a parameter value
     */
    private String encodeUrlParam(String param) {
        return param.replace(" ", "%20");
    }
    
    /**
     * Map experience level to LinkedIn's code
     */
    private String mapExperienceLevelToLinkedInCode(String experienceLevel) {
        switch (experienceLevel.toUpperCase()) {
            case "INTERNSHIP": return "1";
            case "ENTRY_LEVEL": return "2";
            case "ASSOCIATE": return "3";
            case "MID_SENIOR": return "4";
            case "DIRECTOR": return "5";
            case "EXECUTIVE": return "6";
            default: return "";
        }
    }
    
    /**
     * Map job type to LinkedIn's code
     */
    private String mapJobTypeToLinkedInCode(String jobType) {
        switch (jobType.toUpperCase()) {
            case "FULL_TIME": return "F";
            case "PART_TIME": return "P";
            case "CONTRACT": return "C";
            case "TEMPORARY": return "T";
            case "INTERNSHIP": return "I";
            case "VOLUNTEER": return "V";
            default: return "";
        }
    }
    
    /**
     * Map days old to LinkedIn's time range code
     */
    private String mapDaysOldToLinkedInCode(int daysOld) {
        if (daysOld <= 1) return "r24";  // Past 24 hours
        if (daysOld <= 7) return "r604800";  // Past week
        if (daysOld <= 30) return "r2592000";  // Past month
        return null;  // No specific filter
    }
    
    /**
     * Get a page with retry logic
     */
    private Document getPageWithRetry(String url, Map<String, String> cookies) {
        int maxRetries = 3;
        AtomicInteger retryCount = new AtomicInteger(0);
        
        while (retryCount.get() < maxRetries) {
            try {
                // Get random user agent
                String randomUserAgent = getRandomUserAgent();
                
                // Connect to the URL
                Connection.Response response = Jsoup.connect(url)
                    .userAgent(randomUserAgent)
                    .cookies(cookies)
                    .timeout(30000)
                    .followRedirects(true)
                    .execute();
                
                // Update cookies for future requests
                cookies.putAll(response.cookies());
                
                // Parse and return the document
                Document doc = response.parse();
                
                // Check if we got a CAPTCHA or security verification page
                if (doc.title().contains("CAPTCHA") || 
                    doc.title().contains("Security Verification") ||
                    doc.body().text().contains("unusual activity")) {
                    log.warn("LinkedIn is showing a CAPTCHA or security verification page");
                    // Sleep longer before retry
                    Thread.sleep(requestDelay * 2);
                } else {
                    return doc;
                }
            } catch (Exception e) {
                log.warn("Error getting page (attempt {}): {}", retryCount.incrementAndGet(), e.getMessage());
                
                try {
                    // Exponential backoff
                    Thread.sleep(requestDelay * (1 << retryCount.get()));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        
        return null;  // Failed after retries
    }
    
    /**
     * Extract jobs from a search results page
     */
    private List<Job> extractJobsFromPage(Document doc, LocalDate scrapeDate, ScrapingConfig config) {
        List<Job> jobs = new ArrayList<>();
        
        // Find all job cards in the document
        Elements jobCards = doc.select("div.base-card");
        
        if (jobCards.isEmpty()) {
            log.debug("No job cards found on page");
            return jobs;
        }
        
        log.info("Found {} job cards on page", jobCards.size());
        
        for (Element card : jobCards) {
            try {
                // Extract job information from the card
                Element titleElement = card.selectFirst("h3.base-search-card__title");
                Element companyElement = card.selectFirst("h4.base-search-card__subtitle");
                Element locationElement = card.selectFirst("span.job-search-card__location");
                Element dateElement = card.selectFirst("time");
                Element linkElement = card.selectFirst("a.base-card__full-link");
                
                if (titleElement == null || companyElement == null) {
                    log.debug("Skipping incomplete job card");
                    continue;  // Skip incomplete cards
                }
                
                String title = titleElement.text().trim();
                String company = companyElement.text().trim();
                String location = locationElement != null ? locationElement.text().trim() : "";
                
                // Get URL if available
                String url = linkElement != null ? linkElement.attr("href") : "";
                
                // Parse date posted (fallback to today if not available)
                LocalDate datePosted = scrapeDate;
                if (dateElement != null) {
                    String dateStr = dateElement.attr("datetime");
                    if (dateStr != null && !dateStr.isEmpty()) {
                        try {
                            datePosted = LocalDate.parse(dateStr);
                        } catch (Exception e) {
                            log.debug("Could not parse date: {}", dateStr);
                        }
                    }
                }
                
                // Determine experience level from title
                String experienceLevel = determineExperienceLevel(title);
                
                // Determine job type from listing
                String jobType = determineJobType(card);
                
                log.debug("Extracted job: title={}, company={}, location={}", title, company, location);
                
                // Create and add the job
                Job job = Job.builder()
                    .title(title)
                    .company(company)
                    .location(location)
                    .url(url)
                    .datePosted(datePosted)
                    .dateScraped(scrapeDate)
                    .experienceLevel(experienceLevel)
                    .jobType(jobType)
                    .build();
                
                jobs.add(job);
                
            } catch (Exception e) {
                log.warn("Error extracting job from card: {}", e.getMessage());
            }
        }
        
        return jobs;
    }
    
    /**
     * Filter jobs based on config filters
     */
    private List<Job> filterJobs(List<Job> jobs, ScrapingConfig config) {
        log.info("Applying filters to {} jobs", jobs.size());
        
        if (jobs.isEmpty()) {
            return jobs;
        }
        
        List<Job> filteredJobs = new ArrayList<>(jobs);
        
        // Apply title include words filter
        if (config.getTitleIncludeWords() != null && !config.getTitleIncludeWords().isEmpty()) {
            int beforeCount = filteredJobs.size();
            filteredJobs = filteredJobs.stream()
                .filter(job -> {
                    String title = job.getTitle().toLowerCase();
                    return config.getTitleIncludeWords().stream()
                        .anyMatch(word -> title.contains(word.toLowerCase()));
                })
                .collect(Collectors.toList());
            log.info("Title include words filter: {} -> {} jobs", beforeCount, filteredJobs.size());
        }
        
        // Apply title exclude words filter
        if (config.getTitleExcludeWords() != null && !config.getTitleExcludeWords().isEmpty()) {
            int beforeCount = filteredJobs.size();
            filteredJobs = filteredJobs.stream()
                .filter(job -> {
                    String title = job.getTitle().toLowerCase();
                    return config.getTitleExcludeWords().stream()
                        .noneMatch(word -> title.contains(word.toLowerCase()));
                })
                .collect(Collectors.toList());
            log.info("Title exclude words filter: {} -> {} jobs", beforeCount, filteredJobs.size());
        }
        
        // Apply company exclude words filter
        if (config.getCompanyExcludeWords() != null && !config.getCompanyExcludeWords().isEmpty()) {
            int beforeCount = filteredJobs.size();
            filteredJobs = filteredJobs.stream()
                .filter(job -> {
                    String company = job.getCompany().toLowerCase();
                    return config.getCompanyExcludeWords().stream()
                        .noneMatch(word -> company.contains(word.toLowerCase()));
                })
                .collect(Collectors.toList());
            log.info("Company exclude words filter: {} -> {} jobs", beforeCount, filteredJobs.size());
        }
        
        // Apply description exclude words filter (if descriptions are available)
        if (config.getDescriptionExcludeWords() != null && !config.getDescriptionExcludeWords().isEmpty()) {
            int beforeCount = filteredJobs.size();
            filteredJobs = filteredJobs.stream()
                .filter(job -> {
                    if (job.getDescription() == null || job.getDescription().isEmpty()) {
                        return true;  // Keep jobs without descriptions
                    }
                    String desc = job.getDescription().toLowerCase();
                    return config.getDescriptionExcludeWords().stream()
                        .noneMatch(word -> desc.contains(word.toLowerCase()));
                })
                .collect(Collectors.toList());
            log.info("Description exclude words filter: {} -> {} jobs", beforeCount, filteredJobs.size());
        }
        
        // Apply experience level exclude filter
        if (config.getExperienceLevelExclude() != null && !config.getExperienceLevelExclude().isEmpty()) {
            int beforeCount = filteredJobs.size();
            filteredJobs = filteredJobs.stream()
                .filter(job -> {
                    String level = determineExperienceLevelCode(job.getExperienceLevel());
                    return !config.getExperienceLevelExclude().contains(level);
                })
                .collect(Collectors.toList());
            log.info("Experience level exclude filter: {} -> {} jobs", beforeCount, filteredJobs.size());
        }
        
        return filteredJobs;
    }
    
    /**
     * Map experience level to LinkedIn code
     */
    private String determineExperienceLevelCode(String experienceLevel) {
        if (experienceLevel == null) return "0";
        
        if (experienceLevel.equalsIgnoreCase("Internship")) return "1";
        if (experienceLevel.equalsIgnoreCase("Junior") || 
            experienceLevel.equalsIgnoreCase("Entry Level")) return "2";
        if (experienceLevel.equalsIgnoreCase("Associate")) return "3";
        if (experienceLevel.equalsIgnoreCase("Mid-level") || 
            experienceLevel.equalsIgnoreCase("Senior")) return "4";
        if (experienceLevel.equalsIgnoreCase("Director")) return "5";
        if (experienceLevel.equalsIgnoreCase("Executive")) return "6";
        
        return "0";
    }
    
    /**
     * Determine experience level from job title
     */
    private String determineExperienceLevel(String title) {
        String lowerTitle = title.toLowerCase();
        
        if (lowerTitle.contains("intern") || lowerTitle.contains("internship")) {
            return "Internship";
        } else if (lowerTitle.contains("senior") || lowerTitle.contains("sr.") || lowerTitle.contains("lead")) {
            return "Senior";
        } else if (lowerTitle.contains("junior") || lowerTitle.contains("jr.") || lowerTitle.contains("entry")) {
            return "Junior";
        } else if (lowerTitle.contains("principal") || lowerTitle.contains("director") || lowerTitle.contains("head of")) {
            return "Director";
        } else if (lowerTitle.contains("vp") || lowerTitle.contains("vice president") || lowerTitle.contains("chief")) {
            return "Executive";
        } else {
            return "Mid-level";
        }
    }
    
    /**
     * Determine job type from the job card
     */
    private String determineJobType(Element card) {
        String cardText = card.text().toLowerCase();
        
        if (cardText.contains("full-time") || cardText.contains("full time")) {
            return "Full-time";
        } else if (cardText.contains("part-time") || cardText.contains("part time")) {
            return "Part-time";
        } else if (cardText.contains("contract")) {
            return "Contract";
        } else if (cardText.contains("temporary") || cardText.contains("temp")) {
            return "Temporary";
        } else if (cardText.contains("intern") || cardText.contains("internship")) {
            return "Internship";
        } else {
            return "Full-time";  // Default to full-time
        }
    }
    
    /**
     * Extract job description from job details page
     */
    private String extractJobDescription(Document doc) {
        // Try to find the job description element
        Element descElement = doc.selectFirst("div.description__text");
        
        if (descElement == null) {
            log.debug("Description element not found in job details page");
            return "";  // Description not found
        }
        
        // Clean up the description
        descElement.select("button").remove();  // Remove "See more" buttons
        
        return descElement.text().trim();
    }
    
    /**
     * Save jobs to the database, avoiding duplicates
     */
    private void saveJobs(List<Job> jobs, ScrapingConfig config) {
        int savedCount = 0;
        int duplicateCount = 0;
        
        for (Job job : jobs) {
            try {
                // Check if this job already exists (by title, company, and date posted)
                if (!jobExistsInDatabase(job)) {
                    jobRepository.save(job);
                    savedCount++;
                    log.debug("Saved job: {} at {}", job.getTitle(), job.getCompany());
                } else {
                    duplicateCount++;
                }
            } catch (Exception e) {
                log.warn("Error saving job {}: {}", job.getTitle(), e.getMessage());
            }
        }
        
        config.setDuplicatesSkipped(duplicateCount);
        log.info("Saved {} new jobs to the database (skipped {} duplicates)", savedCount, duplicateCount);
    }
    
    /**
     * Check if a job already exists in the database
     */
    private boolean jobExistsInDatabase(Job job) {
        // Get existing jobs with matching title and company
        List<Job> existingJobs = jobRepository.findByTitleContainingIgnoreCaseOrCompanyContainingIgnoreCase(
            job.getTitle(), job.getCompany());
        
        // Check if any of them match this job
        for (Job existingJob : existingJobs) {
            if (existingJob.getCompany().equalsIgnoreCase(job.getCompany()) &&
                existingJob.getTitle().equalsIgnoreCase(job.getTitle()) &&
                (existingJob.getDatePosted() == null || job.getDatePosted() == null || 
                 existingJob.getDatePosted().equals(job.getDatePosted()))) {
                return true;
            }
        }
        
        return false;
    }
}