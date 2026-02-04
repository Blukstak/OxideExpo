-- V1 Migration: Create PostgreSQL Extensions
-- EmpleosInclusivos Infrastructure

-- UUID generation for all primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigram similarity for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Accent-insensitive search (important for Spanish)
CREATE EXTENSION IF NOT EXISTS "unaccent";
