const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  table: String,
  orders: [
    {
      name: String,
      price: Number,
      orderIndex: Number
    }
  ]
});

module.exports = mongoose.model('Order', orderSchema);

