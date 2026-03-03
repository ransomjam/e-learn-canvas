require("dotenv").config();
const cloudinary = require("cloudinary").v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

const originalUrl = 'https://res.cloudinary.com/dgmp1r6ko/raw/upload/s--9W5IEg4y--/v1772554417/cradema/files/UBaTech_Camp_Training_Timetable_tz1grz.pdf';
const strippedUrl = originalUrl.replace(/\/s--[A-Za-z0-9_-]+--/, '');
const match = strippedUrl.match(/res\.cloudinary\.com\/([^/]+)\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)/);
const versionMatch = strippedUrl.match(/\/upload\/v(\d+)\//);
const version = versionMatch ? versionMatch[1] : undefined;

const [, , resourceType, publicIdWithExt] = match;

const signed = cloudinary.url(publicIdWithExt, {
    resource_type: resourceType,
    sign_url: true,
    type: 'upload',
    secure: true,
    ...(version ? { version } : {}),
    expires_at: Math.floor(Date.now() / 1000) + 31536000
});

console.log("Original: ", originalUrl);
console.log("Signed:   ", signed);
