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

function cleanPhoneNumber(phone) {
    return phone.replace(/\D/g, '');
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Бэкенд работает',
        endpoints: ['/api/availability', '/webapp-data']
    });
});

const BOT_TOKEN = '8854559282:AAFwPAD4gQLNMDFihLBF6lATZmsbIiiYQuA';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const APP_URL = 'https://weekwork-app.vercel.app';

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Нажмите кнопку, чтобы отправить номер телефона', {
        reply_markup: {
            keyboard: [
                [{ text: 'Отправить', request_contact: true }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (msg.contact) {
        const phoneNumber = cleanPhoneNumber(msg.contact.phone_number);
        console.log('Номер пользователя:', phoneNumber);

        const { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('id, telegram_id')
            .eq('phone_number', phoneNumber)
            .single();

        if (existingUser) {
            await supabase
                .from('users')
                .update({ telegram_id: telegramId })
                .eq('phone_number', phoneNumber);
        } else {
            await supabase
                .from('users')
                .insert({
                    telegram_id: telegramId,
                    phone_number: phoneNumber,
                    name: msg.from.first_name || 'Пользователь'
                });
        }

        await supabase
            .from('user_sessions')
            .upsert({
                user_id: telegramId,
                state: 'awaiting_role'
            });

        bot.sendMessage(chatId, 'Номер получен. Спасибо', {
            reply_markup: {
                remove_keyboard: true
            }
        });

        bot.sendMessage(chatId, 'Подскажите, кто вы: работник или работодатель?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Работник', callback_data: 'role_worker' }],
                    [{ text: 'Работодатель', callback_data: 'role_employer' }],
                ]
            }
        });
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const telegramId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data === 'role_worker') {
        const { data, error } = await supabase.from('users').update({ role: 'worker' }).eq('telegram_id', telegramId);
        if (error) {
            console.log('Ошибка обновления роли', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при сохранении роли');
        } else {
            await bot.sendMessage(chatId, 'Ты выбран как работник');
            await supabase.from('user_sessions').upsert({
                user_id: telegramId,
                state: 'awaiting_employer_phone'
            });

            await bot.sendMessage(chatId, 'Отправь номер телефона работодателя');
        }


    } else if (data === 'role_employer') {
        const { data, error } = await supabase.from('users').update({ role: 'employer' }).eq('telegram_id', telegramId);
        if (error) {
            console.log('Ошибка обновления роли', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при сохранении роли');
        } else {
            await bot.sendMessage(chatId, 'Ты выбран как работодатель');
            await supabase.from('user_sessions').upsert({
                user_id: telegramId,
                state: 'completed'
            });
            await bot.sendMessage(chatId, 'Добро пожаловать!', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Открыть приложение', web_app: { url: APP_URL } }]
                    ]
                }
            });
        }
    }

    await bot.answerCallbackQuery(callbackQuery.id);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text;

    if (!text) return;

    const { data, error } = await supabase.from('user_sessions').select('state').eq('user_id', telegramId).single();

    if (data && data.state === 'awaiting_employer_phone') {
        const phoneNumber = cleanPhoneNumber(text);
        const { data, error } = await supabase.from('users').select('id, name, phone_number').eq('phone_number', phoneNumber).eq('role', 'employer').single();

        if (data && data.name) {
            const { data, error } = await supabase.from('users').update({ employer_id: data.id }).eq('telegram_id', telegramId);

            await bot.sendMessage(chatId, 'Ты привязан к работодателю ' + data.name + '!');

            await supabase.from('user_sessions').upsert({
                user_id: telegramId,
                state: 'completed'
            });

            await bot.sendMessage(chatId, 'Регистрация успешно пройдена', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Открыть приложение', web_app: { url: APP_URL } }]
                    ]
                }
            });

        } else {
            console.log('Работодатель не найден', error);
            await bot.sendMessage(chatId, 'Работодатель с таким номером не найден. Попробуйте снова.');
        }

        console.log('Пользователь ждёт номер работодателя. Текст:', text);

    } else if (data && data.state === 'completed') {
        await bot.sendMessage(chatId, 'Добро пожаловать!', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Открыть приложение', web_app: { url: APP_URL } }]
                ]
            }
        });
        console.log('Регистрация завершена');

    } else {
        console.log('Неизвестное состояние:', data ? data.state : 'null');
    }
});

app.post('/api/availability', async (req, res) => {
    console.log('Запрос получен:', req.body);

    try {
        const { telegram_id, first_name, days, desc } = req.body;

        if (!telegram_id || !days) {
            console.log('Не хватает данных');
            return res.status(400).json({ error: "Не хватает данных" });
        }

        console.log('Поиск пользователя с telegram_id:', telegram_id);

        let { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegram_id)
            .single();

        if (userError || !user) {
            console.log('Пользователь не найден, создаём нового...');

            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    telegram_id: telegram_id,
                    name: first_name || 'Пользователь',
                    role: 'worker'
                })
                .select('id')
                .single();

            if (createError) {
                console.error('Ошибка создания пользователя:', createError);
                return res.status(500).json({ error: 'Ошибка создания пользователя: ' + createError.message });
            }

            user = newUser;
            console.log('Пользователь создан с именем:', first_name);
        } else {
            console.log('Пользователь найден:', user);

            if (first_name && user.name !== first_name) {
                console.log('Обновление имени пользователя:', first_name);
                await supabase
                    .from('users')
                    .update({ name: first_name })
                    .eq('id', user.id);
            }
        }

        const weekStart = getNextWeekStart();
        console.log('Сохранение для недели:', weekStart);

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
            console.error('Ошибка сохранения в weekly_availability:', error);
            return res.status(500).json({ error: 'Ошибка сохранения: ' + error.message });
        }

        console.log('Данные успешно сохранены');
        res.json({
            success: true,
            message: 'Данные сохранены',
            week_start: weekStart
        });

    } catch (err) {
        console.error('Критическая ошибка:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + err.message });
    }
});

app.post('/webapp-data', (req, res) => {
    console.log('Данные от приложения:', req.body);
    res.json({ ok: true });
});

app.listen(3000, () => {
    console.log('Бэкенд запущен на http://localhost:3000');
});