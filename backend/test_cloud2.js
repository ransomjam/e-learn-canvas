require("dotenv").config();
const cloudinary = require("cloudinary").v2;
cloudinary.config({
    cloud_name: 'dzqj2x8b',
    api_key: '123',
    api_secret: '456',
    secure: true
});

const url = cloudinary.utils.private_download_url("cradema/files/UBaTech_Camp_Training_Timetable_tz1grz.pdf", "", {
    resource_type: "raw",
    type: "upload"
});
console.log(url);
