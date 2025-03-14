package com.trackjobs.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScrapingProgress {
    private int percentComplete;
    private int currentPage;
    private int totalPages;
    private String status;
    private int experienceLevelIndex;
    private int totalExperienceLevels;
    private String currentExperienceLevel;
    
    public ScrapingProgress(int percentComplete, int currentPage, String status, int experienceLevelIndex) {
        this.percentComplete = percentComplete;
        this.currentPage = currentPage;
        this.status = status;
        this.experienceLevelIndex = experienceLevelIndex;
    }
}