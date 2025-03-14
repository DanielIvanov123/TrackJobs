package com.trackjobs.service;

import com.trackjobs.model.Job;
import com.trackjobs.model.ScrapingConfig;
import com.trackjobs.repository.JobRepository;
import lombok.extern.slf4j.Slf4j;
import com.trackjobs.model.User;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
                String code = mapExperienceLevelToLinkedInCode(level);
                if (!code.isEmpty()) {
                    urlBuilder.append("&f_E=").append(code);
                }
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
        if (experienceLevel == null) return "";
        
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
     * Map LinkedIn code to experience level string
     */
    private String mapLinkedInCodeToExperienceLevel(String code) {
        switch (code) {
            case "1": return "INTERNSHIP";
            case "2": return "ENTRY_LEVEL"; 
            case "3": return "ASSOCIATE";
            case "4": return "MID_SENIOR";
            case "5": return "DIRECTOR";
            case "6": return "EXECUTIVE";
            default: return "NOT_APPLICABLE";
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
                    .experienceLevel(determineExperienceLevel(title, null))
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
     * Determine experience level from job title and standardize to LinkedIn's categorization
     * @param title The job title
     * @param description The job description
     * @return The standardized LinkedIn experience level
     */
    private String determineExperienceLevel(String title, String description) {
        String lowerTitle = title.toLowerCase();
        String lowerDescription = description != null ? description.toLowerCase() : "";
        
        // Try to determine from title first (most accurate)
        if (lowerTitle.contains("intern") || lowerTitle.contains("internship")) {
            return "INTERNSHIP";
        } else if (lowerTitle.contains("ceo") || lowerTitle.contains("chief") || 
                lowerTitle.contains("president") || lowerTitle.contains("vp") || 
                lowerTitle.contains("vice president")) {
            return "EXECUTIVE";
        } else if (lowerTitle.contains("director") || lowerTitle.contains("head of") || 
                lowerTitle.contains("principal")) {
            return "DIRECTOR";
        } else if (lowerTitle.contains("senior") || lowerTitle.contains("sr.") || 
                lowerTitle.contains("lead") || lowerTitle.contains("staff")) {
            return "MID_SENIOR";
        } else if (lowerTitle.contains("junior") || lowerTitle.contains("jr.") || 
                lowerTitle.contains("entry") || lowerTitle.contains("associate") || 
                lowerTitle.contains("assistant")) {
            return "ENTRY_LEVEL";
        }
        
        // Fall back to description if available
        if (!lowerDescription.isEmpty()) {
            if (lowerDescription.contains("internship") || lowerDescription.contains("intern program")) {
                return "INTERNSHIP";
            } else if (lowerDescription.contains("executive") || lowerDescription.contains("c-suite")) {
                return "EXECUTIVE";
            } else if (lowerDescription.contains("director role") || lowerDescription.contains("director position")) {
                return "DIRECTOR";
            } else if (lowerDescription.contains("senior") || lowerDescription.contains("experienced")) {
                return "MID_SENIOR";
            } else if (lowerDescription.contains("entry level") || lowerDescription.contains("junior")) {
                return "ENTRY_LEVEL";
            } else if (lowerDescription.contains("associate position") || lowerDescription.contains("associate role")) {
                return "ASSOCIATE";
            }
        }
        
        // If we couldn't determine specifically, default to "NOT_APPLICABLE"
        return "NOT_APPLICABLE";
    }
    
    /**
     * Determine the LinkedIn numeric code for an experience level string
     * This method is used during filtering to convert experience level strings to LinkedIn codes
     * 
     * @param experienceLevel The experience level string
     * @return The LinkedIn numeric code for the experience level
     */
    private String determineExperienceLevelCode(String experienceLevel) {
        if (experienceLevel == null) return "0";
        
        switch (experienceLevel.toUpperCase()) {
            case "INTERNSHIP":
                return "1";
            case "ENTRY_LEVEL":
            case "ENTRY LEVEL":
            case "JUNIOR":
                return "2";
            case "ASSOCIATE":
                return "3";
            case "MID_SENIOR":
            case "MID-SENIOR":
            case "SENIOR":
            case "MID-LEVEL":
                return "4";
            case "DIRECTOR":
                return "5";
            case "EXECUTIVE":
                return "6";
            case "NOT_APPLICABLE":
            case "NOT SPECIFIED":
                return "0";
            default:
                return "0";
        }
    }
    
    /**
     * Convert a job's experience level to a standardized format
     * @param job The job to update
     * @return The updated job with standardized experience level
     */
    private Job standardizeJobExperienceLevel(Job job) {
        if (job.getExperienceLevel() == null || job.getExperienceLevel().isEmpty()) {
            job.setExperienceLevel("NOT_APPLICABLE");
        } else {
            // Convert any non-standard format to our standard format
            String standardLevel;
            
            switch (job.getExperienceLevel().toUpperCase()) {
                case "INTERNSHIP":
                case "INTERN":
                    standardLevel = "INTERNSHIP";
                    break;
                case "ENTRY LEVEL":
                case "JUNIOR":
                case "JR":
                    standardLevel = "ENTRY_LEVEL";
                    break;
                case "ASSOCIATE":
                    standardLevel = "ASSOCIATE";
                    break;
                case "MID-LEVEL":
                case "SENIOR":
                case "SR":
                case "LEAD":
                    standardLevel = "MID_SENIOR";
                    break;
                case "DIRECTOR":
                case "HEAD OF":
                case "PRINCIPAL":
                    standardLevel = "DIRECTOR";
                    break;
                case "EXECUTIVE":
                case "VP":
                case "CHIEF":
                case "CEO":
                case "CTO":
                case "CFO":
                    standardLevel = "EXECUTIVE";
                    break;
                default:
                    standardLevel = "NOT_APPLICABLE";
            }
            
            job.setExperienceLevel(standardLevel);
        }
        
        return job;
    }
    
    /**
     * Apply experience level filters to a list of jobs
     * @param jobs The list of jobs to filter
     * @param experienceLevelInclude The list of experience levels to include
     * @param experienceLevelExclude The list of experience levels to exclude
     * @return The filtered list of jobs
     */
    private List<Job> applyExperienceLevelFilters(List<Job> jobs, List<String> experienceLevelInclude, List<String> experienceLevelExclude) {
        if (jobs.isEmpty()) {
            return jobs;
        }
        
        log.info("Applying experience level filters - Include: {}, Exclude: {}", 
            experienceLevelInclude, experienceLevelExclude);
        
        // Skip filtering if both include and exclude are empty
        if ((experienceLevelInclude == null || experienceLevelInclude.isEmpty()) &&
            (experienceLevelExclude == null || experienceLevelExclude.isEmpty())) {
            log.info("No experience level filters to apply");
            return jobs;
        }
        
        int beforeCount = jobs.size();
        List<Job> filteredJobs = new ArrayList<>(jobs);
        
        // Handle exclude first (exclude takes precedence)
        if (experienceLevelExclude != null && !experienceLevelExclude.isEmpty()) {
            filteredJobs = filteredJobs.stream()
                .filter(job -> {
                    // For each job, get its experience level code
                    String levelCode = determineExperienceLevelCode(job.getExperienceLevel());
                    
                    // Keep the job if its level is NOT in the exclude list
                    boolean keep = experienceLevelExclude.stream()
                        .noneMatch(excludeLevel -> {
                            String excludeCode = mapExperienceLevelToLinkedInCode(excludeLevel);
                            return levelCode.equals(excludeCode);
                        });
                        
                    if (!keep) {
                        log.debug("Excluded job by experience level: {} ({})", job.getTitle(), job.getExperienceLevel());
                    }
                    return keep;
                })
                .collect(Collectors.toList());
        }
        
        // Then apply include filter if specified
        if (experienceLevelInclude != null && !experienceLevelInclude.isEmpty()) {
            filteredJobs = filteredJobs.stream()
                .filter(job -> {
                    // For each job, get its experience level code
                    String levelCode = determineExperienceLevelCode(job.getExperienceLevel());
                    
                    // "NOT_APPLICABLE" (code "0") is always included if specified
                    if (levelCode.equals("0") && experienceLevelInclude.contains("NOT_APPLICABLE")) {
                        return true;
                    }
                    
                    // Keep the job if its level IS in the include list
                    boolean keep = experienceLevelInclude.stream()
                        .anyMatch(includeLevel -> {
                            String includeCode = mapExperienceLevelToLinkedInCode(includeLevel);
                            return levelCode.equals(includeCode);
                        });
                        
                    if (!keep) {
                        log.debug("Filtered out job not in include list: {} ({})", job.getTitle(), job.getExperienceLevel());
                    }
                    return keep;
                })
                .collect(Collectors.toList());
        }
        
        log.info("Experience level filtering: {} -> {} jobs", beforeCount, filteredJobs.size());
        return filteredJobs;
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
     * Filter jobs based on config filters
     */
    private List<Job> filterJobs(List<Job> jobs, ScrapingConfig config) {
        log.info("Applying filters to {} jobs", jobs.size());
        
        if (jobs.isEmpty()) {
            return jobs;
        }
        
        List<Job> filteredJobs = new ArrayList<>(jobs);
        
        // Standardize experience levels for all jobs first
        filteredJobs = filteredJobs.stream()
            .map(this::standardizeJobExperienceLevel)
            .collect(Collectors.toList());
        
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
        
        // Apply experience level filtering
        filteredJobs = applyExperienceLevelFilters(
            filteredJobs, 
            config.getExperienceLevelInclude(), 
            config.getExperienceLevelExclude()
        );
        
        return filteredJobs;
    }
    
    /**
     * Save jobs to the database, avoiding duplicates
     */
    @Transactional
    private void saveJobs(List<Job> jobs, ScrapingConfig config) {
        int savedCount = 0;
        int duplicateCount = 0;
        
        User user = config.getUser();
        if (user == null) {
            log.error("Cannot save jobs: No user associated with this scrape");
            return;
        }
        
        log.info("Saving {} jobs for user: {}", jobs.size(), user.getUsername());
        
        for (Job job : jobs) {
            try {
                // Associate job with user
                job.setUser(user);
                
                // Check if this job already exists for this user
                if (!jobExistsInDatabase(job, user)) {
                    // Explicitly set the user again before saving
                    job.setUser(user);
                    
                    Job savedJob = jobRepository.save(job);
                    
                    // Log the saved job ID and user ID for debugging
                    log.debug("Saved job ID: {}, User ID: {}, Title: {} at {}", 
                            savedJob.getId(), (savedJob.getUser() != null ? savedJob.getUser().getId() : "null"),
                            job.getTitle(), job.getCompany());
                    
                    savedCount++;
                } else {
                    duplicateCount++;
                }
            } catch (Exception e) {
                log.error("Error saving job {}: {}", job.getTitle(), e.getMessage(), e);
            }
        }
        
        config.setDuplicatesSkipped(duplicateCount);
        log.info("Saved {} new jobs to the database (skipped {} duplicates) for user: {}", 
                savedCount, duplicateCount, user.getUsername());
    }
    
    /**
     * Check if a job already exists in the database for this user
     */
    private boolean jobExistsInDatabase(Job job, User user) {
        // Ensure we're only checking against the current user's jobs
        if (user == null) {
            log.warn("Cannot check for duplicates: No user provided");
            return false;
        }
        
        // Get existing jobs with matching title and company for this user only
        List<Job> existingJobs = jobRepository.findByUserAndTitleContainingIgnoreCaseOrCompanyContainingIgnoreCase(
            user, job.getTitle(), job.getCompany());
        
        log.debug("Found {} potential duplicate jobs for user {}", existingJobs.size(), user.getUsername());
        
        // Check if any of them match this job
        for (Job existingJob : existingJobs) {
            // Only check jobs that belong to the current user
            if (existingJob.getUser() != null && existingJob.getUser().getId().equals(user.getId()) &&
                existingJob.getCompany().equalsIgnoreCase(job.getCompany()) &&
                existingJob.getTitle().equalsIgnoreCase(job.getTitle()) &&
                (existingJob.getDatePosted() == null || job.getDatePosted() == null || 
                existingJob.getDatePosted().equals(job.getDatePosted()))) {
                log.debug("Found duplicate job: {} at {} for user {}", 
                        job.getTitle(), job.getCompany(), user.getUsername());
                return true;
            }
        }
        
        return false;
    }
}