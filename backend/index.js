import express from 'express';
import cors from 'cors';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflyeztyiwgpginhvmuk.supabase.co'
const supabaseKey = 'sb_publishable_agsPcqilP09Nxf_SKM4ETg_LfnzGXJ4'
const supabase = createClient(supabaseUrl, supabaseKey)

function getNextWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const currentMonday = new Date(d.setDate(diff));
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    return nextMonday.toISOString().split('T')[0]
}

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

app.post('/api/availability', async (req, res) => {
    try {
        const { telegram_id, days, desc } = req.body;

        if (!telegram_id || !days) {
            return res.status(400).json({ error: "Не хватает данных" });
        }

        const { data: user, error: userError } = await supabase.from('users').select('id').eq('telegram_id', telegram_id).single();

        if (userError || !user) {
            return res.status(404).json({ error: 'Пользователь не неайден'});
        }

        const weekStart = getNextWeekStart();

        const { data, error } = await supabase.from('weekly_availability').upsert({
            worker_id: user.id,
            week_start: weekStart,
            days: days,
            description: desc || ''
        }, {
            onConflict: 'worker_id, week_start'
        });

        if (error) {
            console.error('Ошибка сохранения:', error);
            return res.status(500).json({ error: 'Ошибка сохранения' });
        }

        res.json({
            success: true,
            message: 'Данные сохранениы!',
            week_start: weekStart
        });
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});


app.post('/webapp-data', (req, res) => {
    console.log('Данные от приложения: ', req.body);

    res.json({ok: true});
});


app.listen(3000, () => {
    console.log('Бэк заработааал урааа и запущен на http://localhost:3000');
});