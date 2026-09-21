import TelegramBot from 'node-telegram-bot-api';

export const BOT_TOKEN = '8854559282:AAFU_3etP-Y_m5IERAulk4RnKYh7DuOfbT8';
export const bot = new TelegramBot(BOT_TOKEN, { polling: true });
export const APP_URL = 'https://weekwork-app.vercel.app';