const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  preferences: {
    theme: {
      type: String,
      default: 'light'
    },
    defaultPersona: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'persona'
    },
    notificationsEnabled: {
      type: Boolean,
      default: true
    }
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('user', UserSchema);
