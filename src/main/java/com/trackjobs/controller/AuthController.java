package com.trackjobs.controller;

import com.trackjobs.model.User;
import com.trackjobs.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final UserService userService;

    @GetMapping("/login")
    public String loginPage(@RequestParam(required = false) String error,
                           @RequestParam(required = false) String logout, 
                           Model model) {
        if (error != null) {
            model.addAttribute("error", "Invalid username or password");
        }
        
        if (logout != null) {
            model.addAttribute("message", "You have been logged out successfully");
        }
        
        return "login";
    }

    @GetMapping("/register")
    public String registerPage() {
        return "register";
    }

    @PostMapping("/register")
    public String registerUser(@RequestParam String username,
                              @RequestParam String email,
                              @RequestParam String password,
                              @RequestParam String confirmPassword,
                              Model model) {
        try {
            // Validate password match
            if (!password.equals(confirmPassword)) {
                model.addAttribute("error", "Passwords do not match");
                return "register";
            }
            
            // Register user
            User user = userService.register(username, email, password);
            log.info("User registered successfully: {}", username);
            
            model.addAttribute("success", "Registration successful. Please log in.");
            return "login";
        } catch (IllegalArgumentException e) {
            model.addAttribute("error", e.getMessage());
            return "register";
        } catch (Exception e) {
            log.error("Error registering user: {}", e.getMessage(), e);
            model.addAttribute("error", "Registration failed: " + e.getMessage());
            return "register";
        }
    }
}