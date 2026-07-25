import express from 'express';
import cors from 'cors';
import TelegramBot from 'node-telegram-bot-api';

const app = express();

app.use(cors());

app.use(express.json());

const BOT_TOKEN  = '8854559282:AAFwPAD4gQLNMDFihLBF6lATZmsbIiiYQuA';

const bot = new TelegramBot(BOT_TOKEN, {polling: true});

const APP_URL = 'https://weekwork-app.vercel.app';

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, `Привет, ${msg.from.first_name}`, {
        reply_markup: {
            inline_keyboard: [
                [{text: 'Открыть приложение', web_app: { url: APP_URL } }]
            ]
        }
    });
});

app.post('/webapp-data', (req, res) => {
    console.log('Данные от приложения: ', req.body);

    res.json({ok: true});
});
app.listen(3000, () => {
    console.log('Бэк заработааал урааа и запущен на http://localhost:3000');
});