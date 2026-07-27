import express from 'express';
import cors from 'cors';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. ПОДКЛЮЧЕНИЕ К SUPABASE
// ==========================================

const supabaseUrl = 'https://uflyeztyiwgpginhvmuk.supabase.co'
const supabaseKey = 'sb_publishable_agsPcqilP09Nxf_SKM4ETg_LfnzGXJ4'
const supabase = createClient(supabaseUrl, supabaseKey)

// ==========================================
// 2. ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: следующая неделя
// ==========================================

function getNextWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const currentMonday = new Date(d.setDate(diff));
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    return nextMonday.toISOString().split('T')[0]
}

// ==========================================
// 3. НАСТРОЙКА EXPRESS
// ==========================================

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 4. КОРНЕВОЙ МАРШРУТ (для проверки)
// ==========================================

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Бэкенд работает!',
        endpoints: ['/api/availability', '/webapp-data']
    });
});

// ==========================================
// 5. TELEGRAM БОТ
// ==========================================

const BOT_TOKEN = '8854559282:AAFwPAD4gQLNMDFihLBF6lATZmsbIiiYQuA';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const APP_URL = 'https://weekwork-app.vercel.app';

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Привет, ${msg.from.first_name} 👋`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🚀 Открыть приложение', web_app: { url: APP_URL } }]
            ]
        }
    });
});

// ==========================================
// 6. ЭНДПОИНТ ДЛЯ СОХРАНЕНИЯ ВЫБОРА РАБОТНИКА
// ==========================================

app.post('/api/availability', async (req, res) => {
    console.log('📥 Получен запрос:', req.body);
    
    try {
        const { telegram_id, days, desc } = req.body;

        // Проверяем, что данные пришли
        if (!telegram_id || !days) {
            console.log('❌ Не хватает данных');
            return res.status(400).json({ error: "Не хватает данных" });
        }

        // 1. Ищем пользователя в таблице users
        console.log('🔍 Ищем пользователя с telegram_id:', telegram_id);
        
        let { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegram_id)
            .single();

        // Если пользователь не найден — создаём нового
        if (userError || !user) {
            console.log('👤 Пользователь не найден, создаём нового...');
            
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    telegram_id: telegram_id,
                    name: 'Пользователь',
                    role: 'worker'
                })
                .select('id')
                .single();

            if (createError) {
                console.error('❌ Ошибка создания пользователя:', createError);
                return res.status(500).json({ error: 'Ошибка создания пользователя: ' + createError.message });
            }

            user = newUser;
            console.log('✅ Пользователь создан:', user);
        } else {
            console.log('✅ Пользователь найден:', user);
        }

        // 2. Определяем начало следующей недели
        const weekStart = getNextWeekStart();
        console.log('📅 Сохраняем для недели:', weekStart);

        // 3. Сохраняем выбор дней в weekly_availability
        const { data, error } = await supabase
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
            console.error('❌ Ошибка сохранения в weekly_availability:', error);
            return res.status(500).json({ error: 'Ошибка сохранения: ' + error.message });
        }

        console.log('✅ Данные сохранены успешно!');
        res.json({
            success: true,
            message: 'Данные сохранены!',
            week_start: weekStart
        });

    } catch (err) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + err.message });
    }
});

// ==========================================
// 7. ЭНДПОИНТ ДЛЯ ПРИЁМА ДАННЫХ ИЗ MINI APP
// ==========================================

app.post('/webapp-data', (req, res) => {
    console.log('📩 Данные от приложения:', req.body);
    res.json({ ok: true });
});

// ==========================================
// 8. ЗАПУСК СЕРВЕРА
// ==========================================

app.listen(3000, () => {
    console.log('✅ Бэкенд запущен на http://localhost:3000');
});