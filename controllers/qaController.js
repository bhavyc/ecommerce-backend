const Question = require("../models/Questions");

// ---------------- GET Q&A FOR A PRODUCT ----------------
exports.getQA = async (req, res) => {
  try {
    const {productId} = req.params;

    const qas = await Question.find({ product: productId })
      .populate("user", "name email")           // populate user info
      .populate("answers.user", "name email"); // populate answer authors

    // If API request, return JSON
    if (req.query.api === "true") {
      return res.json({ success: true, qas });
    }

    // Render EJS view
    res.render("questions/qa", { qas, productId });
  } catch (err) {
    console.error("Error fetching Q&A:", err);
    res.status(500).send("Error fetching Q&A");
  }
};


// ---------------- ASK QUESTION ----------------
exports.askQuestion = async (req, res) => {
  try {
    const { productId } = req.params;
    const { question } = req.body;

    if (!question || question.trim() === "") {
      return res.status(400).send("Question cannot be empty");
    }

    const newQuestion = await Question.create({
      product: productId,
      user: req.user._id,
      question
    });

    if (req.query.api === "true") {
      return res.status(201).json({ success: true, question: newQuestion });
    }

    res.redirect(`/qa/${productId}`);
  } catch (err) {
    console.error("Error asking question:", err);
    res.status(500).send("Error asking question");
  }
};


// ---------------- ANSWER QUESTION ----------------
exports.answerQuestion = async (req, res) => {
  try {
    const { productId, questionId } = req.params;
    const { answer } = req.body;

    if (!answer || answer.trim() === "") {
      return res.status(400).send("Answer cannot be empty");
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      questionId,
      {
        $push: { answers: { user: req.user._id, answer } }
      },
      { new: true }
    );

    if (!updatedQuestion) return res.status(404).send("Question not found");

    if (req.query.api === "true") {
      return res.json({ success: true, question: updatedQuestion });
    }

    res.redirect(`/qa/${productId}`);
  } catch (err) {
    console.error("Error answering question:", err);
    res.status(500).send("Error answering question");
  }
};
