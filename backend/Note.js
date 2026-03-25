const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  tableName: {
    type: String,
    required: true,
    unique: true   // IMPORTANT
  },
  note: {
    type: String,
    default: ""
  }
});

module.exports = mongoose.model("Note", noteSchema);