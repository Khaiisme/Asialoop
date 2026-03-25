const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  table: String,          // match the 'table' key from frontend (string)
  orders: [               // match the 'orders' key from frontend
    {
      name: String,
      price: Number
    }
  ]
});

module.exports = mongoose.model('Order', orderSchema);

