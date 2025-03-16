package com.trackjobs.repository;

import com.trackjobs.model.ApiKey;
import com.trackjobs.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for managing API keys
 */
@Repository
public interface ApiKeyRepository extends JpaRepository<ApiKey, Long> {
    
    /**
     * Find an API key by user and key name (case-sensitive)
     */
    Optional<ApiKey> findByUserAndKeyName(User user, String keyName);
    
    /**
     * Find an API key by user and key name (case-insensitive)
     */
    Optional<ApiKey> findByUserAndKeyNameIgnoreCase(User user, String keyName);
    
    /**
     * Delete all API keys for a specific user
     */
    void deleteByUser(User user);
}