import TelegramBot from 'node-telegram-bot-api';

export const BOT_TOKEN = '8854559282:AAFwPAD4gQLNMDFihLBF6lATZmsbIiiYQuA';
export const bot = new TelegramBot(BOT_TOKEN, { polling: true });
export const APP_URL = 'https://weekwork-app.vercel.app';