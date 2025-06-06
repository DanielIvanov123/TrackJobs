package com.trackjobs.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.trackjobs.model.User;

import javax.persistence.EnumType;
import javax.persistence.Enumerated;

import javax.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "jobs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String title;
    
    @Column(nullable = false)
    private String company;
    
    @Column(nullable = false)
    private String location;
    
    @Column(columnDefinition = "TEXT")
    @Lob
    private String description;
    
    private String url;
    
    @Column(name = "date_posted")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate datePosted;
    
    @Column(name = "date_scraped")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate dateScraped;
    
    @Column(name = "experience_level")
    private String experienceLevel;
    
    @Column(name = "job_type")
    private String jobType;
    
    // Add user relationship
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private User user;
    
    @PrePersist
    public void prePersist() {
        if (dateScraped == null) {
            dateScraped = LocalDate.now();
        }
        
        // Ensure applicationStatus is never null when persisting
        if (applicationStatus == null) {
            applicationStatus = ApplicationStatus.SAVED;
        }
    }

    @Enumerated(EnumType.STRING)
    @Column(name = "application_status")
    private ApplicationStatus applicationStatus = ApplicationStatus.SAVED;

    // Enum for application status
    public enum ApplicationStatus {
        SAVED("Saved"),
        APPLIED("Applied"),
        INTERVIEWING("Interviewing"),
        REJECTED("Rejected"),
        OFFER("Offer");
        
        private final String displayName;
        
        ApplicationStatus(String displayName) {
            this.displayName = displayName;
        }
        
        public String getDisplayName() {
            return displayName;
        }
    }
}