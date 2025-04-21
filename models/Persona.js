const mongoose = require('mongoose');

const PersonaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  systemPrompt: {
    type: String,
    required: true
  },
  messageTemplate: {
    type: String,
    required: true
  },
  avatarUrl: {
    type: String,
    default: '/images/default-avatar.png'
  },
  style: {
    primaryColor: {
      type: String,
      default: '#4A90E2'
    },
    secondaryColor: {
      type: String,
      default: '#F5F8FF'
    },
    fontFamily: {
      type: String,
      default: 'Inter, sans-serif'
    }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('persona', PersonaSchema);
