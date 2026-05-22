const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

// Import Routes
const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const restaurantRoutes = require("./routes/restaurants");
const tableRoutes = require("./routes/tables");
const authRoutes = require("./routes/auth");
const staffRoutes = require("./routes/staff");
const imageRoutes = require("./routes/images");

// Import Socket Handler
const { initOrderSocket } = require("./socket/orderSocket");

// Import Middleware
const { generalRateLimit } = require("./middleware/rateLimit");

const app = express();
const server = http.createServer(app);

// Socket.io setup
const allowedOrigins = process.env.CLIENT_ORIGINS
  ? process.env.CLIENT_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174',
     'http://localhost:5175', 'http://localhost:5176']

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))

// Middleware
app.use(express.json());
app.use(generalRateLimit);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/images", imageRoutes);

// Health check route
app.get("/", (req, res) => {
  res.json({ message: "Restaurant SaaS Backend is Running! 🍽️" });
});

// Initialize socket
initOrderSocket(io);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
