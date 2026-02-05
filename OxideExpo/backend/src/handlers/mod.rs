// V1 Handlers: Infrastructure & Reference Data
pub mod health;
pub mod reference;

pub use health::*;
pub use reference::*;

// V2 Handlers: Authentication
pub mod auth;

// V3 Handlers: Job Seeker Profiles
pub mod profile;

// V4 Handlers: Company Profiles
pub mod company;

// V5 Handlers: Job Postings & Applications
pub mod jobs;
pub mod applications;

// V6 Handlers: Admin Dashboard
pub mod admin;

// V7 Handlers: Matching and Recommendations
pub mod matching;

// V8 Handlers: OMIL Integration & Messaging
pub mod omil;
pub mod invitations;

// V9 Handlers: Enhanced Applicant Management, Saved Jobs, File Uploads
pub mod applicants;
pub mod saved_jobs;
pub mod files;
