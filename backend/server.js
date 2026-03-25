const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Order = require('./Order');
const app = express();
const Note = require('./Note');
const Bill = require('./Bill');

// Middleware to handle CORS and JSON parsing
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
require('dotenv').config();
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

// POST /api/orders - save all table orders

app.post('/api/orders', async (req, res) => {
  try {
    const { table, orders } = req.body;

    if (!table || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Invalid format. Expecting {table, orders}' });
    }

    console.log("Updating table:", table);

    const updated = await Order.findOneAndUpdate(
      { table },       // match by table
      { orders },      // update the orders for that table
      { new: true, upsert: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error saving order:", error);
    res.status(500).json({ error: 'Failed to save order' });
  }
});
// GET /api/orders - fetch all orders
app.get('/api/orders', async ( req , res) => {
  try {
    const allOrders = await Order.find();
    res.status(200).json(allOrders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// --- BILLS ROUTES ---
app.post('/api/bills', async (req, res) => {
  try {
    const { table, items, total, method, date } = req.body;
    const newBill = new Bill({ table, items, total, method, date });
    const savedBill = await newBill.save();
    res.status(201).json(savedBill);
  } catch (error) {
    console.error("Error saving bill:", error);
    res.status(500).json({ error: 'Failed to save bill' });
  }
});

app.get('/api/bills', async (req, res) => {
  try {
    // 🕒 Get start of today (Midnight in server timezone)
    // If your store closes exactly at midnight, this is perfect.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 🧹 Auto-Delete all bills older than today!
    // This achieves your exact goal: automatically clearing history and resetting every new day.
    await Bill.deleteMany({ date: { $lt: startOfToday } });

    // Fetch the remaining bills (which are guaranteed to be only from today)
    const bills = await Bill.find().sort({ date: -1 }); // newest first
    res.status(200).json(bills);
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

app.post('/api/notes', async (req, res) => {
  try {
    const { tableName, note } = req.body;

    const savedNote = await Note.findOneAndUpdate(
      { tableName },
      { note },
      { new: true, upsert: true }  // create if doesn't exist
    );

    res.status(201).json({
      message: 'Note saved/updated successfully.',
      note: savedNote
    });
  } catch (error) {
    console.error("Error saving note:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


app.get("/api/notes", async (req, res) => {
  try {
    const notes = await Note.find();
    res.status(200).json(notes);
  } catch (error) {
    console.error("Error fetching notes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/notes/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;

    const note = await Note.findOne({ tableName });

    res.status(200).json(note || { tableName, note: "" });
  } catch (error) {
    console.error("Error fetching note:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});