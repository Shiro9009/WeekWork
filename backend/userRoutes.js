import express from "express";
import { supabase } from "./index.js";

const router = express.Router();

router.post('/api/toggle-leave', async (req, res) => {
    const { telegram_id, is_on_leave } = req.body;

    try {
        if (!telegram_id || typeof is_on_leave !== 'boolean') {
            return res.status(400).json({ error: 'Не хватает данных' })
        }

        const { error: updateError } = await supabase.from('users').update({ is_on_leave: is_on_leave }).eq('telegram_id', telegram_id);
        if (updateError) {
            console.error('Ошибка обновления:', updateError);
            return res.status(500).json({ error: 'Ошибка обновления' });
        }

        return res.json({ success: true });

    } catch (error) {
        console.error('Ошибка:', error);
        return res.status(500).json({ error: 'Внутрення ошибка сервера' });
    }
});

router.get('/api/user-status', async (req, res) => {
    const { telegram_id } = req.query;

    if (!telegram_id) {
        return res.status(400).json({ error: 'Не указан телеграм айди' });
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

export default router;