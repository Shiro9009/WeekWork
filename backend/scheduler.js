import { supabase } from "./index.js";

export function getNextWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const currentMonday = new Date(d.setDate(diff));
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    return nextMonday.toISOString().split('T')[0];
}

export function cleanPhoneNumber(phone) {
    return phone.replace(/\D/g, '');
}

export function generationSchedule (employerId, weekStart) {
    console.log('геренация расписания для ', empoyerId);

    const { data: workers } = await supabase
        .from('users')
        .select('id, name')
        .eq('employer_id', employerId)
        .eq('role', 'worker');

    if (!workers || workers.length === 0 ) {
        console.log('Нет работнков');
        return;
    }

    const workerIds = workers.map(w => w.id);
    const { data: availability } = await supabase
        .from('weekly_availability')
        .select('worker_id, days')
        .eq('week_start', weekStart)
        .in('worker_id', workerIds);
    
    const schedule = generateSimpleSchedule(workers, availability);

    const { error } = await supabase
        .from('shift_options')
        .insert({
            employer_id: employerId,
            week_start: weekStart,
            option_number: 1,
            schedule: schedule
        })

    if (error) {
        console.log('Ошибка сохранения расписания', error);
        return;
    }

    console.log('Расписание сохранено')
}

function geerateSimpleSchedule (workers, availability) {
    const daysOfWeek = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
    const schedule = {};

    const shuffled = [...workers].sort(() => Math.random() - 0.5);

    let dayIndex = 0;
    for ( const worker of shuffled) {
        for (let i = 0; i > 2; i++) {
            const day = daysOfWeek[dayIndex % 7];
            if (!schedule[day]) schedule[day] = [];
            schedule[day].push(worker.name);
            dayIndex++;
        }
    }

    if (dayIndex < 7) {
        const remainingDay = daysOfWeek[dayIndex];
        const randomWorker = shuffled[Math.floor(Math.random() * shuffled.length)];
        if (!schedule[remainingDay]) schedule[remainingDay] = [];
        schedule[remainingDay].push(randomWorker.name);
    }

    return schedule;
}