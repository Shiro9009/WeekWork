import express from "express";
import { supabase } from "./index.js";
import { getNextWeekStart } from "./scheduler.js";
import { bot } from './bot.js';

const router = express.Router();

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
        .select('id, name, telegram_id, monthly_shifts')
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
        .single();
    let final = null;
    if (finalSchedule) {
        final = finalSchedule.schedule;
    }
    res.json({ workers, availability, options, final, week_start: weekStart });
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
    const schedule = option.schedule;
    const { data: workers } = await supabase
        .from('users')
        .select('id, name, monthly_shifts')
        .eq('employer_id', employer.id)
        .eq('role', 'worker')
        .eq('is_on_leave', false);
    for (const worker of workers) {
        let count = 0;
        for (const [day, names] of Object.entries(schedule)) {
            if (names.includes(worker.name)) {
                count++;
            }
        }
        if (count > 0) {
            const newShifts = Math.max(0, (worker.monthly_shifts || 0) - count);
            await supabase
                .from('users')
                .update({ monthly_shifts: newShifts })
                .eq('id', worker.id);
            console.log(`У работника ${worker.name} осталось ${newShifts} смен`);
        }
    }
    const { data: workersForNotifications } = await supabase
        .from('users')
        .select('id, name, telegram_id')
        .eq('employer_id', employer.id)
        .eq('role', 'worker')
        .eq('is_on_leave', false);
    for (const worker of workersForNotifications) {
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

router.post('/api/update-shifts', async (req, res) => {
    const { telegram_id, workers } = req.body;
    if (!telegram_id || !workers || !Array.isArray(workers)) {
        return res.status(400).json({ error: 'Не хватает данных' });
    }
    const { data: employer } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegram_id)
        .eq('role', 'employer')
        .single();
    if (!employer) {
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
        if (!user) {
            console.log(`Пользователь ${user_id} не принадлежит этому работодателю`);
            return null;
        }
        const { error: updateError } = await supabase
            .from('users')
            .update({ monthly_shifts: monthly_shifts })
            .eq('id', user_id);
        if (updateError) {
            console.log(`Ошибка обновления для ${user_id}:`, updateError);
            return null;
        }
        return { user_id, monthly_shifts };
    });
    const results = await Promise.all(updates);
    const failed = results.filter(r => r === null);
    if (failed.length > 0) {
        return res.status(500).json({ error: 'Некоторые обновления не удались' });
    }
    res.json({ success: true, message: 'Количество смен обновлено' });
});

const DAY_ORDER = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

function compareDays(a, b) {
    const indexA = DAY_ORDER.indexOf(a);
    const indexB = DAY_ORDER.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
}

function collectDaysByWorker(schedule, workers) {
    const daysByWorker = {};
    for (const worker of workers) {
        daysByWorker[worker.id] = [];
    }
    for (const [day, names] of Object.entries(schedule || {})) {
        if (!Array.isArray(names)) continue;
        for (const worker of workers) {
            if (names.includes(worker.name)) {
                daysByWorker[worker.id].push(day);
            }
        }
    }
    for (const workerId of Object.keys(daysByWorker)) {
        daysByWorker[workerId].sort(compareDays);
    }
    return daysByWorker;
}

router.post('/api/update-schedule', async (req, res) => {
    const { telegram_id, week_start, schedule } = req.body;
    if (!telegram_id || !week_start || !schedule) {
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

    const { data: oldFinal } = await supabase
        .from('final_schedule')
        .select('schedule')
        .eq('employer_id', employer.id)
        .eq('week_start', week_start)
        .single();
    if (!oldFinal) {
        return res.status(404).json({ error: 'Финальное расписание не найдено' });
    }
    const oldSchedule = oldFinal.schedule || {};

    const { data: workers, error: workersError } = await supabase
        .from('users')
        .select('id, name, telegram_id, monthly_shifts')
        .eq('employer_id', employer.id)
        .eq('role', 'worker');
    if (workersError || !workers) {
        console.error('Ошибка получения работников:', workersError);
        return res.status(500).json({ error: 'Ошибка получения работников' });
    }

    const oldDaysByWorker = collectDaysByWorker(oldSchedule, workers);
    const newDaysByWorker = collectDaysByWorker(schedule, workers);

    const { error: updateError } = await supabase
        .from('final_schedule')
        .update({ schedule: schedule })
        .eq('employer_id', employer.id)
        .eq('week_start', week_start);
    if (updateError) {
        console.error('Ошибка обновления расписания:', updateError);
        return res.status(500).json({ error: 'Ошибка сохранения' });
    }

    const shifts = [];
    for (const worker of workers) {
        const oldCount = oldDaysByWorker[worker.id].length;
        const newCount = newDaysByWorker[worker.id].length;
        if (oldCount === newCount) continue;

        const newShifts = Math.max(0, (worker.monthly_shifts || 0) + oldCount - newCount);
        const { error: shiftError } = await supabase
            .from('users')
            .update({ monthly_shifts: newShifts })
            .eq('id', worker.id);
        if (shiftError) {
            console.error(`Ошибка обновления смен для ${worker.name}:`, shiftError);
            continue;
        }
        worker.monthly_shifts = newShifts;
        shifts.push({ user_id: worker.id, monthly_shifts: newShifts });
        console.log(`У работника ${worker.name} осталось ${newShifts} смен`);
    }

    const notified = [];
    const notNotified = [];
    for (const worker of workers) {
        const before = oldDaysByWorker[worker.id];
        const after = newDaysByWorker[worker.id];
        if (before.join('|') === after.join('|')) continue;

        if (!worker.telegram_id) {
            notNotified.push(worker.name);
            continue;
        }

        const message = after.length > 0
            ? `Расписание на неделю изменено. Ваши смены: ${after.join(', ')}`
            : 'Расписание на неделю изменено. Смен у вас больше нет';

        try {
            await bot.sendMessage(worker.telegram_id, message);
            notified.push(worker.name);
            console.log(`Уведомление отправлено ${worker.name} (${worker.telegram_id})`);
        } catch (error) {
            notNotified.push(worker.name);
            console.error(`Не удалось уведомить ${worker.name}:`, error.message);
        }
    }

    res.json({ success: true, message: 'Расписание обновлено', shifts, notified, notNotified });
});

router.get('/api/user-role', async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    const { telegram_id } = req.query;  

    if (!telegram_id) {
        return res.status(400).json({ error: 'Не указан telegram_id' });
    }

    const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('telegram_id', telegram_id)
        .single();

    if (error || !data) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ role: data.role });
});

router.get('/api/employer-info', async (req, res) => {
    const { telegram_id } = req.query;
    if (!telegram_id) {
        return res.status(400).json({ error: 'Не указан telegram_id' });
    }

    try {
        const { data: worker, error: workerError } = await supabase
            .from('users')
            .select('employer_id, name')
            .eq('telegram_id', Number(telegram_id))
            .single();

        if (workerError || !worker) {
            return res.status(404).json({ error: 'Работник не найден' });
        }

        if (!worker.employer_id) {
            return res.status(404).json({ error: 'Работодатель не назначен' });
        }

        const { data: employer, error: employerError } = await supabase
            .from('users')
            .select('name')
            .eq('id', worker.employer_id)
            .single();

        if (employerError || !employer) {
            return res.status(404).json({ error: 'Работодатель не найден' });
        }

        res.json({ name: employer.name });

    } catch (error) {
        console.error('Ошибка в /api/employer-info:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

export default router;