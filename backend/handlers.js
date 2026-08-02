import { supabase } from './index.js';
import { bot, APP_URL } from './bot.js';
import { cleanPhoneNumber } from './scheduler.js';

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

bot.onText(/\/reset/, async (msg) => {
    const telegramId = msg.from.id;
    const chatId = msg.chat.id;

    await supabase.from('user_sessions').delete().eq('user_id', telegramId);
    await supabase.from('users').update({ role: null, employer_id: null }).eq('telegram_id', telegramId);
    await bot.sendMessage(chatId, 'Профиль сброщен')
})

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text;

    if (text === '/start' || text === '/reset') {
        return;
    }

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
            console.log('Пользователь обновлён');
        } else {
            const { data: userByTelegram, error: findTelegramError } = await supabase
                .from('users')
                .select('id, phone_number')
                .eq('telegram_id', telegramId)
                .single();

            if (userByTelegram) {
                await supabase
                    .from('users')
                    .update({ phone_number: phoneNumber })
                    .eq('telegram_id', telegramId);
                console.log('Добавлен номер для существующего пользователя');
            } else {
                await supabase
                    .from('users')
                    .insert({
                        telegram_id: telegramId,
                        phone_number: phoneNumber,
                        name: msg.from.first_name || 'Пользователь'
                    });
                console.log('Создан новый пользователь');
            }
        }


        const { error: sessionError } = await supabase
            .from('user_sessions')
            .upsert({
                user_id: telegramId,
                state: 'awaiting_role'
            });

        if (sessionError) {
            console.log('Ошибка создания сессии:', sessionError);
        } else {
            console.log('Сессия создана для пользователя:', telegramId);
        }

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
        const phoneNumber = cleanPhoneNumber(text);
        const { data: employer, error: findError } = await supabase
            .from('users')
            .select('id, name, phone_number')
            .eq('phone_number', phoneNumber)
            .eq('role', 'employer')
            .single();

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
            await bot.sendMessage(chatId, 'Работодатель с таким номером не найден. Попробуйте снова.');
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
    const chatId = callbackQuery.message.chat.id;
    const telegramId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data === 'role_worker') {
        const { error } = await supabase
            .from('users')
            .update({ role: 'worker' })
            .eq('telegram_id', telegramId);

        if (error) {
            console.log('Ошибка обновления роли:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при сохранении роли');
        } else {
            await bot.sendMessage(chatId, 'Ты выбран как работник');
            await supabase
                .from('user_sessions')
                .upsert({
                    user_id: telegramId,
                    state: 'awaiting_employer_phone'
                });

            await bot.sendMessage(chatId, 'Отправь номер телефона работодателя');
        }

    } else if (data === 'role_employer') {
        const { error } = await supabase
            .from('users')
            .update({ role: 'employer' })
            .eq('telegram_id', telegramId);

        if (error) {
            console.log('Ошибка обновления роли:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при сохранении роли');
        } else {
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
    }

    await bot.answerCallbackQuery(callbackQuery.id);
});

