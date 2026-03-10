// routes/seller/onboarding.js
const express = require("express");
const router = express.Router();
const { authMiddleware, sellerMiddleware } = require("../../middleware/seller/authMiddleware");
const ctrl = require("../../controllers/seller/onboardingController");

// Multer for uploads
const multer = require("multer");
const path = require("path");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.cwd(), "uploads")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `kyc-${req.user._id}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Sign up (public)
router.get("/signup", ctrl.getSignup);
router.post("/signup", ctrl.postSignup);

// After login (you already log sellers in), all below are protected:
router.get("/basic-info", authMiddleware, sellerMiddleware, ctrl.getBasicInfo);
router.post("/basic-info", authMiddleware, sellerMiddleware, ctrl.postBasicInfo);

router.get("/tax-bank", authMiddleware, sellerMiddleware, ctrl.getTaxBank);
router.post("/tax-bank", authMiddleware, sellerMiddleware, ctrl.postTaxBank);

router.get("/documents", authMiddleware, sellerMiddleware, ctrl.getDocuments);
router.post("/documents",
  authMiddleware, sellerMiddleware,
  upload.fields([
    { name: "govIdFile", maxCount: 1 },
    { name: "businessProofFile", maxCount: 1 },
    { name: "addressProofFile", maxCount: 1 },
    { name: "msmeOrShopLicense", maxCount: 1 },
  ]),
  ctrl.postDocuments
);

router.get("/review", authMiddleware, sellerMiddleware, ctrl.getReview);

module.exports = router;
