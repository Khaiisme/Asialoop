const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  table: String,
  orders: [
    {
      name: String,
      price: Number,
      note: {
        type: String,
        default: ""
      }
    }
  ]
});

module.exports = mongoose.model('Order', orderSchema);

