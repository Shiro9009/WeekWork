import express from "express";
import { supabase } from "./index.js";
import { getNextWeekStart } from "./scheduler.js";

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

router.get('/api/user-role', async (req, res) => {
    const { telegram_id } = req.query;
    if (!telegram_id) {
        return res.status(400).json({error: 'Не указан telegram_id'})
    }

    const {data, error} = await supabase 
        .from('users')
        .select('role')
        .eq('telegram_id', telegram_id)
        .single();

    if ( error || !data) {
        return res.status(404).json({ error: 'Пользователь не найден' })
    }

    res.json({ role: data.role });
})

export default router;