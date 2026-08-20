import express from "express";
import { supabase } from "./index.js";
import { getNextWeekStart } from "./scheduler.js";
import { bot } from './bot.js';

const router = express.Router();


router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://weekwork-app.vercel.app');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
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

    const { data: finalSchedule } = await supabase
        .from('final_schedule')
        .select('schedule, employer_id')
        .eq('employer_id', employer.id)
        .eq('week_start', weekStart)
        .single()

    let final = null;

    if (finalSchedule) {
        final = finalSchedule.schedule;
    }

    res.json({
        workers,
        availability,
        options,
        final,
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

    const { count } = await supabase
        .from('final_schedule')
        .select('id', { count: 'exact', head: true })
        .eq('employer_id', employer.id);

    if (count > 4) {
        const { data: oldest } = await supabase 
            .from('final_schedule')
            .select('id')
            .eq('employer_id', employer.id)
            .order('week_start', { ascending: true })
            .limit(1)
            .single();

        if (oldest) {
            await supabase.from('final_schedule').delete().eq('id', oldest.id);
            console.log(`Старая запись удалена  с ID ${oldest.id}`)
        }
    }

    const { data: workers } = await supabase
        .from('users')
        .select('id, name, telegram_id')
        .eq('employer_id', employer.id)
        .eq('role', 'worker')
        .eq('is_on_leave', false);

    const schedule = option.schedule;

    for (const worker of workers) {
        if (!worker.telegram_id) continue;

        const workerDays = [];

        for (const [day, names] of Object.entries(schedule)) {
            if (names.includes(worker.name)) {
                workerDays.push(day);
            }
        }

        if (workerDays.length > 0) {
            const message = `Ваши смены на неделю: ${workerDays.join(', ')}`;
            await bot.sendMessage(worker.telegram_id, message);
            console.log(`Уведомление отправлено ${worker.name} (${worker.telegram_id})`);
        }
    }

    res.json({ success: true, message: 'Расписание выбрано!' });
});

router.get('/api/user-role', async (req, res) => {
    const { telegram_id } = req.query;
    if (!telegram_id) {
        return res.status(400).json({ error: 'Не указан telegram_id' })
    }

    const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('telegram_id', telegram_id)
        .single();

    if (error || !data) {
        return res.status(404).json({ error: 'Пользователь не найден' })
    }

    res.json({ role: data.role });
})

router.post('/api/update-shifts', async (req, res) => {
    const { telegram_id, workers } = req.body;

    if (!telegram_id || !workers || !Array.isArray(workers)) {
        return res.status(400).json({ error: 'Не хватает данных' });
    }

    const { data: employer, error: employerError } = await suabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegram_id)
        .eq('role', 'employer')
        .single();

    if (employerError || !employer) {
        return res.status(400).json({ error: 'Работодатель не найден' });
    }

    const updates = workers.map(async (worker) => {
        const { user_id, monthly_shifts } = worker;

        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('id', user_id)
            .eq('employer_id', employer.id)
            .single();
        
        if(!user) {
            console.log(`Пользователь ${user_id} не принадлежит этому работодателю`);
            return null;
        }

        const { error: updateError } = await supabase
            .from('users')
            .update({ monthly_shifts: monthly_shifts})
            .eq('id', user_id);

        if(updateError) {
            console.log(`Ошибка обновления для ${user_id}:`, updateError);
            return null;
        }
        return { user_id, monthly_shifts };
    });

    const results = await Promise.all(updates);

    const failed = results.filter(r => r === null);
    if(failed.length > 0) {
        return res.status(500).json({ error: 'Некоторые обновления не удались' });
    }

    res.json({ success: true, message: 'Количество смен обновлено' });
});

export default router;