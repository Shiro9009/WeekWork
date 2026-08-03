import express from "express";
import { supabase } from "./index.js";
import { getNextWeekStart, generationSchedule } from "./scheduler.js";

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
                .eq('role', 'worker');

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

router.get('/api/employer-data', async (req, res) => {
    const { telegram_id } = req.query;

    if (!telegram_id) {
        return res.status(400).json({ error: 'Не указан telegram_id' });
    }

    const { data: employer } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegram_id)
        .eq('role', 'employer')
        .single();

    if (!employer) {
        return res.status(404).json({ error: 'Работодатель не найден' });
    }

    const { data: workers } = await supabase
        .from('users')
        .select('id, name')
        .eq('employer_id', employer.id)
        .eq('role', 'worker');

    const weekStart = getNextWeekStart();
    const { data: availability } = await supabase
        .from('weekly_availability')
        .select('worker_id, days')
        .eq('week_start', weekStart);

    const { data: options } = await supabase
        .from('shift_options')
        .select('option_number, schedule')
        .eq('employer_id', employer.id)
        .eq('week_start', weekStart)
        .order('option_number', { ascending: true });

    res.json({
        workers,
        availability,
        options,
        week_start: weekStart
    });
});

router.post('/api/choose-option', async (req, res) => {
    const { telegram_id, option_number, week_start } = req.body;

    if (!telegram_id || !option_number || !week_start) {
        return res.status(400).json({ error: 'Не хватает данных' });
    }

    const { data: employer } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegram_id)
        .eq('role', 'employer')
        .single();

    if (!employer) {
        return res.status(404).json({ error: 'Работодатель не найден' });
    }

    const { data: option } = await supabase
        .from('shift_options')
        .select('schedule')
        .eq('employer_id', employer.id)
        .eq('week_start', week_start)
        .eq('option_number', option_number)
        .single();

    if (!option) {
        return res.status(404).json({ error: 'Вариант не найден' });
    }

    const { error } = await supabase
        .from('final_schedule')
        .upsert({
            employer_id: employer.id,
            week_start: week_start,
            schedule: option.schedule,
            chosen_option_id: option.id
        }, {
            onConflict: 'employer_id, week_start'
        });

    if (error) {
        console.error('Ошибка сохранения финального расписания:', error);
        return res.status(500).json({ error: 'Ошибка сохранения' });
    }

    res.json({ success: true, message: 'Расписание выбрано!' });
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