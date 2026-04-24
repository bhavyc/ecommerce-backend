// controllers/seller/onboardingController.js
const User = require("../../models/User");
const SellerProfile = require("../../models/SellerProfile");
const SellerKyc = require("../../models/SellerKyc");
const SellerDocument = require("../../models/SellerDocument"); 
// GET: Signup page (email, phone, password)
exports.getSignup = (req, res) => {
  res.render("seller/onboarding/signup");
};

// POST: Signup -> create user(role=seller), status=PENDING
exports.postSignup = async (req, res) => {
  const bcrypt = require("bcryptjs");
  try {
    const { name, email, phone, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).send("Email already registered.");

    const user = new User({ name, email, phone, password, role: "seller", verificationStatus: "PENDING" });
    await user.save();

    // No OTP now – just redirect to Basic Info
    res.redirect("/seller/onboarding/basic-info");
  } catch (e) {
    console.error(e);
    res.status(500).send("Signup error");
  }
};

// GET: Basic Info
exports.getBasicInfo = async (req, res) => {
  const profile = await SellerProfile.findOne({ user: req.user._id }) || {};
  res.render("seller/onboarding/basicInfo", { profile });
};

// POST: Basic Info -> create/update SellerProfile
exports.postBasicInfo = async (req, res) => {
  try {
    const { legalName, businessType, storeName, phone, line1, line2, city, state, pincode, country } = req.body;

    const payload = {
      user: req.user._id,
      legalName,
      businessType,
      storeName,
      phone,
      pickupAddress: { line1, line2, city, state, pincode, country }
    };

    const existing = await SellerProfile.findOne({ user: req.user._id });
    if (existing) {
      await SellerProfile.updateOne({ user: req.user._id }, payload);
    } else {
      await SellerProfile.create(payload);
    }

    // Move to Tax & Bank
    res.redirect("/seller/onboarding/tax-bank");
  } catch (e) {
    console.error(e);
    res.status(500).send("Error saving basic info");
  }
};

// GET: Tax & Bank
exports.getTaxBank = async (req, res) => {
  const kyc = await SellerKyc.findOne({ user: req.user._id }) || {};
  res.render("seller/onboarding/taxBank", { kyc });
};

// POST: Tax & Bank -> validate with services (mock/live)
exports.postTaxBank = async (req, res) => {
  try {
    const { pan, gstin, bankAccountNumber, bankIfsc, bankAccountName } = req.body;

    let kyc = await SellerKyc.findOne({ user: req.user._id });
    if (!kyc) kyc = new SellerKyc({ user: req.user._id });

    // PAN
    const panResult = await validatePAN(pan);
    if (!panResult.ok) return res.status(400).send("PAN validation failed: " + panResult.reason);
    kyc.pan = pan.toUpperCase();
    kyc.fetched.panName = panResult.panName;
    kyc.taxStatus = "UNDER_REVIEW";

    // GSTIN
    const gstResult = await validateGSTIN(gstin);
    if (!gstResult.ok) return res.status(400).send("GST validation failed: " + gstResult.reason);
    kyc.gstin = gstin.toUpperCase();
    kyc.fetched.gstBusinessName = gstResult.businessName;
    kyc.fetched.gstAddress = gstResult.address;

    // Bank
    const bankResult = await verifyBank({ account: bankAccountNumber, ifsc: bankIfsc, name: bankAccountName });
    if (!bankResult.ok) return res.status(400).send("Bank verification failed: " + bankResult.reason);
    kyc.bankAccountNumber = bankAccountNumber;
    kyc.bankIfsc = bankIfsc.toUpperCase();
    kyc.bankAccountName = bankAccountName;
    kyc.bankStatus = "UNDER_REVIEW";

    await kyc.save();

    // Next: Documents upload (no OCR)
    res.redirect("/seller/onboarding/documents");
  } catch (e) {
    console.error(e);
    res.status(500).send("Error saving tax/bank info");
  }
};

// GET: Document Upload
exports.getDocuments = async (req, res) => {
  const kyc = await SellerKyc.findOne({ user: req.user._id }) || {};
  res.render("seller/onboarding/documents", { kyc });
};

// POST: Document Upload (no OCR, just store file paths)
exports.postDocuments = async (req, res) => {
  try {
    const userId = req.user._id;
    const kyc = await SellerKyc.findOne({ user: userId });
    
    if (!kyc) return res.status(400).send("KYC not found. Complete previous steps first.");

    const { govIdType } = req.body;
    kyc.govIdType = govIdType;

    const filesToSave =[]; // Admin view ke liye data ikattha karenge

    // 🔥 Multer-Cloudinary me URL hamesha 'file.path' me aata hai
    if (req.files?.govIdFile?.[0]) {
      const fileUrl = req.files.govIdFile[0].path;
      kyc.govIdFile = fileUrl;
      filesToSave.push({ seller: userId, docType: govIdType || "Government ID", filePath: fileUrl });
    }
    
    if (req.files?.businessProofFile?.[0]) {
      const fileUrl = req.files.businessProofFile[0].path;
      kyc.businessProofFile = fileUrl;
      filesToSave.push({ seller: userId, docType: "Business Proof", filePath: fileUrl });
    }
    
    if (req.files?.addressProofFile?.[0]) {
      const fileUrl = req.files.addressProofFile[0].path;
      kyc.addressProofFile = fileUrl;
      filesToSave.push({ seller: userId, docType: "Address Proof", filePath: fileUrl });
    }
    
    if (req.files?.msmeOrShopLicense?.[0]) {
      const fileUrl = req.files.msmeOrShopLicense[0].path;
      kyc.msmeOrShopLicense = fileUrl;
      filesToSave.push({ seller: userId, docType: "MSME / Shop License", filePath: fileUrl });
    }

    // 🔥 SellerDocument Database me Save karein (Jo Admin Panel fetch kar raha hai)
    if (filesToSave.length > 0) {
      // Purane docs delete kar do agar user dobara upload kar raha hai
      await SellerDocument.deleteMany({ seller: userId });
      // Naye Cloudinary URL wale docs save karo
      await SellerDocument.insertMany(filesToSave);
    }

    // Mark docs for review
    kyc.documentStatus = "UNDER_REVIEW";
    await kyc.save();

    // Move user to UNDER_REVIEW globally
    await User.updateOne(
      { _id: userId },
      { verificationStatus: "UNDER_REVIEW" }
    );

    res.redirect("/seller/onboarding/review");
  } catch (e) {
    console.error("Document Upload Error:", e);
    res.status(500).send("Error uploading documents to Cloudinary");
  }
};

// GET: Review page (shows statuses)
exports.getReview = async (req, res) => {
  const user = req.user;
  const profile = await SellerProfile.findOne({ user: user._id });
  const kyc = await SellerKyc.findOne({ user: user._id });
  res.render("seller/onboarding/review", { user, profile, kyc });
};

exports.underReview = async (req, res) => {
  // Profile fetch karke bhejo taaki frontend pe check kar sakein
  const profile = await SellerProfile.findOne({ seller: req.user._id });
  res.render("seller/underReview", { user: req.user, profile });
};



 