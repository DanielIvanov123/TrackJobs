package com.trackjobs.controller;

import com.trackjobs.model.ApiKey;
import com.trackjobs.service.ApiKeyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Controller for API key management endpoints
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ApiKeyController {

    private final ApiKeyService apiKeyService;
    
    /**
     * API endpoint to save an API key
     */
    @PostMapping("/api/apikey/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveApiKey(@RequestBody Map<String, String> request) {
        try {
            String keyName = request.getOrDefault("keyName", "").trim();
            String keyValue = request.getOrDefault("keyValue", "").trim();
            
            if (keyName.isEmpty() || keyValue.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Key name and value are required"
                ));
            }
            
            ApiKey apiKey = apiKeyService.saveApiKey(keyName, keyValue);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "API key saved successfully");
            response.put("apiKey", Map.of(
                "id", apiKey.getId(),
                "keyName", apiKey.getKeyName(),
                "createdAt", apiKey.getCreatedAt(),
                "lastUsed", apiKey.getLastUsed()
            ));
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error saving API key: {}", e.getMessage(), e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Error saving API key: " + e.getMessage());
            
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    /**
     * API endpoint to check if the user has a Claude API key
     */
    @GetMapping("/api/apikey/claude/check")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> checkClaudeApiKey() {
        boolean hasKey = apiKeyService.hasClaudeApiKey();
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("hasKey", hasKey);
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * API endpoint to get API key info
     */
    @GetMapping("/api/apikey/{keyName}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getApiKeyInfo(@PathVariable String keyName) {
        Optional<ApiKey> apiKey = apiKeyService.getApiKey(keyName);
        
        Map<String, Object> response = new HashMap<>();
        if (apiKey.isPresent()) {
            response.put("success", true);
            response.put("hasKey", true);
            response.put("apiKey", Map.of(
                "id", apiKey.get().getId(),
                "keyName", apiKey.get().getKeyName(),
                "createdAt", apiKey.get().getCreatedAt(),
                "lastUsed", apiKey.get().getLastUsed()
            ));
        } else {
            response.put("success", true);
            response.put("hasKey", false);
        }
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * API endpoint to delete an API key
     */
    @DeleteMapping("/api/apikey/{id}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteApiKey(@PathVariable Long id) {
        boolean deleted = apiKeyService.deleteApiKey(id);
        
        Map<String, Object> response = new HashMap<>();
        if (deleted) {
            response.put("success", true);
            response.put("message", "API key deleted successfully");
            return ResponseEntity.ok(response);
        } else {
            response.put("success", false);
            response.put("message", "API key not found or could not be deleted");
            return ResponseEntity.badRequest().body(response);
        }
    }
}