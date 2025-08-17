const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const http = require("http"); // Import http
const { Server } = require("socket.io"); // Import Server from socket.io
const cookieParser = require("cookie-parser");
const { authMiddleware } = require("./middleware/auth");

dotenv.config();
connectDB();

const app = express();

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.IO and attach it to the server
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://info-chieftain.vercel.app"], // Allow both local and production URLs
    methods: ["GET", "POST"],
  },
});

// Make io accessible to our routes
app.set("socketio", io);

io.on("connection", (socket) => {
  console.log("A user connected to Socket.IO");
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

app.use(
  cors({
    origin: ["http://localhost:3000", "https://info-chieftain.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(authMiddleware);
// Serve uploaded documents
app.use("/uploads", express.static(require("path").join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API is running successfully!");
});

app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/profiles", require("./routes/profileRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/documents", require("./routes/documentRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/menu", require("./routes/menuRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));

const PORT = process.env.PORT || 5001;

// Seed default menu items on startup
async function seedDefaultMenu() {
  try {
    const MenuItem = require("./models/MenuItem");
    const existingItems = await MenuItem.find().countDocuments();
    if (existingItems === 0) {
      console.log("Seeding default menu items...");
      const defaults = [
        { category: "Tea", name: "Hibiscus Tea", price: 6 },
        { category: "Tea", name: "English Breakfast", price: 6 },
        { category: "Tea", name: "Masala Chai", price: 6 },
        { category: "Coffee", name: "Espresso", price: 6 },
        { category: "Coffee", name: "Cappuccino", price: 7 },
        { category: "Coffee", name: "Latte", price: 7 },
        { category: "Food", name: "Truffle Parmesan Fries", price: 11 },
        { category: "Food", name: "Fries", price: 6 },
        { category: "Cold Drinks", name: "Coke", price: 3 },
        { category: "Cold Drinks", name: "Sprite", price: 3 },
        { category: "Mocktails", name: "Virgin Mojito", price: 11 },
        { category: "Mocktails", name: "Passion Mojito", price: 15 },
        { category: "Beers", name: "Heineken", price: 6 },
        { category: "Beers", name: "Corona Extra", price: 6 },
      ];
      for (const item of defaults) {
        await MenuItem.findOneAndUpdate(
          { name: item.name, category: item.category },
          item,
          { upsert: true, new: true }
        );
      }
      console.log("Default menu items seeded successfully!");
    }
  } catch (error) {
    console.error("Error seeding menu items:", error);
  }
}

// Listen on the http server, not the Express app
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await seedDefaultMenu();
});
