const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const FormData = require('form-data'); // Import FormData
const app = express();
const cors = require('cors');
const { Parser } = require('json2csv');
require('dotenv').config()
app.use(express.json());
app.use(cors());
const fs = require('fs');
const path = require('path');

// Connect to MongoDB
mongoose.connect(process.env.DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.log(err));

// Define a schema
const DataSchema = new mongoose.Schema({
  username: String,
  is18Checked: Boolean,
  privacyChecked: Boolean,
  ID: String
});

// Create a model
const Data = mongoose.model('Data', DataSchema);

function getEmojiChecked(isChecked) {
  return isChecked ? '✅' : '❌';
}

app.post('/webhook', async (req, res) => {
  const jsonData = req.body;

  // Save data to MongoDB
  const data = new Data(jsonData);
  await data.save();

  const telegramBotToken = process.env.TOKEN;
  const chatId = process.env.CHAT_ID;
  const templateMessage = `*Пришел новый ответ!*\n\n❓От кого: *${jsonData.username}*\n\n🤷 Будет: ${getEmojiChecked(jsonData.is18Checked)}\n\n🚗 Нужен ли транспорт: ${getEmojiChecked(jsonData.privacyChecked)}\n\n💻 ID: *${jsonData.ID}*`;

  axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    chat_id: chatId,
    text: templateMessage,
    parse_mode: 'Markdown'
  })
      .catch(error => {
        console.error('Error sending message to Telegram bot:', error);
      });

  res.status(200).end();
});

app.post('/export', async (req, res) => {
  const chatId = req.body.chatId;

  // Fetch all data from MongoDB
  const fieldMapping = {
    username: 'Имя',
    is18Checked: 'Будет',
    privacyChecked: 'Нужен ли транспорт',
    ID: 'ID'
  };

// Fetch all data from MongoDB
  const data = await Data.find({});

// Convert the data to the new field names
  const convertedData = data.map(item => {
    return {
      'Имя': item.username,
      'Будет': item.is18Checked,
      'Нужен ли транспорт': item.privacyChecked,
      'ID': item.ID
    };
  });

// Convert JSON to CSV
  const json2csvParser = new Parser({ fields: Object.values(fieldMapping) });
  const csv = json2csvParser.parse(convertedData);

  // Write CSV to a file
// Get current date and time
  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, '-');

// Write CSV to a file
  const filePath = path.join(__dirname, `data-${timestamp}.csv`);
  fs.writeFileSync(filePath, '\ufeff' + csv);


  const telegramBotToken = process.env.TOKEN;

  // Send CSV data to Telegram bot
  const form_data = new FormData();
  form_data.append('chat_id', chatId);
  form_data.append('document', fs.createReadStream(filePath));

  await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendDocument`, form_data, {
    headers: {
      ...form_data.getHeaders()
    }
  });

  // Delete the file after sending
  fs.unlinkSync(filePath);

  res.status(200).end();
});


app.listen(3000, (err) => {
  if (err) {
    return console.error('Error starting server:', err);
  }
  console.log('Webhook server is listening, port 3000');
});
