package com.trackjobs.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/**
 * Service for storing and retrieving files on the filesystem
 */
@Service
@Slf4j
public class FileStorageService {

    @Value("${file.upload.dir:/opt/trackjobs/uploads}")
    private String uploadDir;
    
    /**
     * Store a file on the filesystem
     * 
     * @param file The file to store
     * @param userId The ID of the user who owns the file
     * @return The path where the file was stored
     * @throws IOException If an error occurs while storing the file
     */
    public String storeFile(MultipartFile file, Long userId) throws IOException {
        // Create the directory if it doesn't exist
        String userDir = uploadDir + File.separator + userId + File.separator + "resumes";
        Path userDirPath = Paths.get(userDir);
        
        if (!Files.exists(userDirPath)) {
            Files.createDirectories(userDirPath);
            log.info("Created directory: {}", userDirPath);
        }
        
        // Generate a unique filename to prevent collisions
        String originalFilename = file.getOriginalFilename();
        String fileExtension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        
        String uniqueFilename = UUID.randomUUID().toString() + fileExtension;
        Path filePath = userDirPath.resolve(uniqueFilename);
        
        // Copy the file to the target location
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
        
        log.info("Stored file {} for user {} at {}", originalFilename, userId, filePath);
        
        return filePath.toString();
    }
    
    /**
     * Delete a file from the filesystem
     * 
     * @param filePath The path of the file to delete
     * @return true if the file was deleted, false otherwise
     */
    public boolean deleteFile(String filePath) {
        try {
            Path path = Paths.get(filePath);
            if (Files.exists(path)) {
                Files.delete(path);
                log.info("Deleted file: {}", filePath);
                return true;
            }
            return false;
        } catch (IOException e) {
            log.error("Error deleting file {}: {}", filePath, e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Get a file from the filesystem
     * 
     * @param filePath The path of the file to get
     * @return The file as a byte array
     * @throws IOException If an error occurs while reading the file
     */
    public byte[] getFile(String filePath) throws IOException {
        Path path = Paths.get(filePath);
        return Files.readAllBytes(path);
    }
}