package com.trackjobs.repository;

import com.trackjobs.model.Resume;
import com.trackjobs.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ResumeRepository extends JpaRepository<Resume, Long> {
    
    /**
     * Find all resumes belonging to a user
     */
    List<Resume> findByUser(User user);
    
    /**
     * Find a specific resume by ID and user
     */
    Optional<Resume> findByIdAndUser(Long id, User user);
    
    /**
     * Delete a resume by ID and user
     */
    void deleteByIdAndUser(Long id, User user);
    
    /**
     * Check if a user has any resumes
     */
    boolean existsByUser(User user);
    
    /**
     * Delete all resumes for a user
     */
    void deleteByUser(User user);
}