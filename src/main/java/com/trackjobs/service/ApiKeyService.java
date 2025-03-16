package com.trackjobs.service;

import com.trackjobs.model.ApiKey;
import com.trackjobs.model.User;
import com.trackjobs.repository.ApiKeyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Service for managing API keys
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ApiKeyService {

    private final ApiKeyRepository apiKeyRepository;
    private final UserService userService;
    
    /**
     * Save or update API key for the current user
     * 
     * @param keyName Name of the API key
     * @param keyValue Value of the API key
     * @return The saved API key entity
     * @throws Exception If an error occurs during the save
     */
    @Transactional
    public ApiKey saveApiKey(String keyName, String keyValue) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("You must be logged in to save API keys");
        }
        
        // Check if this key already exists for the user
        Optional<ApiKey> existingKey = apiKeyRepository.findByUserAndKeyNameIgnoreCase(currentUser, keyName);
        
        if (existingKey.isPresent()) {
            // Update existing key
            ApiKey key = existingKey.get();
            key.setKeyValue(keyValue);
            key.setLastUsed(LocalDateTime.now());
            return apiKeyRepository.save(key);
        } else {
            // Create new key
            ApiKey newKey = ApiKey.builder()
                    .keyName(keyName)
                    .keyValue(keyValue)
                    .user(currentUser)
                    .createdAt(LocalDateTime.now())
                    .build();
            
            return apiKeyRepository.save(newKey);
        }
    }
    
    /**
     * Get API key for the current user
     * 
     * @param keyName Name of the API key
     * @return Optional containing the API key, or empty if not found
     */
    @Transactional(readOnly = true)
    public Optional<ApiKey> getApiKey(String keyName) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return Optional.empty();
        }
        
        return apiKeyRepository.findByUserAndKeyNameIgnoreCase(currentUser, keyName);
    }
    
    /**
     * Check if user has a valid Claude API key
     * 
     * @return true if the user has a Claude API key, false otherwise
     */
    @Transactional(readOnly = true)
    public boolean hasClaudeApiKey() {
        return getApiKey("claude").isPresent();
    }
    
    /**
     * Get user's Claude API key
     * 
     * @return Optional containing the Claude API key, or empty if not found
     */
    @Transactional(readOnly = true)
    public Optional<String> getClaudeApiKey() {
        Optional<ApiKey> claudeKey = getApiKey("claude");
        return claudeKey.map(ApiKey::getKeyValue);
    }
    
    /**
     * Delete an API key
     * 
     * @param id ID of the API key
     * @return true if the key was deleted, false otherwise
     */
    @Transactional
    public boolean deleteApiKey(Long id) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return false;
        }
        
        Optional<ApiKey> key = apiKeyRepository.findById(id);
        if (key.isPresent() && key.get().getUser().getId().equals(currentUser.getId())) {
            apiKeyRepository.delete(key.get());
            return true;
        }
        
        return false;
    }
}