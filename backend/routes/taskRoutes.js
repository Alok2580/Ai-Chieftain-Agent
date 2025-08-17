const express = require("express");
const router = express.Router();
const Task = require("../models/Task");

router.post("/", async (req, res) => {
  try {
    const task = new Task(req.body || {});
    await task.save();
    const io = req.app.get("socketio");
    io.emit("new_task", task);
    res.json(task);
  } catch (err) {
    console.error("Failed to create task", err);
    res.status(500).json({ message: "Failed to create task" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updates = req.body || {};
    const updated = await Task.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!updated) return res.status(404).json({ message: "Task not found" });
    const io = req.app.get("socketio");
    io.emit("task_status_updated", updated);
    if (updated.socketId && updates.status) {
      const userMessage =
        updates.status === "Approved"
          ? "Your request has been approved and is being processed."
          : updates.status === "Declined"
          ? "We are sorry, your request was declined. Please contact the front desk for assistance."
          : `Task status updated: ${updates.status}`;
      io.to(updated.socketId).emit("task_response", { text: userMessage });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update task" });
  }
});

module.exports = router;

