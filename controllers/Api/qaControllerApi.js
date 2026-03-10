const Question = require("../../models/Questions");
const Product = require("../../models/Product");
const NormalDeal = require("../../models/NormalDeal");
const Drop = require("../../models/FruitDrop");
                                                          
// ---------------- GET Q&A FOR A PRODUCT ----------------
                          
exports.getQA = async (req, res) => {
  try {
    const { productId } = req.params;

    const qas = await Question.find({ product: productId })
      .populate("user", "name")           // Only show name, NOT email (Privacy)
      .populate("answers.user", "name")   // Only show name for answerers
      .sort({ createdAt: -1 });           // Newest questions first

    // Always return success, even if list is empty
    res.status(200).json({
      success: true,
      count: qas.length,
      data: qas
    });

  } catch (err) {
    console.error("Error fetching Q&A:", err);
    res.status(500).json({ success: false, message: "Error fetching Q&A", error: err.message });
  }
};

// ---------------- ASK QUESTION ----------------

exports.askQuestion = async (req, res) => {
  try {
    let { productId } = req.params;
    const { question } = req.body;

    // 1. Check if the ID provided is actually a Product ID
    let product = await Product.findById(productId);

    // 2. If not a Product, check if it's a Deal or Drop ID
    if (!product) {
      const deal = await NormalDeal.findById(productId);
      if (deal) productId = deal.product;
      
      const drop = await Drop.findById(productId);
      if (drop) productId = drop.product;
    }

    // 3. Final validation
    if (!productId) {
      return res.status(400).json({ success: false, message: "Could not link question to a valid product" });
    }

    const newQuestion = await Question.create({
      product: productId,
      user: req.user._id,
      question: question.trim()
    });

    await newQuestion.populate("user", "name");
    res.status(201).json({ success: true, data: newQuestion });

  } catch (err) {
    console.error("QA Error Terminal:", err.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
// ---------------- ANSWER QUESTION ----------------
exports.answerQuestion = async (req, res) => {
  try {
    // We only need questionId to find the document
    const { questionId } = req.params; 
    const { answer } = req.body;
    const userId = req.user._id;

    if (!answer || answer.trim() === "") {
      return res.status(400).json({ success: false, message: "Answer cannot be empty" });
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      questionId,
      {
        $push: { 
          answers: { 
            user: userId, 
            answer: answer,
            createdAt: new Date() // Ensure timestamp is recorded
          } 
        }
      },
      { new: true } // Return the updated document
    )
    .populate("user", "name")
    .populate("answers.user", "name");

    if (!updatedQuestion) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    res.status(200).json({
      success: true,
      message: "Answer added successfully",
      data: updatedQuestion
    });

  } catch (err) {
    console.error("Error answering question:", err);
    res.status(500).json({ success: false, message: "Error answering question" });
  }
};