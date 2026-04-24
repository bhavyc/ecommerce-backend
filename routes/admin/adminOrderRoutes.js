const express = require("express");
const router = express.Router();
const adminOrderController = require("../../controllers/admin/adminOrderController");
const adminEarningsController = require("../../controllers/admin/adminEarningController");
router.get("/", adminOrderController.renderOrderPage); //   
router.get("/data", adminOrderController.getOrderData); //  
router.get("/earnings", adminEarningsController.renderEarningPage);
router.get("/earnings/chart-data", adminEarningsController.getEarningData);


router.post("/force-deliver" , adminOrderController.adminForceDeliver);
router.post("/force-refund",   adminOrderController.adminForceRefund);
module.exports = router;
