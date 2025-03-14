package com.trackjobs.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class ProgressService {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public void updateProgress(String userId, int percentComplete, String status, 
                               String currentTask, int currentCount, int totalCount) {
        Map<String, Object> progressData = new HashMap<>();
        progressData.put("percentComplete", percentComplete);
        progressData.put("status", status);
        progressData.put("currentTask", currentTask);
        progressData.put("currentCount", currentCount);
        progressData.put("totalCount", totalCount);
        progressData.put("timestamp", System.currentTimeMillis());
        
        messagingTemplate.convertAndSend("/topic/progress/" + userId, progressData);
    }
}