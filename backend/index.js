import express from 'express';
import cors from 'cors';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflyeztyiwgpginhvmuk.supabase.co';
const supabaseKey = 'sb_publishable_agsPcqilP09Nxf_SKM4ETg_LfnzGXJ4';
const supabase = createClient(supabaseUrl, supabaseKey);

function getNextWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const currentMonday = new Date(d.setDate(diff));
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    return nextMonday.toISOString().split('T')[0];
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Backend is running',
        endpoints: ['/api/availability', '/webapp-data']
    });
});

const BOT_TOKEN = '8854559282:AAFwPAD4gQLNMDFihLBF6lATZmsbIiiYQuA';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const APP_URL = 'https://weekwork-app.vercel.app';

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Hello, ${msg.from.first_name}`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Open app', web_app: { url: APP_URL } }]
            ]
        }
    });
});

app.post('/api/availability', async (req, res) => {
    console.log('Request received:', req.body);

    try {
        const { telegram_id, first_name, days, desc } = req.body;

        if (!telegram_id || !days) {
            console.log('Missing data');
            return res.status(400).json({ error: "Missing data" });
        }

        console.log('Looking for user with telegram_id:', telegram_id);

        let { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegram_id)
            .single();

        if (userError || !user) {
            console.log('User not found, creating new one...');

            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    telegram_id: telegram_id,
                    name: first_name || 'User',
                    role: 'worker'
                })
                .select('id')
                .single();

            if (createError) {
                console.error('Error creating user:', createError);
                return res.status(500).json({ error: 'Error creating user: ' + createError.message });
            }

            user = newUser;
            console.log('User created with name:', first_name);
        } else {
            console.log('User found:', user);

            if (first_name && user.name !== first_name) {
                console.log('Updating user name:', first_name);
                await supabase
                    .from('users')
                    .update({ name: first_name })
                    .eq('id', user.id);
            }
        }

        const weekStart = getNextWeekStart();
        console.log('Saving for week:', weekStart);

        const { error } = await supabase
            .from('weekly_availability')
            .upsert({
                worker_id: user.id,
                week_start: weekStart,
                days: days,
                description: desc || ''
            }, {
                onConflict: 'worker_id, week_start'
            });

        if (error) {
            console.error('Error saving to weekly_availability:', error);
            return res.status(500).json({ error: 'Error saving: ' + error.message });
        }

        console.log('Data saved successfully');
        res.json({
            success: true,
            message: 'Data saved',
            week_start: weekStart
        });

    } catch (err) {
        console.error('Critical error:', err);
        res.status(500).json({ error: 'Internal server error: ' + err.message });
    }
});

app.post('/webapp-data', (req, res) => {
    console.log('Data from app:', req.body);
    res.json({ ok: true });
});

app.listen(3000, () => {
    console.log('Backend running on http://localhost:3000');
});