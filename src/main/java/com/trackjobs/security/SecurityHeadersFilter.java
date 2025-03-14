package com.trackjobs.security;

import org.springframework.stereotype.Component;
import javax.servlet.*;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Filter that adds security headers to HTTP responses to protect against common web vulnerabilities.
 * These headers help mitigate XSS, clickjacking, MIME sniffing, and other attacks.
 */
@Component
public class SecurityHeadersFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        
        // Prevent content type sniffing
        httpResponse.setHeader("X-Content-Type-Options", "nosniff");
        
        // Enable browser's XSS protection
        httpResponse.setHeader("X-XSS-Protection", "1; mode=block");
        
        // Prevent clickjacking attacks
        httpResponse.setHeader("X-Frame-Options", "DENY");
        
        // Specify referrer policy
        httpResponse.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        
        // Content Security Policy
        httpResponse.setHeader("Content-Security-Policy", 
            "default-src 'self'; " +
            "script-src 'self' https://cdn.jsdelivr.net; " +
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " + 
            "img-src 'self' data:; " +
            "font-src 'self' https://cdn.jsdelivr.net");
        
        // Continue with the filter chain
        chain.doFilter(request, response);
    }
}