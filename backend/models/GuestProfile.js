const mongoose = require("mongoose");

const guestProfileSchema = new mongoose.Schema({
  socketId: { type: String, index: true },
  name: { type: String },
  email: { type: String },
  phone: { type: String },
  language: { type: String, default: "en" },
  // Use Mixed to allow flexible schema without cast errors on empty strings
  preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

guestProfileSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("GuestProfile", guestProfileSchema);
