package com.trackjobs.repository;

import com.trackjobs.model.Job;
import com.trackjobs.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface JobRepository extends JpaRepository<Job, Long> {
    
    // Find jobs by user
    List<Job> findByUser(User user);
    
    // Count jobs by user
    long countByUser(User user);
    
    // Find by user and title/company
    List<Job> findByUserAndTitleContainingIgnoreCaseOrCompanyContainingIgnoreCase(
            User user, String title, String company);
    
    // Find by user and location
    List<Job> findByUserAndLocationContainingIgnoreCase(User user, String location);
    
    // Custom query to search by user, keyword and location
    @Query("SELECT j FROM Job j WHERE j.user = :user AND " +
           "(LOWER(j.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(j.company) LIKE LOWER(CONCAT('%', :keyword, '%'))) AND " +
           "LOWER(j.location) LIKE LOWER(CONCAT('%', :location, '%'))")
    List<Job> findByUserAndKeywordAndLocation(
            @Param("user") User user,
            @Param("keyword") String keyword,
            @Param("location") String location);
    
    // Find jobs posted after a certain date for a user
    List<Job> findByUserAndDatePostedGreaterThanEqual(User user, LocalDate date);
    
    // Count jobs posted after a certain date for a user
    long countByUserAndDatePostedGreaterThanEqual(User user, LocalDate date);
    
    // Find most recently scraped jobs for a user
    @Query("SELECT j FROM Job j WHERE j.user = :user AND j.dateScraped = " +
           "(SELECT MAX(j2.dateScraped) FROM Job j2 WHERE j2.user = :user)")
    List<Job> findMostRecentlyScrapedByUser(@Param("user") User user);
    
    // Find most recent scrape date for a user
    @Query("SELECT MAX(j.dateScraped) FROM Job j WHERE j.user = :user")
    Optional<LocalDate> findMostRecentScrapeDateByUser(@Param("user") User user);

    void deleteByUser(User user);
}