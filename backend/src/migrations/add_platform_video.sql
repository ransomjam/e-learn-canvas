-- Migration: Add platform_video table for homepage promotional video
-- Run this script against your database

CREATE TABLE IF NOT EXISTS platform_video (
    id SERIAL PRIMARY KEY,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    title VARCHAR(255) NOT NULL DEFAULT 'How to Use Our Platform',
    description TEXT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Only one video record should exist at a time (id = 1 is the singleton)
-- Insert a placeholder row so GET always returns something
-- (will be updated by the admin upload)
-- No initial INSERT needed; admin will create it via upload.
