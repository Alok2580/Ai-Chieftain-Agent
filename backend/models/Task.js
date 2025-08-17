const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      "BOOKING",
      "ROOM_SERVICE",
      "MAINTENANCE",
      "CONCIERGE",
      "TRANSPORT",
      "CHECKIN",
      "CHECKOUT",
    ],
    required: true,
  },
  details: { type: String, required: true },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Approved", "Declined", "Completed"],
    default: "Pending",
  },
  socketId: { type: String },
  relatedIds: {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RoomService" },
    guestProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GuestProfile",
    },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

taskSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Task", taskSchema);

