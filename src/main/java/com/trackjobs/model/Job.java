package com.trackjobs.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    
    @Column(length = 5000)
    @Lob
    private String description;
    
    private String url;
    
    @Column(name = "date_posted")
    private LocalDate datePosted;
    
    @Column(name = "date_scraped")
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
    }
}