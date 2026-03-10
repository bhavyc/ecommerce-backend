// controllers/seller/digiLockerController.js
const axios = require("axios");
const SellerProfile = require("../../models/SellerProfile");
const User = require("../../models/User");

// ENV VARIABLES (Inko .env file mein daalein)
const CLIENT_ID = process.env.DIGILOCKER_CLIENT_ID;
const CLIENT_SECRET = process.env.DIGILOCKER_CLIENT_SECRET;
const REDIRECT_URI = process.env.DIGILOCKER_REDIRECT_URI; // e.g., http://localhost:3000/seller/kyc/digilocker/callback
//implementing digilocker in 
// 1. Redirect Seller to DigiLocker
exports.initiateDigiLocker = (req, res) => {
  // State generate karein security ke liye
  const state = Buffer.from(req.user._id.toString()).toString('base64'); // User ID ko pass kar rahe hain reference ke liye
  
  const authUrl = `https://api.digitallocker.gov.in/public/oauth2/1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}`;
  
  res.redirect(authUrl);
};

// 2. Handle Callback from DigiLocker
exports.handleCallback = async (req, res) => {
  const { code, state } = req.query;

  if (!code) return res.status(400).send("Authorization failed");

  try {
    // A. Exchange Code for Access Token
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

    // B. Get User Profile (To get Aadhaar Data if available in scope)
    // Note: Usually DigiLocker requires fetching specific files. 
    // For simplicity, we assume we fetch the "Issued Documents" list or specific Aadhaar file.
    
    const userResponse = await axios.get("https://api.digitallocker.gov.in/public/oauth2/1/user", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    // NOTE: DigiLocker API structure varies based on permissions. 
    // Often you fetch "issued documents" to find Aadhaar.
    const filesResponse = await axios.get("https://api.digitallocker.gov.in/public/oauth2/2/files/issued", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    // C. Find Aadhaar in files
    const aadhaarFile = filesResponse.data.items.find(item => item.name.toLowerCase().includes("aadhaar"));

    if (!aadhaarFile) {
        return res.status(400).send("Aadhaar card not found in your DigiLocker. Please issue it first in DigiLocker app.");
    }

    // D. Update Database
    // Decode user ID from state or use session if maintained
    const userId = Buffer.from(state, 'base64').toString('ascii');

    await SellerProfile.findOneAndUpdate(
        { seller: userId },
        {
            $set: {
                "digiLockerData.isAadhaarVerified": true,
                "digiLockerData.aadhaarName": userResponse.data.name, // or from aadhaar XML
                "digiLockerData.digiLockerId": userResponse.data.digilockerid,
                "digiLockerData.verifiedAt": new Date(),
                kycStatus: "PARTIAL" // Partial kyunki Admin ko abhi bhi approve karna hai
            }
        }
    );

    // E. Redirect back to success page
    res.redirect("/seller/onboarding/review?status=digilocker_success");

  } catch (error) {
    console.error("DigiLocker Error:", error.response ? error.response.data : error.message);
    res.status(500).send("Verification Failed. Please try again.");
  }
};