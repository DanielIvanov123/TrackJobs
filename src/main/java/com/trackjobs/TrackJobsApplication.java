package com.trackjobs;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TrackJobsApplication {
    public static void main(String[] args) {
        SpringApplication.run(TrackJobsApplication.class, args);
    }
}