const Question = require("../../models/Questions");

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
    const { productId } = req.params;
    const { question } = req.body;
    const userId = req.user._id; // From Auth Middleware

    // Validation
    if (!question || question.trim() === "") {
      return res.status(400).json({ success: false, message: "Question cannot be empty" });
    }

    const newQuestion = await Question.create({
      product: productId,
      user: userId,
      question
    });

    // Populate user details immediately so frontend can append it to the list without refresh
    await newQuestion.populate("user", "name");

    res.status(201).json({
      success: true,
      message: "Question posted successfully",
      data: newQuestion
    });

  } catch (err) {
    console.error("Error asking question:", err);
    res.status(500).json({ success: false, message: "Error asking question" });
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