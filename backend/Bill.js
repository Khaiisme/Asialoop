const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  table: String,
  items: [
    {
      name: String,
      price: Number
    }
  ],
  total: Number,
  method: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bill', billSchema);
