// services/kyc/gstService.js
module.exports.validateGSTIN = async (gstin) => {
  if (!/^[0-9A-Z]{15}$/.test(String(gstin).toUpperCase())) {
    return { ok: false, reason: "Invalid GSTIN format" };
  }
  // mock success
  return { ok: true, businessName: "Mock GST Business", address: "Mock GST Address" };
};
