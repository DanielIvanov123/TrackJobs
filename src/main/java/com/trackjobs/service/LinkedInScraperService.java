package com.trackjobs.service;

import com.trackjobs.model.Job;
import com.trackjobs.model.ScrapingConfig;
import com.trackjobs.model.ScrapingProgress;
import com.trackjobs.repository.JobRepository;
import lombok.extern.slf4j.Slf4j;
import com.trackjobs.service.ProgressService;

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
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
@Slf4j
public class LinkedInScraperService {

    @Autowired
    private JobRepository jobRepository;
    
    @Autowired
    private ProgressService progressService;  // Inject the progress service
    
    @Value("${linkedin.scraper.user-agent}")
    private String userAgent;
    
    @Value("${linkedin.scraper.request-delay}")
    private int requestDelay;
    
    @Value("${linkedin.scraper.max-pages}")
    private int maxPages;
    
    // Map to store progress by scrape ID
    private final Map<String, ScrapingProgress> scrapeProgressMap = new ConcurrentHashMap<>();
    
    // List of user agents to rotate through for requests
    private final List<String> USER_AGENTS = Arrays.asList(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0"
    );
    
    /**
     * Scrape LinkedIn jobs based on the provided configuration
     * Performs separate searches for each included experience level
     * 
     * @param scrapeId The unique ID for tracking progress
     * @param config The scraping configuration
     * @return A list of scraped jobs
     */
    public List<Job> scrapeJobs(ScrapingConfig config, String scrapeId) {
        log.info("Starting LinkedIn job scraping with keywords: {}, location: {}", 
                config.getKeywords(), config.getLocation());
        
        // Initialize progress tracking
        ScrapingProgress progress = new ScrapingProgress();
        progress.setPercentComplete(0);
        progress.setStatus("Initializing scrape...");
        progress.setCurrentPage(0);
        
        // Store progress in map for API endpoint access
        scrapeProgressMap.put(scrapeId, progress);
        
        // Initialize stats
        config.setPagesScraped(0);
        config.setTotalJobsFound(0);
        config.setJobsAfterFiltering(0);
        config.setDuplicatesSkipped(0);
        
        // Record start time for performance tracking
        long startTime = System.currentTimeMillis();
        
        // Set scrape date to track this batch
        LocalDate scrapeDate = LocalDate.now();
        
        // Combined list of all jobs from all experience level searches
        List<Job> allScrapedJobs = new ArrayList<>();
        
        try {
            // Update progress - connecting phase
            updateProgress(scrapeId, 5, "Connecting to LinkedIn...");
            
            // Initialize session by getting cookies
            Map<String, String> cookies = new HashMap<>();
            initializeSession(cookies);
            log.info("LinkedIn session initialized successfully");
            
            // Update progress - connection successful
            updateProgress(scrapeId, 10, "Connected to LinkedIn successfully");
            
            List<String> experienceLevelsToSearch;
            
            // If experience levels are specified, search for each level separately
            if (config.getExperienceLevelInclude() != null && !config.getExperienceLevelInclude().isEmpty()) {
                experienceLevelsToSearch = config.getExperienceLevelInclude();
                log.info("Will search for the following experience levels: {}", experienceLevelsToSearch);
            } else {
                // If no specific levels are included, do a single search without experience filter
                experienceLevelsToSearch = Collections.singletonList("Not specified");
                log.info("No specific experience levels selected, will perform a single general search");
            }
            
            // Update progress with experience level count
            progress.setTotalExperienceLevels(experienceLevelsToSearch.size());
            progress.setExperienceLevelIndex(0);
            updateProgress(scrapeId, progress);
            
            // Track jobs by URL to avoid duplicates across experience level searches
            Set<String> processedJobUrls = new HashSet<>();
            
            // Perform separate searches for each experience level
            for (int expLevelIndex = 0; expLevelIndex < experienceLevelsToSearch.size(); expLevelIndex++) {
                String experienceLevel = experienceLevelsToSearch.get(expLevelIndex);
                
                // Update progress for current experience level
                progress.setExperienceLevelIndex(expLevelIndex);
                progress.setCurrentExperienceLevel(experienceLevel);
                progress.setStatus("Searching for experience level: " + experienceLevel);
                
                // Calculate progress percentage based on experience level
                int baseProgress = 10; // 10% for initialization
                int progressPerExpLevel = 80 / experienceLevelsToSearch.size(); // 80% for scraping
                int currentProgress = baseProgress + (expLevelIndex * progressPerExpLevel);
                
                updateProgress(scrapeId, currentProgress, progress.getStatus());
                
                log.info("Searching for jobs with experience level: {}", experienceLevel);
                
                // Clone the config but set the specific experience level
                ScrapingConfig levelConfig = cloneConfigWithExperienceLevel(config, experienceLevel);
                
                // Set progress info for this scrape
                int pagesToScrape = Math.min(levelConfig.getPagesToScrape(), maxPages);
                progress.setTotalPages(pagesToScrape);
                progress.setCurrentPage(0);
                updateProgress(scrapeId, progress);
                
                // Scrape jobs for this specific experience level
                List<Job> jobsForLevel = scrapeJobsForExperienceLevel(levelConfig, scrapeDate, cookies, processedJobUrls, scrapeId, currentProgress, progressPerExpLevel);
                
                // Update the original config with stats from this scrape
                config.setPagesScraped(config.getPagesScraped() + levelConfig.getPagesScraped());
                config.setTotalJobsFound(config.getTotalJobsFound() + levelConfig.getTotalJobsFound());
                config.setDuplicatesSkipped(config.getDuplicatesSkipped() + levelConfig.getDuplicatesSkipped());
                
                // Add jobs to the combined list
                allScrapedJobs.addAll(jobsForLevel);
                
                log.info("Completed search for experience level '{}'. Found {} jobs", 
                        experienceLevel, jobsForLevel.size());
                
                // Add a delay between experience level searches to avoid rate limiting
                if (expLevelIndex < experienceLevelsToSearch.size() - 1) {
                    Thread.sleep(requestDelay * 2);
                }
            }
            
            // Final processing phase
            updateProgress(scrapeId, 90, "Filtering and processing scraped jobs...");
            
            // Apply other filters (but not experience level filtering)
            List<Job> filteredJobs = filterJobsExceptExperience(allScrapedJobs, config);
            config.setJobsAfterFiltering(filteredJobs.size());
            
            log.info("Filtering complete: {} jobs after filtering (from {} total jobs)", 
                    filteredJobs.size(), allScrapedJobs.size());
            
            // Save filtered jobs to database
            updateProgress(scrapeId, 95, "Saving jobs to database...");
            saveJobs(filteredJobs, config);
            
            // Completed
            updateProgress(scrapeId, 100, "Scraping completed successfully!");
            
        } catch (Exception e) {
            log.error("Error during LinkedIn scraping: {}", e.getMessage(), e);
            updateProgress(scrapeId, -1, "Error during scraping: " + e.getMessage());
        }
        
        // Set scraping time
        long endTime = System.currentTimeMillis();
        config.setScrapingTimeMs(endTime - startTime);
        
        log.info("LinkedIn scraping completed in {} ms", config.getScrapingTimeMs());
        log.info("Scraping summary: Pages: {}, Total jobs: {}, After filtering: {}, Duplicates skipped: {}", 
                config.getPagesScraped(), config.getTotalJobsFound(), config.getJobsAfterFiltering(), 
                config.getDuplicatesSkipped());
        
        // Keep progress info available for a while, then clean up
        scheduleProgressCleanup(scrapeId);
        
        return allScrapedJobs;
    }

    public List<Job> scrapeJobs(ScrapingConfig config) {
        String scrapeId = UUID.randomUUID().toString();
        return scrapeJobs(config, scrapeId);
    }

    /**
     * Schedule cleanup of progress info after 10 minutes
     */
    private void scheduleProgressCleanup(String scrapeId) {
        new Timer().schedule(new TimerTask() {
            @Override
            public void run() {
                scrapeProgressMap.remove(scrapeId);
                log.debug("Removed progress info for scrape ID: {}", scrapeId);
            }
        }, 10 * 60 * 1000); // 10 minutes
    }
    
    /**
     * Get current progress for a scrape
     */
    public ScrapingProgress getProgress(String scrapeId) {
        return scrapeProgressMap.getOrDefault(scrapeId, 
                new ScrapingProgress(0, 0, "Scrape not found or already completed", 0));
    }
    
    /**
     * Update scraping progress
     */
    private void updateProgress(String scrapeId, int percentComplete, String status) {
        ScrapingProgress progress = scrapeProgressMap.getOrDefault(scrapeId, new ScrapingProgress());
        progress.setPercentComplete(percentComplete);
        progress.setStatus(status);
        scrapeProgressMap.put(scrapeId, progress);
        
        log.debug("Progress update for scrape {}: {}% - {}", scrapeId, percentComplete, status);
    }
    
    /**
     * Update scraping progress with full progress object
     */
    private void updateProgress(String scrapeId, ScrapingProgress progress) {
        scrapeProgressMap.put(scrapeId, progress);
        log.debug("Full progress update for scrape {}: {}%", scrapeId, progress.getPercentComplete());
    }

    /**
     * Clone the config with a specific experience level
     */
    private ScrapingConfig cloneConfigWithExperienceLevel(ScrapingConfig original, String experienceLevel) {
        return ScrapingConfig.builder()
            .keywords(original.getKeywords())
            .location(original.getLocation())
            .pagesToScrape(original.getPagesToScrape())
            .experienceLevel(experienceLevel)
            .jobType(original.getJobType())
            .remoteOnly(original.isRemoteOnly())
            .daysOld(original.getDaysOld())
            .titleIncludeWords(original.getTitleIncludeWords())
            .titleExcludeWords(original.getTitleExcludeWords())
            .companyExcludeWords(original.getCompanyExcludeWords())
            .descriptionExcludeWords(original.getDescriptionExcludeWords())
            .experienceLevelInclude(original.getExperienceLevelInclude())
            .user(original.getUser())
            .build();
    }

    /**
     * Scrape jobs for a specific experience level with progress tracking
     */
    private List<Job> scrapeJobsForExperienceLevel(ScrapingConfig config, LocalDate scrapeDate, 
                                                Map<String, String> cookies, Set<String> processedJobUrls,
                                                String scrapeId, int baseProgress, int progressForThisLevel) 
                                                throws InterruptedException {
        
        String experienceLevelName = config.getExperienceLevel() != null ? 
                config.getExperienceLevel() : "Not specified";
        
        List<Job> jobsForLevel = new ArrayList<>();
        int pagesToScrape = Math.min(config.getPagesToScrape(), maxPages);
        
        log.info("====== PROGRESS: Starting search for experience level: {} ======", experienceLevelName);
        
        // Get progress from map
        ScrapingProgress progress = scrapeProgressMap.get(scrapeId);
        if (progress == null) {
            progress = new ScrapingProgress();
            scrapeProgressMap.put(scrapeId, progress);
        }
        
        // Scrape each page
        for (int page = 0; page < pagesToScrape; page++) {
            // Update page progress
            progress.setCurrentPage(page + 1);
            
            // Calculate progress percentage for this page
            int progressPerPage = progressForThisLevel / pagesToScrape;
            int currentProgress = baseProgress + (progressPerPage * page);
            
            String statusMessage = String.format("Scraping page %d of %d for experience level '%s'", 
                    page + 1, pagesToScrape, experienceLevelName);
            
            updateProgress(scrapeId, currentProgress, statusMessage);
            
            log.info("====== PROGRESS: {} ======", statusMessage);
            config.setPagesScraped(page + 1);
            
            // Build the search URL for this page
            String url = buildSearchUrl(config, page);
            log.debug("Request URL: {}", url);
            
            // Get the page content
            Document doc = getPageWithRetry(url, cookies);
            if (doc == null) {
                log.warn("Failed to retrieve page {} after retries", page + 1);
                continue;
            }
            
            // Extract jobs from the page
            List<Job> pageJobs = extractJobsFromPage(doc, scrapeDate, config, experienceLevelName);
            config.setTotalJobsFound(config.getTotalJobsFound() + pageJobs.size());
            
            if (pageJobs.isEmpty()) {
                log.info("No jobs found on page {} for experience level '{}', ending scrape", 
                        page + 1, experienceLevelName);
                break;
            }
            
            // Filter out duplicates from previous experience level searches
            List<Job> uniqueJobs = new ArrayList<>();
            for (Job job : pageJobs) {
                if (job.getUrl() != null && !job.getUrl().isEmpty()) {
                    if (!processedJobUrls.contains(job.getUrl())) {
                        processedJobUrls.add(job.getUrl());
                        uniqueJobs.add(job);
                    } else {
                        config.setDuplicatesSkipped(config.getDuplicatesSkipped() + 1);
                    }
                } else {
                    // For jobs without URL, add them anyway (no way to deduplicate)
                    uniqueJobs.add(job);
                }
            }
            
            log.info("Found {} unique jobs on page {} for experience level '{}'", 
                    uniqueJobs.size(), page + 1, experienceLevelName);
            
            // Get job details (as in the original code)
            if (uniqueJobs.size() <= 50) {
                int jobCount = 0;
                int totalJobs = uniqueJobs.size();
                
                log.info("====== PROGRESS: Starting job details scraping for {} jobs ======", totalJobs);
                
                // Update progress for job details phase
                updateProgress(scrapeId, currentProgress + (progressPerPage / 2), 
                        "Getting detailed job information for " + totalJobs + " jobs");
                
                for (Job job : uniqueJobs) {
                    try {
                        jobCount++;
                        
                        // Update detailed progress for individual job
                        String jobStatus = String.format("Getting details for job %d/%d: %s", 
                                jobCount, totalJobs, job.getTitle());
                        
                        // Calculate job detail progress within the page
                        int jobDetailProgress = currentProgress + (progressPerPage / 2) + 
                                ((progressPerPage / 2) * jobCount / totalJobs);
                        
                        updateProgress(scrapeId, jobDetailProgress, jobStatus);
                        
                        log.info("====== PROGRESS: {} ======", jobStatus);
                        
                        // Add a delay between requests to avoid rate limiting
                        Thread.sleep(requestDelay);
                        
                        // Get the job details page if URL is available
                        if (job.getUrl() != null && !job.getUrl().isEmpty()) {
                            Document jobDoc = getPageWithRetry(job.getUrl(), cookies);
                            if (jobDoc != null) {
                                // Extract job description from the details page
                                String description = extractJobDescription(jobDoc);
                                job.setDescription(description);
                                log.info("====== PROGRESS: Successfully extracted description ({} chars) for job {}/{} ======", 
                                        description != null ? description.length() : 0, jobCount, totalJobs);
                            } else {
                                log.warn("====== PROGRESS: Failed to retrieve job details page for job {}/{} ======", 
                                        jobCount, totalJobs);
                            }
                        } else {
                            log.info("====== PROGRESS: No URL available for job {}/{} ======", jobCount, totalJobs);
                        }
                    } catch (Exception e) {
                        log.warn("Error getting details for job {}: {}", job.getTitle(), e.getMessage());
                    }
                }
                
                log.info("====== PROGRESS: Completed job details scraping for {} jobs ======", totalJobs);
            } else {
                log.info("Skipping detailed job scraping for page {} as there are too many jobs ({})", 
                        page + 1, uniqueJobs.size());
            }
            
            jobsForLevel.addAll(uniqueJobs);
            
            // Add a delay before next page to avoid rate limiting
            if (page < pagesToScrape - 1) {
                log.debug("Waiting for {} ms before scraping next page", requestDelay);
                Thread.sleep(requestDelay);
            }
            
            log.info("====== PROGRESS: Completed page {} for experience level '{}'. Found {} jobs ======", 
                    page + 1, experienceLevelName, jobsForLevel.size());
        }
        
        return jobsForLevel;
    }
    
    /**
     * Initialize a LinkedIn session to get cookies
     */
    private void initializeSession(Map<String, String> cookies) throws IOException {
        log.debug("Initializing LinkedIn session");
        int maxRetries = 3;
        IOException lastException = null;
        
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Get random user agent
                String randomUserAgent = getRandomUserAgent();
                
                log.debug("Connecting to LinkedIn with user agent: {}", randomUserAgent);
                
                // Connect to LinkedIn homepage to get initial cookies
                Connection.Response response = Jsoup.connect("https://www.linkedin.com/")
                    .userAgent(randomUserAgent)
                    .method(Connection.Method.GET)
                    .timeout(30000)
                    .execute();
                
                // Save cookies for future requests
                cookies.putAll(response.cookies());
                
                log.info("Session initialized successfully with {} cookies", cookies.size());
                return;
            } catch (IOException e) {
                lastException = e;
                log.warn("Failed to connect to LinkedIn (attempt {}/{}): {}", 
                         attempt, maxRetries, e.getMessage());
                
                // Wait before retrying
                try {
                    Thread.sleep(requestDelay * attempt);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Connection interrupted", ie);
                }
            }
        }
        
        // If we get here, all attempts failed
        throw new IOException("Failed to connect to LinkedIn after " + maxRetries + " attempts", 
                              lastException);
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
            String expCode = mapExperienceLevelToLinkedInCode(config.getExperienceLevel());
            if (!expCode.isEmpty()) {
                urlBuilder.append("&f_E=").append(expCode);
                
                // Log the experience level code being used
                log.debug("Adding experience level: {} (code: {})", 
                         config.getExperienceLevel(), expCode);
            }
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
        
        // Normalize the experience level to handle different formats
        String normalizedLevel = experienceLevel.toUpperCase()
                                 .replace("-", "_")
                                 .replace(" ", "_");
        
        switch (normalizedLevel) {
            case "INTERNSHIP": return "1";
            case "ENTRY_LEVEL": return "2";
            case "ASSOCIATE": return "3";
            case "MID_SENIOR_LEVEL": return "4";
            case "DIRECTOR": return "5";
            case "EXECUTIVE": return "6";
            default:
                // Try to match with more flexible patterns
                if (normalizedLevel.contains("INTERN")) return "1";
                if (normalizedLevel.contains("ENTRY") || normalizedLevel.contains("JUNIOR")) return "2";
                if (normalizedLevel.contains("ASSOCIATE")) return "3";
                if (normalizedLevel.contains("MID") || normalizedLevel.contains("SENIOR")) return "4";
                if (normalizedLevel.contains("DIRECTOR")) return "5";
                if (normalizedLevel.contains("EXEC")) return "6";
                return "";
        }
    }
    
    /**
     * Map LinkedIn code to experience level string
     */
    private String mapLinkedInCodeToExperienceLevel(String code) {
        switch (code) {
            case "1": return "Internship";
            case "2": return "Entry level"; 
            case "3": return "Associate";
            case "4": return "Mid-Senior level";
            case "5": return "Director";
            case "6": return "Executive";
            default: return "Not specified";
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
     * Extract jobs from a search results page and assign the experience level from the search
     */
    private List<Job> extractJobsFromPage(Document doc, LocalDate scrapeDate, ScrapingConfig config, String experienceLevel) {
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
                
                log.debug("Extracted job: title={}, company={}, location={}, experience={}", 
                         title, company, location, experienceLevel);
                
                // Create and add the job - use the experience level from the search
                Job job = Job.builder()
                    .title(title)
                    .company(company)
                    .location(location)
                    .url(url)
                    .datePosted(datePosted)
                    .dateScraped(scrapeDate)
                    .experienceLevel(experienceLevel)  // Use the experience level from the search
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
     * Filter jobs based on config filters except experience level
     * (since we've already handled that by assigning experience level from the search)
     */
    private List<Job> filterJobsExceptExperience(List<Job> jobs, ScrapingConfig config) {
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
        
        config.setDuplicatesSkipped(config.getDuplicatesSkipped() + duplicateCount);
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