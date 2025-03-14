package com.trackjobs.service;

import com.trackjobs.model.User;
import com.trackjobs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

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
     * Update last login time for a user
     */
    @Transactional
    public void updateLastLogin(String username) {
        userRepository.findByUsername(username).ifPresent(user -> {
            user.setLastLogin(LocalDateTime.now());
            userRepository.save(user);
        });
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
}