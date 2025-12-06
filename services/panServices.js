// services/kyc/panService.js
module.exports.validatePAN = async (pan) => {
  // PAN actual format: 10 alphanumeric
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(pan).toUpperCase())) {
    return { ok: false, reason: "Invalid PAN format" };
  }
  // mock success
  return { ok: true, panName: "Mock PAN Holder" };
};
