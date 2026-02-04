// V1 Handlers: Infrastructure & Reference Data
pub mod health;
pub mod reference;

pub use health::*;
pub use reference::*;

// V2 Handlers: Authentication
pub mod auth;

// V3 Handlers: Job Seeker Profiles
pub mod profile;

// V4+ Handlers (to be implemented)
// pub mod company;
// pub mod applications;
// pub mod jobs;
