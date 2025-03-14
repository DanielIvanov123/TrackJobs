package com.trackjobs.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Service for performing automated database backups
 * Uses mysqldump to create backups and maintains a configurable number of backup files
 */
@Service
@Slf4j
public class BackupService {

    @Value("${backup.directory:/opt/trackjobs/backups}")
    private String backupDirectory;
    
    @Value("${backup.mysql.user:trackjobs_user}")
    private String mysqlUser;
    
    @Value("${backup.mysql.password:secure_password_here}")
    private String mysqlPassword;
    
    @Value("${backup.mysql.database:trackjobs}")
    private String dbName;
    
    @Value("${backup.keep.count:10}")
    private int keepCount;
    
    /**
     * Scheduled backup task that runs daily at 2:00 AM
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void performDatabaseBackup() {
        log.info("Starting scheduled database backup");
        
        try {
            // Create timestamp for the backup file
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String backupFileName = String.format("%s/trackjobs_%s.sql", backupDirectory, timestamp);
            
            // Build the mysqldump command
            String[] command = {
                "/bin/bash",
                "-c",
                String.format("mkdir -p %s && mysqldump -u%s -p%s %s > %s", 
                    backupDirectory, mysqlUser, mysqlPassword, dbName, backupFileName)
            };
            
            // Execute the backup command
            Process process = Runtime.getRuntime().exec(command);
            int exitCode = process.waitFor();
            
            if (exitCode == 0) {
                log.info("Database backup created successfully: {}", backupFileName);
                
                // Clean up old backups
                cleanupOldBackups();
            } else {
                // Read error stream if backup failed
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                    StringBuilder errorMsg = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        errorMsg.append(line).append("\n");
                    }
                    log.error("Database backup failed: {}", errorMsg.toString());
                }
            }
        } catch (IOException | InterruptedException e) {
            log.error("Error during database backup: {}", e.getMessage(), e);
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        }
    }
    
    /**
     * Remove old backup files, keeping only the most recent ones
     */
    private void cleanupOldBackups() {
        try {
            // List backup files and sort by name (which includes timestamp)
            String[] command = {
                "/bin/bash",
                "-c",
                String.format("ls -t %s/trackjobs_*.sql | tail -n +%d | xargs -r rm", 
                    backupDirectory, keepCount + 1)
            };
            
            Process process = Runtime.getRuntime().exec(command);
            int exitCode = process.waitFor();
            
            if (exitCode == 0) {
                log.info("Old backup cleanup completed successfully");
            } else {
                log.warn("Old backup cleanup failed with exit code: {}", exitCode);
            }
        } catch (IOException | InterruptedException e) {
            log.error("Error during old backup cleanup: {}", e.getMessage(), e);
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        }
    }
}