package com.trackjobs.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "scraper_configs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavedScraperConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false)
    private String keywords;
    
    @Column(nullable = false)
    private String location;
    
    private int pagesToScrape;
    
    private String experienceLevel;
    
    private String jobType;
    
    private boolean remoteOnly;
    
    private int daysOld;
    
    @Column(length = 1000)
    private String titleIncludeWords;
    
    @Column(length = 1000)
    private String titleExcludeWords;
    
    @Column(length = 1000)
    private String companyExcludeWords;
    
    @Column(length = 1000)
    private String descriptionExcludeWords;
    
    @Column(length = 1000)
    private String experienceLevelInclude;
    
    @Column(length = 1000)
    private String experienceLevelExclude;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "last_used")
    private LocalDateTime lastUsed;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        lastUsed = LocalDateTime.now();
    }
    
    @PreUpdate
    public void preUpdate() {
        lastUsed = LocalDateTime.now();
    }
}