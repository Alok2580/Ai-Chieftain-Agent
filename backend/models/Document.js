const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: {
    type: String,
    enum: ["MENU", "PHONE_EXTENSIONS", "GUIDE", "OTHER"],
    default: "OTHER",
  },
  filePath: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  contentText: { type: String },
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Document", documentSchema);
