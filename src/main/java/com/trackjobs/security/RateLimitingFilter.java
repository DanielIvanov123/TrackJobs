package com.trackjobs.security;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

/**
 * Filter that implements rate limiting to prevent abuse and brute force attacks.
 * Uses client IP address to track and limit requests.
 */
@Component
public class RateLimitingFilter implements Filter {

    // Maximum number of requests allowed in the time window
    private static final int MAX_REQUESTS_PER_MINUTE = 60;
    
    // Higher limit for scrape progress endpoint
    private static final int MAX_PROGRESS_REQUESTS_PER_MINUTE = 1000;
    
    // Cache to store request counts per IP
    private LoadingCache<String, Integer> requestCounts;
    
    // Cache to store requests for progress endpoints
    private LoadingCache<String, Integer> progressRequestCounts;
    
    public RateLimitingFilter() {
        requestCounts = CacheBuilder.newBuilder()
                .expireAfterWrite(1, TimeUnit.MINUTES)
                .build(new CacheLoader<String, Integer>() {
                    @Override
                    public Integer load(String key) {
                        return 0;
                    }
                });
                
        progressRequestCounts = CacheBuilder.newBuilder()
                .expireAfterWrite(1, TimeUnit.MINUTES)
                .build(new CacheLoader<String, Integer>() {
                    @Override
                    public Integer load(String key) {
                        return 0;
                    }
                });
    }
    
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        
        // Get client IP address
        String clientIP = getClientIP(httpRequest);
        
        // Get request path to check if it's a progress endpoint
        String requestPath = httpRequest.getRequestURI();
        boolean isProgressEndpoint = requestPath.contains("/api/jobs/scrape/progress");
        
        // Choose the appropriate cache and limit
        LoadingCache<String, Integer> cache = isProgressEndpoint ? progressRequestCounts : requestCounts;
        int maxRequests = isProgressEndpoint ? MAX_PROGRESS_REQUESTS_PER_MINUTE : MAX_REQUESTS_PER_MINUTE;
        
        // Try to increment request count
        int requests;
        try {
            requests = cache.get(clientIP);
            if (requests >= maxRequests) {
                // Too many requests
                httpResponse.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                httpResponse.getWriter().write("Too many requests. Please try again later.");
                return;
            }
            
            // Increment the count
            cache.put(clientIP, requests + 1);
            
        } catch (ExecutionException e) {
            // Log the error and allow the request
            System.err.println("Error checking rate limit: " + e.getMessage());
        }
        
        // Continue with the filter chain
        chain.doFilter(request, response);
    }
    
    /**
     * Extract client IP address from request
     */
    private String getClientIP(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            // Get the first IP if multiple are present
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}