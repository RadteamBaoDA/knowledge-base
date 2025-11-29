export interface MinioBucket {
    id: string;
    bucket_name: string;
    display_name: string;
    description?: string;
    created_by: string;
    created_at: string;
    is_active: boolean;
}

export interface CreateMinioBucketDto {
    bucket_name: string;
    display_name: string;
    description?: string;
}
