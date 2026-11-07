const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  clientId: { type: String, unique: true, sparse: true },
  table: String,
  items: [
    {
      name: String,
      price: Number
    }
  ],
  total: Number,
  method: String,
  date: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('Bill', billSchema);
