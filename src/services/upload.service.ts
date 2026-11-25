import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import streamifier from 'streamifier';
import logger from '../configurations/logger';
import dotenv from 'dotenv';
dotenv.config();

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export class UploadService {
    /**
     * Uploads a file buffer efficiently to Cloudinary using streams.
     * This avoids writing files to disk (saving I/O and increasing API throughput).
     * @param buffer File buffer to upload
     * @param folder Cloudinary target folder
     * @returns Secure URL of the uploaded optimized file
     */
    static uploadBufferToCloudinary(buffer: Buffer, folder: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder, resource_type: 'auto' },
                (error, result: UploadApiResponse | undefined) => {
                    if (error) {
                        logger.error('Cloudinary upload error:', error);
                        return reject(error);
                    }
                    if (result && result.secure_url) {
                        // Optionally generate auto-optimized URLs 
                        // by changing the response to provide cloudinary.url transformations.
                        // Here we just return the secure URL string directly.
                        resolve(result.secure_url);
                    } else {
                        reject(new Error('Cloudinary upload returned null result'));
                    }
                }
            );

            // Pipe buffer stream to Cloudinary stream
            streamifier.createReadStream(buffer).pipe(uploadStream);
        });
    }

    /**
     * Helper to process multiple file buffers efficiently.
     * Use Promise.all() for concurrent execution to speed up file handling,
     * which scales well vs synchronous blocking. For massive scale,
     * implementations should wrap this inside a job queue (like Bull/BullMQ)
     * so it processes completely asynchronously via workers.
     * @param files Map/Array of file items
     * @returns Array/Map of resolved URLs
     */
    static async uploadMultipleFilesConcurrent(
        files: { buffer: Buffer; folder: string }[]
    ): Promise<string[]> {
        const uploadPromises = files.map((file) =>
            this.uploadBufferToCloudinary(file.buffer, file.folder)
        );
        return await Promise.all(uploadPromises);
    }
}