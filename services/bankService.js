// services/kyc/bankService.js
module.exports.verifyBank = async ({ account, ifsc, name }) => {
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(ifsc).toUpperCase())) {
    return { ok: false, reason: "Invalid IFSC format" };
  }
  if (!account) return { ok: false, reason: "Missing account number" };
  // mock match
  return { ok: true, matchedName: name || "Mock Account Holder" };
};
