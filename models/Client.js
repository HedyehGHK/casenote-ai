const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  age: {
    type: Number,
    required: true
  },

  presentingIssue: {
    type: String,
    required: true
  },

  therapistId: {
    type: String,
    default: null
  },

  notes: {
    type: Array,
    default: []
  },

  analysis: {
    type: Object,
    default: null
  },

  geminiAnalysis: {
    type: Object,
    default: null
  }

}, {
  timestamps: true
});

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;