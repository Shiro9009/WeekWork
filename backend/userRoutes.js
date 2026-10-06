import express from "express";
import { supabase } from "./index.js";
import { bot } from './bot.js';

const router = express.Router();

router.post('/api/toggle-leave', async (req, res) => {
    const { telegram_id, is_on_leave } = req.body;
    if (!telegram_id || typeof is_on_leave !== 'boolean') {
        return res.status(400).json({ error: 'Не хватает данных' });
    }
    const { error: updateError } = await supabase
        .from('users')
        .update({ is_on_leave: is_on_leave })
        .eq('telegram_id', telegram_id);
    if (updateError) {
        console.error('Ошибка обновления:', updateError);
        return res.status(500).json({ error: 'Ошибка обновления' });
    }
    res.json({ success: true });
});

router.get('/api/user-status', async (req, res) => {
    const { telegram_id } = req.query;
    if (!telegram_id) {
        return res.status(400).json({ error: 'Не указан telegram_id' });
    }
    const { data, error } = await supabase
        .from('users')
        .select('is_on_leave')
        .eq('telegram_id', telegram_id)
        .single();
    if (error || !data) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json({ is_on_leave: data.is_on_leave });
});

router.get('/api/user-shifts', async (req, res) => {
    const { telegram_id } = req.query;
    if (!telegram_id) {
        return res.status(400).json({ error: 'Не указан telegram_id' });
    }
    const { data, error } = await supabase
        .from('users')
        .select('shifts_done')
        .eq('telegram_id', telegram_id)
        .single();
    if (error || !data) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json({ monthly_shifts: data.shifts_done || 0 });
});

router.get('/api/user-availability', async (req, res) => {
    const { telegram_id, week_start } = req.query;
    if (!telegram_id || !week_start) {
        return res.status(400).json({ error: 'Не хватает данных' });
    }

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegram_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const { data: availability } = await supabase
        .from('weekly_availability')
        .select('id')
        .eq('worker_id', user.id)
        .eq('week_start', week_start)
        .single();

    res.json({ hasAvailability: !!availability });
});

router.get('/api/user-status-full', async (req, res) => {
    const { telegram_id, week_start } = req.query;
    if (!telegram_id || !week_start) {
        return res.status(400).json({ error: 'Не хватает данных' });
    }

    const { data: user } = await supabase
        .from('users')
        .select('id, name, employer_id')
        .eq('telegram_id', telegram_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const { data: availability } = await supabase
        .from('weekly_availability')
        .select('id')
        .eq('worker_id', user.id)
        .eq('week_start', week_start)
        .single();

    const { data: finalSchedule } = await supabase
        .from('final_schedule')
        .select('schedule')
        .eq('employer_id', user.employer_id)
        .eq('week_start', week_start)
        .single();

    let myDays = [];
    if (finalSchedule?.schedule) {
        for (const [day, names] of Object.entries(finalSchedule.schedule)) {
            if (Array.isArray(names) && names.includes(user.name)) {
                myDays.push(day);
            }
        }
    }

    res.json({
        hasAvailability: !!availability,
        hasFinalSchedule: !!finalSchedule,
        myDays: myDays
    });
});

router.get('/api/user-avatar', async (req, res) => {
    const { telegram_id } = req.query;

    if (!telegram_id) {
        return res.status(400).json({ error: 'Не указан telegram_id' });
    }

    try {
        console.log('Запрос аватара для:', telegram_id);

        const photos = await bot.getUserProfilePhotos(telegram_id, {
            limit: 1
        });

        console.log('Ответ от Telegram:', photos);

        if (photos.total_count === 0) {
            console.log('Аватар не найден');
            return res.status(404).json({ error: 'Аватар не найден' });
        }

        const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
        console.log('File ID:', fileId);

        const fileLink = await bot.getFileLink(fileId);
        console.log('Ссылка на файл:', fileLink);

        res.json({ success: true, avatarUrl: fileLink });

    } catch (error) {
        console.error('Ошибка получения аватара:', error);
        res.status(500).json({ error: 'Не удалось получить аватар' });
    }
});

export default router;