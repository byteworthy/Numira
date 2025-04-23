const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const ConversationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  title: {
    type: String,
    default: 'New Conversation'
  },
  persona: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'persona',
    required: true
  },
  messages: [MessageSchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Update lastUpdated timestamp when messages are added
ConversationSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.lastUpdated = Date.now();
  }
  next();
});

module.exports = mongoose.model('conversation', ConversationSchema);
