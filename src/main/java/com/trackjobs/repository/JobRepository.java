package com.trackjobs.repository;

import com.trackjobs.model.Job;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface JobRepository extends JpaRepository<Job, Long> {
    
    List<Job> findByTitleContainingIgnoreCaseOrCompanyContainingIgnoreCase(String title, String company);
    
    List<Job> findByLocationContainingIgnoreCase(String location);
    
    @Query("SELECT j FROM Job j WHERE " +
           "(LOWER(j.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(j.company) LIKE LOWER(CONCAT('%', :keyword, '%'))) AND " +
           "LOWER(j.location) LIKE LOWER(CONCAT('%', :location, '%'))")
    List<Job> findByKeywordAndLocation(String keyword, String location);
    
    List<Job> findByDatePostedGreaterThanEqual(LocalDate date);
    
    @Query("SELECT j FROM Job j WHERE j.dateScraped = (SELECT MAX(j2.dateScraped) FROM Job j2)")
    List<Job> findMostRecentlyScraped();
}