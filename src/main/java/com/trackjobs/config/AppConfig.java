package com.trackjobs.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * Application configuration
 */
@Configuration
public class AppConfig {

    /**
     * Configure RestTemplate for API calls
     * 
     * @return RestTemplate instance
     */
    @Bean(name = "apiRestTemplate")
    public RestTemplate apiRestTemplate() {
        // Create a custom request factory with longer timeouts
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        // Set connect timeout to 10 seconds (10000 milliseconds)
        requestFactory.setConnectTimeout(10000);
        // Set read timeout to 60 seconds (60000 milliseconds) - Claude can take time to generate
        requestFactory.setReadTimeout(60000);
        
        return new RestTemplate(requestFactory);
    }
    
    /**
     * Configure ObjectMapper for JSON processing
     * With support for Java 8 date/time types (LocalDate, LocalDateTime, etc.)
     * 
     * @return ObjectMapper instance
     */
    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        // Register JavaTimeModule to support Java 8 date/time types
        mapper.registerModule(new JavaTimeModule());
        // Configure to write dates as ISO-8601 strings instead of timestamps
        mapper.configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);
        return mapper;
    }
}