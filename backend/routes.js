import express from "express";
import { supabase } from "./index.js";
import { getNextWeekStart, generationSchedule } from "./scheduler.js";
import { bot } from './bot.js';

const router = express.Router();
const DAY_KEYS = { Mo: "пн", Tu: "вт", We: "ср", Th: "чт", Fr: "пт", Sa: "сб", Su: "вс" };

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

        const normalizedDays = {};
        for (const [key, value] of Object.entries(days)) {
            const normalizedKey = DAY_KEYS[key] || key;
            normalizedDays[normalizedKey] = value;
        }

        console.log("Нормализованные дни", normalizedDays);

        const { error } = await supabase
            .from('weekly_availability')
            .upsert({
                worker_id: user.id,
                week_start: weekStart,
                days: normalizedDays,
                description: desc || ''
            }, {
                onConflict: 'worker_id, week_start'
            });

        if (error) {
            console.error('Ошибка сохранения в weekly_availability:', error);
            return res.status(500).json({ error: 'Ошибка сохранения: ' + error.message });
        }

        if (desc && desc.trim().length > 0) {
            const { data: worker } = await supabase
                .from('users')
                .select('name, employer_id')
                .eq('telegram_id', telegram_id)
                .single();

            if (worker && worker.employer_id) {
                const { data: employer } = await supabase
                    .from('users')
                    .select('telegram_id')
                    .eq('id', worker.employer_id)
                    .single();

                if (employer && employer.telegram_id) {
                    const message = `От: ${worker.name}\n${desc}`;
                    await bot.sendMessage(employer.telegram_id, message);
                    console.log(`Нюансы отправлены работодателю от ${worker.name}`);

                    await supabase
                        .from('weekly_availability')
                        .update({ description: '' })
                        .eq('worker_id', user.id)
                        .eq('week_start', weekStart);

                    console.log(`Нюансы удалены из БД для ${worker.name}`);
                }
            }
        }

        const { data: worker, error: workerError } = await supabase
            .from('users')
            .select('id, employer_id')
            .eq('telegram_id', telegram_id)
            .single();

        if (!workerError && worker && worker.employer_id) {
            const employerId = worker.employer_id;
            console.log('работодатель ID', employerId);

            const { data: workers, error: workersError } = await supabase
                .from('users')
                .select('id')
                .eq('employer_id', employerId)
                .eq('role', 'worker')
                .eq('is_on_leave', false);

            if (!workersError && workers && workers.length > 0) {
                const workerIds = workers.map(w => w.id);

                const { count: respondedCount } = await supabase
                    .from('weekly_availability')
                    .select('worker_id', { count: 'exact', head: true })
                    .eq('week_start', weekStart)
                    .in('worker_id', workerIds);

                if (workers.length === respondedCount) {
                    console.log('Все работники ответили! Генерирую расписание');
                    await generationSchedule(employerId, weekStart);
                } else {
                    console.log(`Ответило ${respondedCount} из ${workers.length} работников`);
                }
            } else {
                console.log('Нет работников у этого работодателя');
            }
        } else {
            console.log('У работника нет employer_id, пропускаем проверку');
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

router.get('/ping', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
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