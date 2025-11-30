import { minioService } from '../src/services/minio.service.js';
import { db } from '../src/db/index.js';

async function testFolderListing() {
    try {
        console.log('=== Testing MinIO Folder Listing ===\n');

        // Get first active bucket
        const buckets = await db.query('SELECT * FROM minio_buckets WHERE is_active = 1 LIMIT 1');

        if (buckets.length === 0) {
            console.log('No active buckets found');
            return;
        }

        const bucket = buckets[0];
        console.log(`Testing with bucket: ${bucket.bucket_name} (${bucket.display_name})\n`);

        // Test listing root
        console.log('--- Listing Root Directory (prefix="") ---');
        const rootObjects = await minioService.listObjects(bucket.bucket_name, '', false);
        console.log(`Found ${rootObjects.length} objects:`);
        rootObjects.forEach(obj => {
            console.log(`  ${obj.isFolder ? '📁' : '📄'} ${obj.name} ${obj.isFolder ? '(folder)' : `(${obj.size} bytes)`}`);
        });

        // Test with a specific prefix if there are folders
        const folders = rootObjects.filter(obj => obj.isFolder);
        if (folders.length > 0) {
            const firstFolder = folders[0];
            console.log(`\n--- Listing Inside Folder: ${firstFolder.name} ---`);
            const folderObjects = await minioService.listObjects(
                bucket.bucket_name,
                firstFolder.prefix || (firstFolder.name + '/'),
                false
            );
            console.log(`Found ${folderObjects.length} objects:`);
            folderObjects.forEach(obj => {
                console.log(`  ${obj.isFolder ? '📁' : '📄'} ${obj.name} ${obj.isFolder ? '(folder)' : `(${obj.size} bytes)`}`);
            });
        }

        // Test raw MinIO listing
        console.log('\n--- Raw MinIO Objects (for debugging) ---');
        const client = (minioService as any).ensureClient();
        const stream = client.listObjectsV2(bucket.bucket_name, '', false);

        let count = 0;
        for await (const obj of stream) {
            count++;
            console.log(`  Raw object: ${obj.name} (size: ${obj.size}, prefix: ${obj.prefix || 'none'})`);
            if (count >= 10) {
                console.log('  ... (showing first 10 only)');
                break;
            }
        }

        console.log('\n=== Test Complete ===');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testFolderListing();
