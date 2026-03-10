// controllers/seller/onboardingApiController.js
const User = require("../../models/User");
const SellerProfile = require("../../models/SellerProfile");
const SellerKyc = require("../../models/SellerKyc");
const { validatePAN } = require("../../services/kyc/panService");
const { validateGSTIN } = require("../../services/kyc/gstService");
const { verifyBank } = require("../../services/kyc/bankService");
const bcrypt = require("bcryptjs");

// =================== SIGNUP ===================
// POST: /api/seller/signup
exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "Email already registered." });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "seller",
      verificationStatus: "PENDING"
    });

    await user.save();
    res.status(201).json({ message: "Signup successful", userId: user._id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Signup error" });
  }
};

// =================== BASIC INFO ===================
// GET: /api/seller/basic-info
exports.getBasicInfo = async (req, res) => {
  try {
    const profile = await SellerProfile.findOne({ user: req.user._id });
    res.json({ profile });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch basic info" });
  }
};

// POST: /api/seller/basic-info
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

    res.json({ message: "Basic info saved successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error saving basic info" });
  }
};

// =================== TAX & BANK ===================
// GET: /api/seller/tax-bank
exports.getTaxBank = async (req, res) => {
  try {
    const kyc = await SellerKyc.findOne({ user: req.user._id });
    res.json({ kyc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch KYC info" });
  }
};

// POST: /api/seller/tax-bank
exports.postTaxBank = async (req, res) => {
  try {
    const { pan, gstin, bankAccountNumber, bankIfsc, bankAccountName } = req.body;

    let kyc = await SellerKyc.findOne({ user: req.user._id });
    if (!kyc) kyc = new SellerKyc({ user: req.user._id, fetched: {} });

    // PAN
    const panResult = await validatePAN(pan);
    if (!panResult.ok) return res.status(400).json({ error: "PAN validation failed", reason: panResult.reason });
    kyc.pan = pan.toUpperCase();
    kyc.fetched.panName = panResult.panName;
    kyc.taxStatus = "UNDER_REVIEW";

    // GSTIN
    const gstResult = await validateGSTIN(gstin);
    if (!gstResult.ok) return res.status(400).json({ error: "GST validation failed", reason: gstResult.reason });
    kyc.gstin = gstin.toUpperCase();
    kyc.fetched.gstBusinessName = gstResult.businessName;
    kyc.fetched.gstAddress = gstResult.address;

    // Bank
    const bankResult = await verifyBank({ account: bankAccountNumber, ifsc: bankIfsc, name: bankAccountName });
    if (!bankResult.ok) return res.status(400).json({ error: "Bank verification failed", reason: bankResult.reason });
    kyc.bankAccountNumber = bankAccountNumber;
    kyc.bankIfsc = bankIfsc.toUpperCase();
    kyc.bankAccountName = bankAccountName;
    kyc.bankStatus = "UNDER_REVIEW";

    await kyc.save();

    res.json({ message: "Tax & bank info saved successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error saving tax/bank info" });
  }
};

// =================== DOCUMENT UPLOAD ===================
// POST: /api/seller/documents
exports.postDocuments = async (req, res) => {
  try {
    const kyc = await SellerKyc.findOne({ user: req.user._id });
    if (!kyc) return res.status(400).json({ error: "KYC not found. Complete previous steps first." });

    const { govIdType } = req.body;
    kyc.govIdType = govIdType;

    if (req.files?.govIdFile?.[0]) kyc.govIdFile = "/uploads/" + req.files.govIdFile[0].filename;
    if (req.files?.businessProofFile?.[0]) kyc.businessProofFile = "/uploads/" + req.files.businessProofFile[0].filename;
    if (req.files?.addressProofFile?.[0]) kyc.addressProofFile = "/uploads/" + req.files.addressProofFile[0].filename;
    if (req.files?.msmeOrShopLicense?.[0]) kyc.msmeOrShopLicense = "/uploads/" + req.files.msmeOrShopLicense[0].filename;

    kyc.documentStatus = "UNDER_REVIEW";
    await kyc.save();

    await User.updateOne({ _id: req.user._id }, { verificationStatus: "UNDER_REVIEW" });

    res.json({ message: "Documents uploaded successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error uploading documents" });
  }
};

// =================== REVIEW ===================
// GET: /api/seller/review
exports.getReview = async (req, res) => {
  try {
    const user = req.user;
    const profile = await SellerProfile.findOne({ user: user._id });
    const kyc = await SellerKyc.findOne({ user: user._id });
    res.json({ user, profile, kyc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error fetching review info" });
  }
};

