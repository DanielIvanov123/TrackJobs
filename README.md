# TrackJobs.work - LinkedIn Job Tracker

TrackJobs.work is a comprehensive tool for tracking job applications from LinkedIn. It helps job seekers organize their job search by scraping LinkedIn job listings, tracking application statuses, and providing AI-powered assistance with resume tailoring and cover letter generation.

## Features

### Job Scraping
- Scrape LinkedIn job listings based on keywords, location, and various filters
- Configure and save multiple scraper configurations for different job searches
- Advanced filtering by experience level, job type, company, and more
- Real-time progress tracking during scraping

### Job Management
- View and search through saved job listings
- Update application status (Saved, Applied, Interviewing, Offer, Rejected)
- Filter jobs by application status
- Sort jobs by various criteria
- Delete job listings you're no longer interested in

### AI-Powered Document Generation
- Generate tailored resumes for specific job postings using Claude API
- Create customized cover letters using Claude API
- All generated documents can be copied to clipboard or downloaded as text files

### Resume Management
- Upload and manage your resume (PDF, DOC, DOCX formats supported)
- Quick access to your resume for document generation

### User Account Management
- Secure user registration and authentication
- Data isolation between users
- Ability to wipe all personal data

## Technologies Used

### Backend
- Java 11
- Spring Boot 2.7.x
- Spring Security
- Spring Data JPA
- Spring WebSocket
- Maven for dependency management
- MySQL Database

### Frontend
- HTML5, CSS3, JavaScript
- Bootstrap 5
- Thymeleaf templating engine

### External Integrations
- Claude AI API for document generation
- JSoup for web scraping

### Security Features
- CSRF protection
- Rate limiting
- Secure password hashing with BCrypt
- Custom headers for XSS protection
- SSL/TLS support

## Setup and Installation

### Prerequisites
- Java 11 or higher
- MySQL 8.0 or higher
- Maven 3.6 or higher

### Database Setup
1. Create a MySQL database:
   ```sql
   CREATE DATABASE trackjobs;
   CREATE USER 'trackjobs_user'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON trackjobs.* TO 'trackjobs_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

2. Update `application.properties` with your database credentials:
   ```properties
   spring.datasource.url=jdbc:mysql://localhost:3306/trackjobs?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
   spring.datasource.username=trackjobs_user
   spring.datasource.password=your_password
   ```

### Build and Run
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/trackjobs.git
   cd trackjobs
   ```

2. Build the project:
   ```bash
   ./mvnw clean package
   ```

3. Run the application:
   ```bash
   ./mvnw spring-boot:run
   ```

4. Access the application at `http://localhost:8080`

### Configuration Options
- Adjust scraping parameters in `application.properties`:
  ```properties
  linkedin.scraper.request-delay=3000
  linkedin.scraper.max-pages=5
  ```

- Configure backup settings:
  ```properties
  backup.directory=/opt/trackjobs/backups
  backup.keep.count=10
  ```

## Usage Guide

### Getting Started
1. Register for an account at `/register`
2. Log in with your credentials
3. Upload your resume from the user menu
4. Set up your Claude API key (if you want to use AI features)

### Scraping Jobs
1. Navigate to the "Configure Scraper" tab
2. Enter job keywords and location
3. Adjust filters as needed
4. Click "Start Scraping"
5. Monitor progress in real-time
6. View results and switch to Search tab to see all jobs

### Managing Jobs
1. Use the search filters to find specific jobs
2. Update job status using the dropdown on each job card
3. Use status filter pills to see jobs in a specific stage
4. Click on job cards to see full details
5. Generate tailored documents from the job details view

### Using AI Features
1. Set your Claude API key in the user menu
2. Open a job's details
3. Click on the Claude AI dropdown
4. Select to generate a tailored resume or cover letter
5. Copy or download the generated document

## Project Structure

```
src/main/java/com/trackjobs/
├── config/          # Application configuration
├── controller/      # REST and MVC controllers
├── model/           # Entity classes
├── repository/      # Data access interfaces
├── security/        # Security configuration and filters
├── service/         # Business logic
└── TrackJobsApplication.java  # Main application class

src/main/resources/
├── static/          # Static resources (CSS, JS)
├── templates/       # Thymeleaf templates
└── application.properties  # Application configuration
```

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements
- [Spring Boot](https://spring.io/projects/spring-boot)
- [Bootstrap](https://getbootstrap.com/)
- [JSoup](https://jsoup.org/)
- [Anthropic Claude API](https://www.anthropic.com/)