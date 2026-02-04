# EmpleosInclusivos - Capabilities Checklist

**Version:** 1.0
**Date:** 2026-02-04
**Purpose:** Comprehensive validation checklist for platform migration
**Source:** Analysis of Laravel/Laminas MVC codebase

---

## Overview

| User Type | Capabilities | Status |
|-----------|-------------|--------|
| Job Seeker (Postulante) | ~85 | [ ] |
| Company User (Empresa) | ~75 | [ ] |
| OMIL User (Intermediary) | ~45 | [ ] |
| Admin User | ~55 | [ ] |
| System/Automated | ~20 | [ ] |
| **TOTAL** | **~280** | |

---

## 1. JOB SEEKER (Postulante) Capabilities

### 1.1 Authentication & Account Management

#### 1.1.1 Registration
- [ ] Register with email and password
- [ ] Register via Google OAuth
- [ ] Register via LinkedIn OAuth
- [ ] Receive welcome email after registration
- [ ] Email validation via secure link
- [ ] Auto-create profile record on registration

#### 1.1.2 Login & Logout
- [ ] Login with email/password credentials
- [ ] Validate account status (AC=Active, P=Pending, I=Inactive)
- [ ] Reject login for inactive accounts with message
- [ ] Session persistence (5-hour duration)
- [ ] Logout and session cleanup

#### 1.1.3 Password Management
- [ ] Request password recovery via email
- [ ] Receive password recovery email with secure token
- [ ] Reset password using recovery link
- [ ] Change password from settings (current + new + confirm)
- [ ] Password strength validation
- [ ] Receive password change confirmation email

#### 1.1.4 Email Management
- [ ] Change email address
- [ ] Email format validation
- [ ] Check email uniqueness (not already registered)
- [ ] Session email update after change

#### 1.1.5 Account Settings
- [ ] View account settings page
- [ ] View email notification preferences
- [ ] Configure email notification preferences
- [ ] Close account with reason
- [ ] Account closure data archival

---

### 1.2 Profile Management - Personal Information

#### 1.2.1 Basic Information
- [ ] Edit first name (nombre)
- [ ] Edit last name (apellidos)
- [ ] Edit birth date (day/month/year selectors)
- [ ] Edit document number (RUT/cedula/passport)
- [ ] Select document type
- [ ] Select gender (H=Male, M=Female, O=Other)
- [ ] Select marital status (Single, Married, Divorced, Widowed)

#### 1.2.2 Contact Information
- [ ] Select country
- [ ] Select region (dynamic based on country)
- [ ] Select comuna/municipality (dynamic based on region)
- [ ] Edit address
- [ ] Edit phone number with country prefix
- [ ] Phone number format validation

#### 1.2.3 Profile Image
- [ ] Upload profile photo
- [ ] Validate image type (jpg, png, gif)
- [ ] Validate image size (max limit)
- [ ] Display default image when none uploaded
- [ ] Replace existing profile photo

#### 1.2.4 Social Media Links
- [ ] Add/edit Facebook profile URL
- [ ] Add/edit Instagram profile URL
- [ ] Add/edit LinkedIn profile URL

#### 1.2.5 About Me / Presentation
- [ ] Write personal presentation/bio text
- [ ] Save presentation text
- [ ] Character limit validation

---

### 1.3 Profile Management - Inclusion/Disability Information

#### 1.3.1 Disability Declaration
- [ ] Declare disability status (Yes/No)
- [ ] Select disability types (multiple selection):
  - [ ] Mobility (Movilidad)
  - [ ] Sensory (Visual/Hearing)
  - [ ] Intellectual
  - [ ] Psychosocial
  - [ ] Visual specific
  - [ ] Other
  - [ ] Multiple
- [ ] Declare official disability registration status (Yes/In Process/No)
- [ ] Declare invalidity pension status (Yes/No)

#### 1.3.2 Workplace Accommodations
- [ ] Declare if workplace adjustments needed (Yes/No)
- [ ] Specify required workplace adjustments (free text)

---

### 1.4 Profile Management - Education

#### 1.4.1 Postgraduate Education
- [ ] Add postgraduate education record
- [ ] Edit postgraduate education record
- [ ] Delete postgraduate education record
- [ ] Specify institution name (autocomplete)
- [ ] Specify program name
- [ ] Specify completion year
- [ ] Specify completion status (Complete/In Progress)

#### 1.4.2 Higher Education (University)
- [ ] Add higher education record
- [ ] Edit higher education record
- [ ] Delete higher education record
- [ ] Specify institution name (autocomplete from reference)
- [ ] Specify career/degree (autocomplete from catalog)
- [ ] Select related career category
- [ ] Specify start year
- [ ] Specify end year
- [ ] Select completion status (Titulado/Egresado/En Curso/Abandonado)
- [ ] Add institution country if new

#### 1.4.3 Secondary Education (Media)
- [ ] Add secondary education record
- [ ] Edit secondary education record
- [ ] Delete secondary education record
- [ ] Specify school name
- [ ] Specify completion year
- [ ] Select completion status

#### 1.4.4 Basic Education
- [ ] Add basic education record
- [ ] Edit basic education record
- [ ] Delete basic education record
- [ ] Specify school name
- [ ] Specify completion year

#### 1.4.5 Additional Education / Training
- [ ] Add additional education/course record
- [ ] Edit additional education record
- [ ] Delete additional education record
- [ ] Specify course name
- [ ] Specify institution name
- [ ] Specify completion year

#### 1.4.6 Education Level Summary
- [ ] Set highest education level achieved
- [ ] Set education level completion status

---

### 1.5 Profile Management - Languages

- [ ] Add language skill
- [ ] Edit language skill
- [ ] Delete language skill
- [ ] Select language from catalog (~40 languages)
- [ ] Select proficiency level (Basic/Intermediate/Advanced/Fluent)

---

### 1.6 Profile Management - Work Experience

#### 1.6.1 Years of Experience
- [ ] Set total years of experience

#### 1.6.2 Work History
- [ ] Add work experience record
- [ ] Edit work experience record
- [ ] Delete work experience record
- [ ] Specify company name (autocomplete from registered companies + references)
- [ ] Specify position/job title
- [ ] Select work area
- [ ] Select position type/level
- [ ] Specify start date (month/year)
- [ ] Specify end date (month/year)
- [ ] Mark as current job
- [ ] Mark as internship/practice
- [ ] Add job description/details
- [ ] Add company industry if new

#### 1.6.3 Entrepreneurship
- [ ] Declare if currently entrepreneuring (Yes/No)
- [ ] Specify since when (year)
- [ ] Declare interest in entrepreneurship (Yes/No)
- [ ] Select entrepreneurship work area

---

### 1.7 Profile Management - Skills & Portfolio

#### 1.7.1 Technical Skills
- [ ] Add skill from reference catalog (~78 skills)
- [ ] Specify skill proficiency level (1-13 scale)
- [ ] Delete skill
- [ ] View skills by category:
  - [ ] Graphic Design
  - [ ] Digital Marketing
  - [ ] Programming
  - [ ] Administrative
  - [ ] Finance & Business
  - [ ] Engineering & Architecture
  - [ ] Others

#### 1.7.2 CV Document
- [ ] Upload CV document (PDF)
- [ ] Validate CV file type
- [ ] Validate CV file size
- [ ] Download own CV
- [ ] Replace existing CV

#### 1.7.3 Portfolio
- [ ] Add portfolio item
- [ ] Edit portfolio item
- [ ] Delete portfolio item
- [ ] Specify portfolio item title
- [ ] Specify portfolio item description
- [ ] Add portfolio item URL
- [ ] Upload portfolio item image

---

### 1.8 Profile Completeness

- [ ] View profile completeness percentage
- [ ] Automatic completeness calculation on profile changes
- [ ] Minimum completeness requirement indicator
- [ ] Section-by-section completeness tracking

---

### 1.9 Job Search & Discovery

#### 1.9.1 Browse Jobs
- [ ] View public job listings
- [ ] Browse jobs by type category (Employment/Internship/Practice/Training)
- [ ] Paginated job listing
- [ ] View job count per page

#### 1.9.2 Job Filtering
- [ ] Filter by job type
- [ ] Filter by location (region/comuna)
- [ ] Filter by remote work option
- [ ] Filter by work schedule (Full-time/Part-time/Flexible)
- [ ] Search by keyword

#### 1.9.3 Job Details
- [ ] View full job description
- [ ] View salary information (if shown)
- [ ] View required experience
- [ ] View required education level
- [ ] View required careers
- [ ] View required languages
- [ ] View required skills
- [ ] View location details
- [ ] View number of vacancies
- [ ] View job accessibility features
- [ ] View job publication date
- [ ] Track job visit

#### 1.9.4 Company Information
- [ ] View company profile from job listing
- [ ] View company name (or "Importante empresa" if confidential)
- [ ] View company logo (or default if confidential)
- [ ] View company description
- [ ] View company mission/vision
- [ ] View company benefits
- [ ] Browse all jobs from a company ("Trabaja en")

---

### 1.10 Job Applications

#### 1.10.1 Apply to Jobs
- [ ] Apply to job offer (requires login)
- [ ] Redirect to login if not authenticated
- [ ] Answer screening questions (if any)
- [ ] Answer multiple choice questions
- [ ] Answer open text questions
- [ ] Specify expected salary
- [ ] Submit application

#### 1.10.2 Application History
- [ ] View all my applications
- [ ] View application status (New/Reviewing/Selected/Rejected/etc.)
- [ ] View application date
- [ ] View associated job details
- [ ] View status change history

#### 1.10.3 Selection Response
- [ ] Receive selection notification email
- [ ] Access selection confirmation page via email link
- [ ] Accept job offer
- [ ] Reject job offer
- [ ] Add acceptance/rejection comment
- [ ] Confirmation date tracking

---

### 1.11 Direct Access Links

- [ ] Access account via email validation link
- [ ] Access specific application via email deep link (connector)
- [ ] Auto-login via secure connector URL

---

### 1.12 CV Generation

- [ ] Generate PDF CV from profile data
- [ ] Download generated CV

---

## 2. COMPANY USER (Empresa) Capabilities

### 2.1 Authentication & Account Management

#### 2.1.1 Company Registration
- [ ] Register new company with new user account
- [ ] Register new company with existing user account
- [ ] Company name validation (uniqueness)
- [ ] Company RUT validation
- [ ] Select company type
- [ ] Select industry
- [ ] Select location (country/region/comuna)
- [ ] Enter company address
- [ ] Enter company phone
- [ ] Receive registration pending email
- [ ] Company starts in "Pending" status awaiting approval

#### 2.1.2 Login & Session
- [ ] Login with email/password
- [ ] Validate company user access status
- [ ] Multi-company selection on login (if enabled)
- [ ] Session with company ID context
- [ ] Session role context (ADM/USR)

#### 2.1.3 Password Management
- [ ] Change password (current + new + confirm)
- [ ] Password recovery flow

#### 2.1.4 Email Management
- [ ] Change email address
- [ ] Email format validation
- [ ] Email uniqueness validation

#### 2.1.5 Account Management
- [ ] Close account with reason
- [ ] Account closure deletes company (if admin)
- [ ] Logout

---

### 2.2 Company Profile Management

#### 2.2.1 Company Information
- [ ] Edit company name
- [ ] Edit company RUT
- [ ] Edit company type
- [ ] Edit industry
- [ ] Edit location (country/region/comuna)
- [ ] Edit address
- [ ] Edit phone number with prefix

#### 2.2.2 Company Branding
- [ ] Upload company logo
- [ ] Upload billboard/banner image
- [ ] Validate image types
- [ ] Validate image sizes

#### 2.2.3 Company Description
- [ ] Edit company description
- [ ] Edit mission and vision
- [ ] Edit employee benefits

#### 2.2.4 Social Media
- [ ] Add/edit Facebook URL
- [ ] Add/edit Twitter URL
- [ ] Add/edit LinkedIn URL
- [ ] Add/edit Instagram URL
- [ ] Add/edit YouTube URL

#### 2.2.5 Profile Completeness
- [ ] Check information completeness status
- [ ] View completion status per section

---

### 2.3 User Management (Admin Role Only)

#### 2.3.1 View Users
- [ ] View list of company users
- [ ] View user name and email
- [ ] View user role (ADM/USR)

#### 2.3.2 Invite Users
- [ ] Validate email for new user
- [ ] Create new user account for invitation
- [ ] Invite existing platform user
- [ ] Send invitation email with credentials
- [ ] Set role on invitation

#### 2.3.3 Manage Roles
- [ ] Promote user to administrator (ADM)
- [ ] Demote administrator to user (USR)
- [ ] Require at least one administrator
- [ ] Update multiple roles at once

#### 2.3.4 Remove Users
- [ ] Remove user from company
- [ ] Validate user association before removal

---

### 2.4 Job Offer Management

#### 2.4.1 Create Job Offers
- [ ] Create employment offer
- [ ] Create internship offer
- [ ] Create practice offer
- [ ] Set job title
- [ ] Set job description (rich text)
- [ ] Set work area
- [ ] Set position type/level
- [ ] Set experience requirements
- [ ] Set education level requirements
- [ ] Add required careers (multiple)
- [ ] Add required universities (multiple)
- [ ] Add required languages (multiple)
- [ ] Add required skills (multiple)
- [ ] Set salary range (min/max)
- [ ] Toggle salary visibility
- [ ] Set work schedule (Full-time/Part-time/Flexible/Other)
- [ ] Set remote work option
- [ ] Set location (country/region/comuna)
- [ ] Add additional regions
- [ ] Set number of vacancies
- [ ] Set offer duration (days)
- [ ] Set application deadline
- [ ] Set minimum screening question score
- [ ] Toggle confidential company name
- [ ] Set accessibility features
- [ ] Add inclusion/disability details

#### 2.4.2 Screening Questions
- [ ] Add screening questions to offer
- [ ] Create text questions
- [ ] Create multiple choice questions
- [ ] Add answer options
- [ ] Set question as required
- [ ] Edit questions
- [ ] Delete questions
- [ ] Reorder questions

#### 2.4.3 Manage Job Offers
- [ ] View pending offers
- [ ] View active offers
- [ ] View finalized offers
- [ ] Edit existing offers
- [ ] Publish offer
- [ ] Pause offer
- [ ] Republish expired offer
- [ ] Finalize/close offer
- [ ] Delete offer

#### 2.4.4 Offer Statistics
- [ ] View offer visit count
- [ ] View application count
- [ ] Track offer view dates

---

### 2.5 Applicant Management

#### 2.5.1 View Applicants
- [ ] View applicants per job offer
- [ ] View applicant name
- [ ] View applicant email
- [ ] View application date
- [ ] View current status
- [ ] View match score (if available)
- [ ] Mark applicant as viewed

#### 2.5.2 Filter Applicants
- [ ] Filter by application status
- [ ] Filter by date range
- [ ] Filter by experience
- [ ] Filter by education
- [ ] Filter by region
- [ ] Filter by gender

#### 2.5.3 Applicant Profile
- [ ] View full applicant profile
- [ ] View applicant education
- [ ] View applicant experience
- [ ] View applicant skills
- [ ] View applicant languages
- [ ] View applicant social links
- [ ] View disability/inclusion info
- [ ] Download applicant CV
- [ ] View applicant portfolio

#### 2.5.4 Application Management
- [ ] Change application status
  - [ ] New (N)
  - [ ] Reviewing (EN)
  - [ ] Selected (SE)
  - [ ] Discarded (D)
  - [ ] Interested (I)
  - [ ] Hired (E)
- [ ] Add comment on application
- [ ] View status change history
- [ ] Send selection notification email
- [ ] Track applicant response

#### 2.5.5 Export
- [ ] Export applicants to Excel

---

### 2.6 Dashboard & Analytics

- [ ] View company dashboard
- [ ] View total offers published (current month)
- [ ] View total offers published (current year)
- [ ] View total offers published (all time)
- [ ] View total visits
- [ ] View total applicants
- [ ] Filter metrics by time range (Month/Year/Total)

---

### 2.7 Automatic Responses

- [ ] Configure automatic response emails
- [ ] Set sender name
- [ ] Set reply-to address
- [ ] Set email subject
- [ ] Set email body template
- [ ] Enable/disable automatic responses

---

### 2.8 Multi-Company Support

- [ ] Access multi-company selector (if enabled)
- [ ] Switch between associated companies
- [ ] Maintain role per company
- [ ] Primary company designation

---

### 2.9 API Access

- [ ] View API credentials
- [ ] Manage API origin access

---

## 3. OMIL USER (Government Intermediary) Capabilities

### 3.1 Authentication & Account

#### 3.1.1 OMIL Registration
- [ ] Register new OMIL organization
- [ ] OMIL name validation (uniqueness)
- [ ] OMIL RUT validation (uniqueness)
- [ ] Select location (country/region/comuna)
- [ ] Enter address
- [ ] Enter phone number
- [ ] Receive registration pending email
- [ ] OMIL starts in "Pending" status

#### 3.1.2 Login & Session
- [ ] Login with email/password
- [ ] Validate OMIL access status
- [ ] Validate user access flag
- [ ] Reject login for inactive OMIL
- [ ] Session with OMIL ID context

#### 3.1.3 Account Management
- [ ] Change password
- [ ] Change email
- [ ] Close account

---

### 3.2 Organization Profile

- [ ] Edit organization name
- [ ] Edit RUT
- [ ] Edit location (country/region/comuna)
- [ ] Edit address
- [ ] Edit phone number
- [ ] Upload organization logo

---

### 3.3 Job Seeker Management

#### 3.3.1 View Job Seekers
- [ ] View list of registered job seekers (linked to OMIL)
- [ ] View job seeker profile summary
- [ ] View job seeker contact info
- [ ] View job seeker education
- [ ] View job seeker experience
- [ ] View job seeker disability info

#### 3.3.2 Add Job Seekers
- [ ] Add new job seeker to OMIL
- [ ] Create job seeker account
- [ ] Link job seeker to OMIL (idomil reference)
- [ ] Send welcome email to job seeker

#### 3.3.3 Manage Job Seekers
- [ ] Edit job seeker information
- [ ] Connect as job seeker (impersonate)
- [ ] View job seeker profile completeness
- [ ] Download job seeker CV

#### 3.3.4 Export
- [ ] Export job seekers to Excel

---

### 3.4 Application Tracking

#### 3.4.1 View Applications
- [ ] View all applications from managed job seekers
- [ ] View application status
- [ ] View associated job offer
- [ ] View application date
- [ ] View status change history

#### 3.4.2 Filter Applications
- [ ] Filter by date range
- [ ] Filter by status
- [ ] Filter by job seeker

#### 3.4.3 Follow-up
- [ ] Add follow-up comments on applications
- [ ] Update application tracking notes
- [ ] Mark applications for follow-up

---

### 3.5 User Management (Admin Role)

- [ ] View OMIL users
- [ ] Add new OMIL user
- [ ] Set user role (ADM/USR)
- [ ] Remove user from OMIL

---

### 3.6 Dashboard & Reporting

- [ ] View OMIL dashboard
- [ ] View registered job seekers count
- [ ] View applications count
- [ ] View placement statistics
- [ ] Generate reports
- [ ] Export reports to Excel

---

## 4. ADMIN USER (Platform Administrator) Capabilities

### 4.1 Authentication

- [ ] Login to admin panel
- [ ] Separate admin login portal
- [ ] Admin session management

---

### 4.2 User (Job Seeker) Management

#### 4.2.1 View Users
- [ ] View all job seekers
- [ ] Search job seekers by name
- [ ] Search job seekers by email
- [ ] Search job seekers by RUT
- [ ] Filter by registration date
- [ ] Filter by status
- [ ] Filter by region
- [ ] Filter by disability status

#### 4.2.2 User Details
- [ ] View full user profile
- [ ] View user applications history
- [ ] View user education
- [ ] View user experience
- [ ] View user skills

#### 4.2.3 User Actions
- [ ] Connect as user (impersonate)
- [ ] Download user CV
- [ ] Export users to Excel
- [ ] Activate/deactivate user account

---

### 4.3 Company Management

#### 4.3.1 View Companies
- [ ] View all companies
- [ ] Search companies by name
- [ ] Search companies by RUT
- [ ] Filter by status (Active/Pending/Inactive)
- [ ] Filter by industry
- [ ] Filter by region
- [ ] Filter by registration date

#### 4.3.2 Company Approval
- [ ] Approve pending company
- [ ] Reject pending company
- [ ] Send approval notification email
- [ ] Set company as preferred/featured

#### 4.3.3 Company Details
- [ ] View company profile
- [ ] View company users
- [ ] View company job offers
- [ ] View company statistics

#### 4.3.4 Company Actions
- [ ] Edit company information
- [ ] Connect as company (impersonate)
- [ ] View company history
- [ ] Enable/disable candidate search feature
- [ ] Enable/disable multi-company feature
- [ ] Manage multi-company relationships

---

### 4.4 OMIL Management

#### 4.4.1 View OMILs
- [ ] View all OMIL organizations
- [ ] Search by name
- [ ] Search by RUT
- [ ] Filter by status
- [ ] Filter by region

#### 4.4.2 OMIL Approval
- [ ] Approve pending OMIL
- [ ] Reject pending OMIL
- [ ] Send approval notification email

#### 4.4.3 OMIL Actions
- [ ] Edit OMIL information
- [ ] Connect as OMIL user (impersonate)
- [ ] View OMIL users
- [ ] View OMIL job seekers

---

### 4.5 Job Offer Management

#### 4.5.1 View Offers
- [ ] View all job offers
- [ ] Search offers by title
- [ ] Search by company
- [ ] Filter by status (Active/Pending/Finalized/Rejected)
- [ ] Filter by job type
- [ ] Filter by region
- [ ] Filter by date range

#### 4.5.2 Offer Approval
- [ ] Approve pending offer
- [ ] Reject pending offer with reason
- [ ] Send approval notification to company

#### 4.5.3 Offer Actions
- [ ] Edit offer information
- [ ] Add skills/requirements to offer
- [ ] Change offer status
- [ ] View offer statistics
- [ ] View offer applicants

---

### 4.6 Reporting & Analytics

#### 4.6.1 Dashboard
- [ ] View platform dashboard
- [ ] View total users count
- [ ] View total companies count
- [ ] View total offers count
- [ ] View total applications count
- [ ] View registrations trend
- [ ] View applications trend

#### 4.6.2 Reports Generation
- [ ] Generate user reports
- [ ] Generate company reports
- [ ] Generate OMIL reports
- [ ] Generate offer reports
- [ ] Generate application reports
- [ ] Generate salary reports by career
- [ ] Generate salary reports by industry
- [ ] Generate placement/follow-up reports

#### 4.6.3 Export
- [ ] Export reports to Excel
- [ ] Filter reports by date range
- [ ] Filter reports by region
- [ ] Year-over-year comparison

---

### 4.7 Reference Data Management

#### 4.7.1 Geographic Data
- [ ] Manage countries
- [ ] Manage regions
- [ ] Manage comunas/municipalities

#### 4.7.2 Career & Education
- [ ] Manage careers catalog (~248 entries)
- [ ] Manage universities/institutions
- [ ] Manage education levels

#### 4.7.3 Work Data
- [ ] Manage industries (~20 entries)
- [ ] Manage work areas (~29 entries)
- [ ] Manage position types
- [ ] Manage experience levels

#### 4.7.4 Skills & Languages
- [ ] Manage skills catalog (~78 entries)
- [ ] Manage skill categories (~7 entries)
- [ ] Manage languages (~40 entries)

---

### 4.8 System Configuration

#### 4.8.1 Email Configuration
- [ ] Configure email templates
- [ ] Configure email sender settings

#### 4.8.2 Site Configuration
- [ ] Configure portal settings
- [ ] Manage site templates
- [ ] Configure color schemes

---

### 4.9 Virtual Fair/Expo Management

- [ ] Configure expo settings
- [ ] Configure salon layouts
- [ ] Configure company booth positions
- [ ] Upload expo assets
- [ ] Manage fair mode toggle

---

## 5. SYSTEM/AUTOMATED Capabilities

### 5.1 Batch Processing (Cron Jobs)

- [ ] Process offer visit statistics (p_visitas)
- [ ] Process user-job matching scores (p_match)
- [ ] Clean temporary files (p_clean_tmp)
- [ ] Finalize expired offers (p_ofertas)
- [ ] Process surveys (p_encuestas)
- [ ] Process job suggestions (p_sugerencias)
- [ ] User migration notifications (notificar_m)
- [ ] User migration processing (usuarios_m)

---

### 5.2 Email Notifications

#### 5.2.1 Registration Emails
- [ ] Job seeker welcome email
- [ ] Company registration pending email
- [ ] Company approval email
- [ ] OMIL registration pending email
- [ ] OMIL approval email
- [ ] Company user invitation email

#### 5.2.2 Account Emails
- [ ] Password recovery email
- [ ] Password changed confirmation email
- [ ] Email changed notification

#### 5.2.3 Application Emails
- [ ] Application received confirmation (to applicant)
- [ ] Application received notification (to company, if auto-response enabled)
- [ ] Status change notification
- [ ] Selection notification (invitation to confirm)

#### 5.2.4 System Emails
- [ ] Job suggestion emails
- [ ] Profile completion reminders

---

### 5.3 Security & Validation

- [ ] CSRF token generation and validation
- [ ] Password hashing (bcrypt)
- [ ] Email format validation
- [ ] RUT format validation
- [ ] File type validation
- [ ] File size validation
- [ ] Session timeout (5 hours)
- [ ] Secure connector links (cryptographic tokens)

---

### 5.4 Fair/Expo Mode

- [ ] Toggle fair mode (IS_FERIA)
- [ ] Fair-specific email templates
- [ ] Coming soon page display
- [ ] Pre-registration mode
- [ ] Fair start/end date handling
- [ ] Fair countdown display

---

## Appendix A: Status Codes Reference

### User Account Status (estado_cuenta)
| Code | Description |
|------|-------------|
| AC | Active |
| P | Pending |
| I | Inactive |
| R | Rejected |

### Application Status
| Code | Description |
|------|-------------|
| N | New |
| EN | Reviewing/In Process |
| SE | Selected |
| D | Discarded |
| I | Interested |
| E | Hired/Accepted |

### Job Offer Status (estado)
| Code | Description |
|------|-------------|
| T | Active/Published |
| P | Pending Approval |
| R | Rejected |
| A | Archived/Finalized |

### User Roles
| Code | Description |
|------|-------------|
| ADM | Administrator |
| USR | User (limited access) |

---

## Appendix B: File Locations Reference

| Feature | Laravel Controller |
|---------|-------------------|
| Auth/Registration | IndexController.php |
| Job Seeker Profile | CuentaController.php |
| Company Management | EmpresaController.php |
| Job Offers | OfertaController.php |
| Public Jobs | OfertasLaboralesController.php |
| OMIL | OmilController.php |
| Admin | AdminController.php |
| Reports | ReportesController.php |
| Cron Jobs | CronController.php |
| Fair/Expo | SitiosController.php, ExpoController.php |

---

## Validation Checklist Usage

### During Development
1. Mark capabilities as implemented: `[x]`
2. Mark capabilities as partially implemented: `[~]`
3. Mark capabilities as not applicable: `[-]`
4. Add notes for deferred items: `[!] Note: ...`

### During Testing
1. Run Playwright tests for each vertical
2. Manual verification of edge cases
3. Cross-reference with original system behavior

### Sign-off
- [ ] Job Seeker capabilities validated
- [ ] Company capabilities validated
- [ ] OMIL capabilities validated
- [ ] Admin capabilities validated
- [ ] System capabilities validated
- [ ] **MIGRATION COMPLETE**
