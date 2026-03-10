const express=require("express");
const router=express.Router();
const normalDealController=require("../../controllers/admin/normalDealController");

router.get("/", normalDealController.listNormalDeals);
router.get("/create", normalDealController.showCreateNormalDeal);
router.post("/", normalDealController.createNormalDeal);

module.exports=router;
