const mongoose = require('mongoose');

const deletedItemSchema = new mongoose.Schema({
  table: String,
  name: String,
  price: Number,
  deletedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeletedItem', deletedItemSchema);
