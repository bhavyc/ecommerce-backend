const express = require("express");
const router = express.Router();
const sellerAuthController = require("../../controllers/seller/sellerAuthController");
const digilockerController = require("../../controllers/seller/digilockerController");
const { onboardingMiddleware } = require("../../middleware/seller/authMiddleware");
// ===== GET ROUTES =====
// Render registration form


//  YEH ADD KARO: Cloudinary setup
const multer = require("multer");
const {storage} = require("../../config/cloudinary"); // Path check kar lena sahi hai na
const upload = multer({ storage: storage });

router.get("/register", (req, res) => {
  res.render("seller/register"); // views/seller/register.ejs
});

    



router.get("/under-review", sellerAuthController.underReview);
// Render login form
router.get("/login", (req, res) => {
  res.render("seller/login"); // views/seller/login.ejs
});
                                                                   


// ===== POST ROUTES =====
// Seller registration
router.post("/register", 
  upload.fields([
    { name: "panDoc", maxCount: 1 },
    { name: "gstDoc", maxCount: 1 },
    { name: "bankDoc", maxCount: 1 }
  ]), 
  sellerAuthController.register
);

// Seller login
router.post("/login", sellerAuthController.login);

// Seller logout
router.get("/logout", sellerAuthController.logout);





// Start Verification
// router.get("/kyc/digilocker/init", onboardingMiddleware, digilockerController.initiateDigiLocker);

// Callback URL (Yeh URL DigiLocker Dashboard mein Whitelist hona chahiye)
// router.get("/kyc/digilocker/callback", digilockerController.handleCallback);



// ===== FORGOT PASSWORD ROUTES =====

// 1. Forgot password page dikhane ke liye
router.get("/forgot-password", sellerAuthController.renderForgotPassword);

// 2. Email submit karne par link bhejne ke liye
router.post("/forgot-password", sellerAuthController.processForgotPassword);

// 3. Email ke link par click karne ke baad naya password dalne ka page
router.get("/reset-password/:token", sellerAuthController.renderResetPassword);

// 4. Naya password save karne ke liye
router.post("/reset-password/:token", sellerAuthController.processResetPassword);

module.exports = router;