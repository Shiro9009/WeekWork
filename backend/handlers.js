import { supabase } from './index.js';
import { bot, APP_URL } from './bot.js';
import { generateInviteCode } from './scheduler.js';

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const { data, error } = await supabase
        .from('user_sessions')
        .select('state')
        .eq('user_id', telegramId)
        .single();

    if (data && data.state === 'completed') {
        await bot.sendMessage(chatId, 'Добро пожаловать!', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Открыть приложение', web_app: { url: APP_URL } }]
                ]
            }
        });
        return;
    }

    await bot.sendMessage(chatId, 'Подскажите, кто вы: работник или работодатель?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Работник', callback_data: 'role_worker' }],
                [{ text: 'Работодатель', callback_data: 'role_employer' }],
            ]
        }
    });
});

bot.onText(/\/reset/, async (msg) => {
    const telegramId = msg.from.id;
    const chatId = msg.chat.id;

    const { data: user } = await supabase
        .from('users')
        .select('id, role')
        .eq('telegram_id', telegramId)
        .single();

    if (!user) {
        await supabase.from('user_sessions').delete().eq('user_id', telegramId);
        await bot.sendMessage(chatId, 'Профиль сброшен');
        return;
    }

    await supabase.from('weekly_availability').delete().eq('worker_id', user.id);

    if (user.role === 'employer') {
        await supabase.from('shift_options').delete().eq('employer_id', user.id);
        await supabase.from('final_schedule').delete().eq('employer_id', user.id);

        await supabase
            .from('users')
            .update({ employer_id: null })
            .eq('employer_id', user.id);

        console.log(`Все работники отвязаны от работодателя ${user.id}`);
    } else if (user.role === 'worker') {
        await supabase
            .from('users')
            .update({ shifts_done: 0 })
            .eq('id', user.id);

        console.log(`У работника ${user.id} обнулены смены`);
    }

    await supabase.from('user_sessions').delete().eq('user_id', telegramId);
    await supabase.from('users').update({
        role: null,
        employer_id: null,
        is_on_leave: false
    }).eq('telegram_id', telegramId);

    await bot.sendMessage(chatId, 'Профиль сброшен');
});

bot.onText(/\/clearcache/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const resetUrl = `${APP_URL}?reset=1`;

    await bot.sendMessage(chatId, 'Нажмите кнопку, чтобы очистить кеш и открыть приложение заново:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Очистить кеш и открыть', web_app: { url: resetUrl } }]
            ]
        }
    });
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text;

    if (text === '/start' || text === '/reset' || text === '/clearcache') {
        return;
    }

    if (!text) return;

    const { data, error } = await supabase
        .from('user_sessions')
        .select('state')
        .eq('user_id', telegramId)
        .single();

    if (error) {
        console.log('Ошибка получения состояния:', error);
        return;
    }

    if (!data) {
        console.log('Нет состояния для пользователя:', telegramId);
        return;
    }

    if (data.state === 'awaiting_employer_phone') {
        const code = text.trim().toUpperCase();

        const { data: employers, error: findError } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'employer');

        if (findError || !employers) {
            await bot.sendMessage(chatId, 'Ошибка поиска работодателей');
            return;
        }

        let employer = null;
        for (const e of employers) {
            const generatedCode = generateInviteCode(e.id);
            if (generatedCode === code) {
                employer = e;
                break;
            }
        }

        if (employer) {
            await supabase
                .from('users')
                .update({ employer_id: employer.id })
                .eq('telegram_id', telegramId);

            await supabase
                .from('user_sessions')
                .upsert({
                    user_id: telegramId,
                    state: 'completed'
                });

            await bot.sendMessage(chatId, 'Ты привязан к работодателю ' + employer.name);
            await bot.sendMessage(chatId, 'Регистрация успешно пройдена', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Открыть приложение', web_app: { url: APP_URL } }]
                    ]
                }
            });
        } else {
            await bot.sendMessage(chatId, 'Код недействителен. Попросите у работодателя новый код.');
        }

    } else if (data.state === 'completed') {
        await bot.sendMessage(chatId, 'Добро пожаловать!', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Открыть приложение', web_app: { url: APP_URL } }]
                ]
            }
        });

    } else if (data.state === 'awaiting_role') {
        await bot.sendMessage(chatId, 'Пожалуйста, выберите роль', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Работник', callback_data: 'role_worker' }],
                    [{ text: 'Работодатель', callback_data: 'role_employer' }],
                ]
            }
        });
    } else {
        console.log('Неизвестное состояние:', data.state);
    }
});

bot.on('callback_query', async (callbackQuery) => {
    console.log('=== CALLBACK ПОЛУЧЕН ===');
    console.log('data:', callbackQuery.data);
    console.log('from:', callbackQuery.from.id);
    const chatId = callbackQuery.message.chat.id;
    const telegramId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data === 'role_worker') {
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegramId)
            .single();

        if (!existingUser) {
            await supabase
                .from('users')
                .insert({
                    telegram_id: telegramId,
                    name: callbackQuery.from.first_name || 'Пользователь',
                    role: 'worker'
                });
        } else {
            await supabase
                .from('users')
                .update({ role: 'worker' })
                .eq('telegram_id', telegramId);
        }

        await bot.sendMessage(chatId, 'Ты выбран как работник');
        await supabase
            .from('user_sessions')
            .upsert({
                user_id: telegramId,
                state: 'awaiting_employer_phone'
            });

        await bot.sendMessage(chatId, 'Отправь код работодателя (6 символов)');

    } else if (data === 'role_employer') {
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegramId)
            .single();

        if (!existingUser) {
            await supabase
                .from('users')
                .insert({
                    telegram_id: telegramId,
                    name: callbackQuery.from.first_name || 'Пользователь',
                    role: 'employer'
                });
        } else {
            await supabase
                .from('users')
                .update({ role: 'employer' })
                .eq('telegram_id', telegramId);
        }

        await bot.sendMessage(chatId, 'Ты выбран как работодатель');
        await supabase
            .from('user_sessions')
            .upsert({
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

    await bot.answerCallbackQuery(callbackQuery.id);
});