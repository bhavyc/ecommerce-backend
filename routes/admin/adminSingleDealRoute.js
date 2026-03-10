const express = require("express");
const router = express.Router();
const adminsingleController = require("../../controllers/admin/singledealController");

 

router.get("/", adminsingleController.showDynamicCreateForm);
router.post("/createFromNewDeal", adminsingleController.createFromNewDealDynamic);


module.exports = router;
