// V1: Reference Data Models
pub mod reference;

pub use reference::*;

// V2: User & Authentication Models
pub mod user;

// V3: Job Seeker Profile Models
pub mod profile;

// V4: Company Profile Models
pub mod company;

// V5: Job Postings & Applications Models
pub mod job;
pub mod application;

// V6: Admin Dashboard Models
pub mod admin;

// V7: Matching and Recommendations Models
pub mod matching;

// V8: OMIL Integration & Messaging Models
pub mod omil;

// V9: Enhanced Applicant Management, Saved Jobs, File Uploads
pub mod applicant;
pub mod saved_job;
pub mod file;
