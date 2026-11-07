require('dotenv').config();
const BILL_RETENTION_TIMEZONE = process.env.BILL_RETENTION_TIMEZONE || 'Europe/Berlin';
process.env.TZ = BILL_RETENTION_TIMEZONE;

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const Order = require('./Order');
const DeletedItem = require('./DeletedItem');
const app = express();
const Bill = require('./Bill');

// Middleware to handle CORS and JSON parsing
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

const deletePreviousDaysBills = async () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const result = await Bill.deleteMany({ date: { $lt: startOfToday } });
  console.log(`Deleted ${result.deletedCount} bills from previous days`);
};

cron.schedule('0 0 * * *', () => {
  deletePreviousDaysBills().catch((error) => {
    console.error('Daily bill cleanup failed:', error);
  });
}, { timezone: BILL_RETENTION_TIMEZONE });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    deletePreviousDaysBills().catch((error) => {
      console.error('Initial bill cleanup failed:', error);
    });
  })
  .catch(err => console.error("MongoDB error:", err));

// POST /api/orders - save all table orders

app.post('/api/orders', async (req, res) => {
  try {
    const { table, orders } = req.body;

    if (!table || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Invalid format. Expecting {table, orders}' });
    }

    const normalizedOrders = orders.map((item) => ({
      name: item.name,
      price: item.price,
      note: item.note || "",
    }));

    console.log("Updating table:", table);

    const updated = await Order.findOneAndUpdate(
      { table },
      { orders: normalizedOrders },
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
    const { clientId } = req.body;

    if (!table || !Array.isArray(items) || items.length === 0 ||
      !items.every((item) => item.name && Number.isFinite(Number(item.price))) ||
      !Number.isFinite(Number(total)) || !method) {
      return res.status(400).json({ error: 'Invalid bill payload.' });
    }

    const billData = { table, items, total: Number(total), method, date };
    const savedBill = clientId
      ? await Bill.findOneAndUpdate(
        { clientId },
        { $setOnInsert: { ...billData, clientId } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      )
      : await new Bill(billData).save();

    res.status(200).json(savedBill);
  } catch (error) {
    console.error("Error saving bill:", error);
    res.status(500).json({ error: 'Failed to save bill' });
  }
});

app.get('/api/bills', async (req, res) => {
  try {
    const bills = await Bill.find().sort({ date: -1 }).lean();
    res.status(200).json(bills);
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

app.post('/api/deleted-items', async (req, res) => {
  try {
    const { table, name, price, deletedAt } = req.body;

    if (!table || !name || typeof price !== 'number') {
      return res.status(400).json({ error: 'Invalid deleted item payload.' });
    }

    const newDeletedItem = new DeletedItem({ table, name, price, deletedAt });
    const savedDeletedItem = await newDeletedItem.save();
    res.status(201).json(savedDeletedItem);
  } catch (error) {
    console.error('Error saving deleted item:', error);
    res.status(500).json({ error: 'Failed to save deleted item.' });
  }
});

app.get('/api/deleted-items', async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const deletedItems = await DeletedItem.find({ deletedAt: { $gte: startOfToday } }).sort({ deletedAt: -1 });
    res.status(200).json(deletedItems);
  } catch (error) {
    console.error('Error fetching deleted items:', error);
    res.status(500).json({ error: 'Failed to fetch deleted items.' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});