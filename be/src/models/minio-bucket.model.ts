/**
 * @fileoverview MinIO bucket model definitions.
 * 
 * This module defines TypeScript interfaces for MinIO bucket
 * data transfer between the database and API endpoints.
 * 
 * @module models/minio-bucket
 */

/**
 * Represents a MinIO bucket record from the database.
 * Contains both MinIO configuration and application metadata.
 */
export interface MinioBucket {
    /** Unique identifier (UUID) */
    id: string;
    /** MinIO bucket name (must follow S3 naming conventions) */
    bucket_name: string;
    /** Human-readable display name for UI */
    display_name: string;
    /** Optional description of bucket purpose */
    description?: string;
    /** User ID who created this bucket */
    created_by: string;
    /** Creation timestamp (ISO string) */
    created_at: string;
    /** Whether bucket is active (soft delete flag) */
    is_active: boolean;
}

/**
 * Data transfer object for creating a new MinIO bucket.
 * Used as request body type for POST /api/minio/buckets.
 */
export interface CreateMinioBucketDto {
    /** MinIO bucket name (3-63 chars, lowercase, alphanumeric/hyphens/dots) */
    bucket_name: string;
    /** Human-readable display name */
    display_name: string;
    /** Optional description */
    description?: string;
}
