use once_cell::sync::Lazy;
use regex::Regex;

/// Regex pattern for valid company sizes
/// Valid values: '1-10', '11-50', '51-200', '201-500', '500+'
pub static COMPANY_SIZE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(1-10|11-50|51-200|201-500|500\+)$")
        .expect("Failed to compile COMPANY_SIZE_REGEX")
});
