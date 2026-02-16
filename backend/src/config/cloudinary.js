const cloudinary = require('cloudinary').v2;

// Only configure if env vars are present (allows fallback to local disk in dev)
const isConfigured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    console.log('☁️  Cloudinary configured (cloud:', process.env.CLOUDINARY_CLOUD_NAME + ')');
} else {
    console.log('⚠️  Cloudinary not configured — uploads will use local disk storage');
}

module.exports = { cloudinary, isConfigured };
