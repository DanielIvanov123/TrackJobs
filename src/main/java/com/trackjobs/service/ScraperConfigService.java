package com.trackjobs.service;

import com.trackjobs.model.SavedScraperConfig;
import com.trackjobs.model.ScrapingConfig;
import com.trackjobs.model.User;
import com.trackjobs.repository.ScraperConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScraperConfigService {

    private final ScraperConfigRepository scraperConfigRepository;
    private final UserService userService;
    
    /**
     * Save a new scraper configuration for the current user
     */
    @Transactional
    public SavedScraperConfig saveConfig(String configName, ScrapingConfig config) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("You must be logged in to save configurations");
        }
        
        // Check if name already exists for this user
        if (scraperConfigRepository.existsByNameAndUser(configName, currentUser)) {
            throw new IllegalArgumentException("Configuration with name '" + configName + "' already exists");
        }
        
        // Convert lists to comma-separated strings for storage
        String titleIncludeWords = String.join(",", config.getTitleIncludeWords());
        String titleExcludeWords = String.join(",", config.getTitleExcludeWords());
        String companyExcludeWords = String.join(",", config.getCompanyExcludeWords());
        String descriptionExcludeWords = String.join(",", config.getDescriptionExcludeWords());
        String experienceLevelInclude = String.join(",", config.getExperienceLevelInclude());
        
        // Create new saved config
        SavedScraperConfig savedConfig = SavedScraperConfig.builder()
                .name(configName)
                .keywords(config.getKeywords())
                .location(config.getLocation())
                .pagesToScrape(config.getPagesToScrape())
                .experienceLevel(config.getExperienceLevel())
                .jobType(config.getJobType())
                .remoteOnly(config.isRemoteOnly())
                .daysOld(config.getDaysOld())
                .titleIncludeWords(titleIncludeWords)
                .titleExcludeWords(titleExcludeWords)
                .companyExcludeWords(companyExcludeWords)
                .descriptionExcludeWords(descriptionExcludeWords)
                .experienceLevelInclude(experienceLevelInclude)
                .user(currentUser)
                .createdAt(LocalDateTime.now())
                .build();
        
        return scraperConfigRepository.save(savedConfig);
    }
    
    /**
     * Get all saved configurations for the current user
     */
    @Transactional(readOnly = true)
    public List<SavedScraperConfig> getUserConfigs() {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return List.of();
        }
        
        return scraperConfigRepository.findByUserOrderByLastUsedDesc(currentUser);
    }
    
    /**
     * Load a saved configuration by ID for the current user
     */
    @Transactional
    public ScrapingConfig loadConfig(Long configId) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("You must be logged in to load configurations");
        }
        
        SavedScraperConfig savedConfig = scraperConfigRepository.findByIdAndUser(configId, currentUser)
                .orElseThrow(() -> new IllegalArgumentException("Configuration not found or does not belong to you"));
        
        // Update last used timestamp
        savedConfig.setLastUsed(LocalDateTime.now());
        scraperConfigRepository.save(savedConfig);
        
        // Convert from saved format to ScrapingConfig
        return ScrapingConfig.builder()
                .keywords(savedConfig.getKeywords())
                .location(savedConfig.getLocation())
                .pagesToScrape(savedConfig.getPagesToScrape())
                .experienceLevel(savedConfig.getExperienceLevel())
                .jobType(savedConfig.getJobType())
                .remoteOnly(savedConfig.isRemoteOnly())
                .daysOld(savedConfig.getDaysOld())
                .titleIncludeWords(splitCommaSeparated(savedConfig.getTitleIncludeWords()))
                .titleExcludeWords(splitCommaSeparated(savedConfig.getTitleExcludeWords()))
                .companyExcludeWords(splitCommaSeparated(savedConfig.getCompanyExcludeWords()))
                .descriptionExcludeWords(splitCommaSeparated(savedConfig.getDescriptionExcludeWords()))
                .experienceLevelInclude(splitCommaSeparated(savedConfig.getExperienceLevelInclude()))
                .build();
    }
    
    /**
     * Delete a saved configuration by ID
     */
    @Transactional
    public void deleteConfig(Long configId) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("You must be logged in to delete configurations");
        }
        
        SavedScraperConfig savedConfig = scraperConfigRepository.findByIdAndUser(configId, currentUser)
                .orElseThrow(() -> new IllegalArgumentException("Configuration not found or does not belong to you"));
        
        scraperConfigRepository.delete(savedConfig);
    }
    
    /**
     * Helper method to split comma-separated string into list
     */
    private List<String> splitCommaSeparated(String value) {
        if (value == null || value.trim().isEmpty()) {
            return List.of();
        }
        return Arrays.asList(value.split(","));
    }
}