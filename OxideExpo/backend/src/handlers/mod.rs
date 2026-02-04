// V1 Handlers: Infrastructure & Reference Data
pub mod health;
pub mod reference;

pub use health::*;
pub use reference::*;

// V2 Handlers: Authentication
pub mod auth;

// V3+ Handlers (to be implemented)
// pub mod applications;
// pub mod jobs;
