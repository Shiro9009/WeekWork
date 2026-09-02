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
        .select('monthly_shifts')
        .eq('telegram_id', telegram_id)
        .single();
    if (error || !data) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json({ monthly_shifts: data.monthly_shifts || 0 });
});

router.get('/api/user-avatar', async (req, res) => {
    const { telegram_id } = req.query;

    if (!telegram_id) {
        return res.status(400).json({ error: 'Не указан telegram_id' });
    }

    try {
        const photos = await bot.telegram.getUserProfilePhotos(telegram_id, {
            limit: 1
        });

        if (photos.total_count === 0) {
            return res.status(404).json({ error: 'Аватар не найден' });
        }

        const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;

        const fileLink = await bot.telegram.getFileLink(fileId);

        res.json({ success: true, avatarUrl: fileLink });

    } catch (error) {
        console.error('Ошибка получения аватара:', error);
        res.status(500).json({ error: 'Не удалось получить аватар' });
    }
});
export default router;