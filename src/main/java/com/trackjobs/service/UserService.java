package com.trackjobs.service;

import com.trackjobs.model.User;
import com.trackjobs.repository.JobRepository;
import com.trackjobs.repository.UserRepository;
import com.trackjobs.service.ResumeService;

import lombok.extern.slf4j.Slf4j;
import com.trackjobs.repository.ApiKeyRepository;

import com.trackjobs.repository.ScraperConfigRepository;

import org.springframework.context.annotation.Lazy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JobRepository jobRepository;
    private final ScraperConfigRepository scraperConfigRepository;
    
    // Use @Lazy to break circular dependency
    private final ResumeService resumeService;
    
    // API Key Repository to handle API key deletion
    private final ApiKeyRepository apiKeyRepository;

    public UserService(
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        JobRepository jobRepository,
        ScraperConfigRepository scraperConfigRepository,
        @Lazy ResumeService resumeService,
        ApiKeyRepository apiKeyRepository) {
            
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jobRepository = jobRepository;
        this.scraperConfigRepository = scraperConfigRepository;
        this.resumeService = resumeService;
        this.apiKeyRepository = apiKeyRepository;
    }

    /**
     * Find a user by username
     */
    @Transactional(readOnly = true)
    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    /**
     * Register a new user
     */
    @Transactional
    public User register(String username, String email, String password) {
        // Check if username already exists
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Username already exists");
        }

        // Check if email already exists
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already exists");
        }

        // Create new user
        User user = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(password))
                .createdAt(LocalDateTime.now())
                .enabled(true)
                .build();

        return userRepository.save(user);
    }

    /**
     * Get the current authenticated user
     */
    @Transactional(readOnly = true)
    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            log.warn("No authentication found in security context");
            return null;
        }
        
        if (!authentication.isAuthenticated()) {
            log.warn("Authentication exists but is not authenticated");
            return null;
        }
        
        if ("anonymousUser".equals(authentication.getPrincipal())) {
            log.warn("Authentication is for anonymous user");
            return null;
        }
        
        String username = authentication.getName();
        log.debug("Getting user for authenticated username: {}", username);
        
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            log.warn("No user found for username: {}", username);
        } else {
            log.debug("Found user: ID={}, username={}", user.getId(), user.getUsername());
        }
        
        return user;
    }
    
    /**
     * Wipe all data for the current authenticated user
     * This is a destructive operation that removes all user data but keeps the account
     */
    @Transactional
    public void wipeUserData() {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("You must be logged in to perform this operation");
        }
        
        log.warn("Wiping all data for user: {} (ID: {})", currentUser.getUsername(), currentUser.getId());
        
        // Delete all saved scraper configurations
        scraperConfigRepository.deleteByUser(currentUser);
        log.info("Deleted all scraper configurations for user: {}", currentUser.getUsername());
        
        // Delete all resumes
        resumeService.deleteAllResumesForUser(currentUser);
        log.info("Deleted all resumes for user: {}", currentUser.getUsername());
        
        // Delete all API keys
        apiKeyRepository.deleteByUser(currentUser);
        log.info("Deleted all API keys for user: {}", currentUser.getUsername());
        
        // Delete all jobs
        jobRepository.deleteByUser(currentUser);
        log.info("Deleted all jobs for user: {}", currentUser.getUsername());
        
        log.warn("User data wipe completed for: {}", currentUser.getUsername());
    }
}