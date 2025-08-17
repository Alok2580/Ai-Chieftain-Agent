const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema({
  category: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  available: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
});

menuItemSchema.index({ name: 1, category: 1 }, { unique: true });

menuItemSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("MenuItem", menuItemSchema);
