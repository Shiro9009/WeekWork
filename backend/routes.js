import express from "express";
import { supabase } from "./index.js";
import { getNextWeekStart } from "./scheduler.js";

const router = express.Router();

router.post('/api/availability', async (req, res) => {
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

router.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Бэкенд работает',
        endpoints: ['/api/availability', '/webapp-data']
    });
});

router.post('/webapp-data', (req, res) => {
    console.log('Данные от приложения:', req.body);
    res.json({ ok: true });
});

export default router;