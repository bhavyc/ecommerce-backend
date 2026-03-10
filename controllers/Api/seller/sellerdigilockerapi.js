// controllers/seller/digiLockerController.js
const axios = require("axios");
const SellerProfile = require("../../models/SellerProfile");

const CLIENT_ID = process.env.DIGILOCKER_CLIENT_ID;
const CLIENT_SECRET = process.env.DIGILOCKER_CLIENT_SECRET;
const REDIRECT_URI = process.env.DIGILOCKER_REDIRECT_URI; 
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// 1. Return URL to Frontend (Frontend redirects window)
exports.initiateDigiLocker = (req, res) => {
  const state = Buffer.from(req.user._id.toString()).toString('base64');
  const authUrl = `https://api.digitallocker.gov.in/public/oauth2/1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}`;
  
  res.json({ success: true, authUrl });
};

// 2. Handle Callback (Browser redirect from DigiLocker hits this API)
exports.handleCallback = async (req, res) => {
  const { code, state } = req.query;

  if (!code) return res.redirect(`${FRONTEND_URL}/seller/kyc?status=failed`);

  try {
    // Exchange Code for Token
    const tokenResponse = await axios.post(
      "https://api.digitallocker.gov.in/public/oauth2/1/token",
      new URLSearchParams({
        code: code,
        grant_type:"authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;
    
    // Fetch User Data
    const userResponse = await axios.get("https://api.digitallocker.gov.in/public/oauth2/1/user", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    // Update DB (Decode User ID from state)
    const userId = Buffer.from(state, 'base64').toString('ascii');

    await SellerProfile.findOneAndUpdate(
        { seller: userId },
        {
            $set: {
                "digiLockerData.isAadhaarVerified": true,
                "digiLockerData.aadhaarName": userResponse.data.name,
                "digiLockerData.digiLockerId": userResponse.data.digilockerid,
                "digiLockerData.verifiedAt": new Date(),
                kycStatus: "PARTIAL"
            }
        }
    );

    // Redirect user back to Frontend Success Page
    res.redirect(`${FRONTEND_URL}/seller/onboarding/review?status=digilocker_success`);

  } catch (error) {
    console.error("DigiLocker Error:", error.message);
    res.redirect(`${FRONTEND_URL}/seller/onboarding?status=error`);
  }
};