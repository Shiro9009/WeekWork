import TelegramBot from 'node-telegram-bot-api';

export const BOT_TOKEN = process.env.BOT_TOKEN;
export const bot = new TelegramBot(BOT_TOKEN, { polling: true });
export const APP_URL = process.env.APP_URL;