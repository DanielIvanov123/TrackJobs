package com.trackjobs.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScrapingConfig {
    private String keywords;
    private String location;
    private int pagesToScrape;
    private String experienceLevel;  // e.g., "ENTRY_LEVEL", "MID_SENIOR"
    private String jobType;  // e.g., "FULL_TIME", "PART_TIME", "CONTRACT"
    
    // Optional configs
    private boolean remoteOnly;
    private int daysOld;
}