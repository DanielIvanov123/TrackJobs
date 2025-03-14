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
    
    // Cache to store request counts per IP
    private LoadingCache<String, Integer> requestCounts;
    
    public RateLimitingFilter() {
        requestCounts = CacheBuilder.newBuilder()
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
        
        // Try to increment request count
        int requests;
        try {
            requests = requestCounts.get(clientIP);
            if (requests >= MAX_REQUESTS_PER_MINUTE) {
                // Too many requests
                httpResponse.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                httpResponse.getWriter().write("Too many requests. Please try again later.");
                return;
            }
            
            // Increment the count
            requestCounts.put(clientIP, requests + 1);
            
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