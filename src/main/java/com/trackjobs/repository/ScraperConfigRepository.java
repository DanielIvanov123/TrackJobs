package com.trackjobs.repository;

import com.trackjobs.model.SavedScraperConfig;
import com.trackjobs.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ScraperConfigRepository extends JpaRepository<SavedScraperConfig, Long> {
    
    List<SavedScraperConfig> findByUserOrderByLastUsedDesc(User user);
    
    Optional<SavedScraperConfig> findByIdAndUser(Long id, User user);
    
    boolean existsByNameAndUser(String name, User user);
}