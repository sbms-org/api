import multer from 'multer';

// Use memory storage to handle scalable uploads to Cloudinary via buffers
// Avoid saving files locally to disk for security and scalability.
const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
