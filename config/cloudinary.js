const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cloudinary Connect Karo
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage Engine Banao
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fruit-app-uploads', // Cloudinary par is folder naam se save hoga
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

module.exports = { storage };