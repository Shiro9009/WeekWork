<template>
    <div class="employer-page">
        <div v-if="loading"><img class="gif_loading" src="/loading-thinking.gif" alt="загрузка"></div>
        <div v-else>
            <section class="workers-avatar">
                <h2 class="workers-avatar-title">Сотрудники</h2>
                <ul class="workers-list">
                    <li v-for="worker in workers" :key="worker.id" class="worker-card">
                        <img v-if="worker.avatarUrl" :src="worker.avatarUrl" alt="аватар" class="worker-avatar-img" />
                        <div v-else class="worker-avatar-placeholder">
                            {{ worker.name.charAt(0).toUpperCase() }}
                        </div>
                        <p class="worker-name">{{ worker.name }}</p>
                        <p class="worker-shifts" @click="openShiftEditor(worker)">
                            {{ worker.monthly_shifts || 0 }} см.
                        </p>
                    </li>
                </ul>
            </section>
            <div v-if="final" class="final-schedule">
                <h2 class="final-title">Финальное расписание</h2>
                <div class="final-list">
                    <div v-for="day in sortedFinalDays" :key="day" class="final-item">
                        <div class="final-day">
                            <span class="final-day-name">{{ getDayLabel(day) }}</span>
                            <span class="final-day-date">{{ getDayDate(day) }}</span>
                        </div>
                        <div class="final-worker">
                            <span v-if="!showSelect[day]" @click="openSelect(day)" class="final-worker-name">
                                {{ final[day].join(', ') || '—' }}
                            </span>
                            <select v-else @change="replaceWorker(day, $event)" class="final-select">
                                <option v-for="worker in workers" :key="worker.id" :value="worker.name">
                                    {{ worker.name }}
                                </option>
                            </select>
                        </div>
                    </div>
                </div>
                <button v-if="hasChenges" @click="saveSchedule" class="save-btn">Сохранить</button>
            </div>
            <div v-else>
                <div class="options" v-if="options && options.length > 0">
                    <h2 class="variatns-shifts">Варианты расписания</h2>
                    <div v-for="option in options" :key="option.option_number" class="option-card">
                        <div class="option-header">
                            <h3>Вариант {{ getOptionLetter(option.option_number) }}</h3>
                        </div>

                        <div class="week-grid">
                            <div v-for="day in weekDays" :key="day" class="day-column">
                                <span class="day-name">{{ day }}</span>
                                <div class="workers-avatars">
                                    <div v-for="workerName in getWorkersForDay(option.schedule, day)" :key="workerName"
                                        class="worker-avatar-circle" :title="workerName">
                                        {{ getInitials(workerName) }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button @click="chooseOption(option.option_number)" class="select-option-btn">
                            Выбрать этот вариант
                        </button>
                    </div>
                </div>
            </div>

            <div v-if="showShiftEditor" class="modal-overlay" @click.self="closeShiftEditor">
                <div class="modal-content">
                    <h3 class="modal-title">Изменить смены</h3>
                    <p class="modal-worker-name">{{ editingWorker?.name }}</p>
                    <input type="number" v-model.number="editingShifts" min="0" class="modal-input"
                        @keyup.enter="saveShiftChanges" autofocus />
                    <div class="modal-buttons">
                        <button @click="saveShiftChanges" class="modal-save-btn">Сохранить</button>
                        <button @click="closeShiftEditor" class="modal-cancel-btn">Отмена</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
const API_URL = 'https://weekwork-production-ea3e.up.railway.app';

export default {
    data() {
        return {
            workers: [],
            options: [],
            loading: true,
            weekStart: null,
            final: null,
            showSelect: {},
            hasChenges: false,
            isEditing: false,
            showShiftEditor: false,
            editingWorker: null,
            editingShifts: 0,
        };
    },
    props: {
        user: {
            type: Object,
            required: true,
        }
    },
    computed: {
        weekDays() {
            return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        },
        sortedFinalDays() {
            if (!this.final) return [];

            const dayOrder = {
                'пн': 0, 'вт': 1, 'ср': 2, 'чт': 3, 'пт': 4, 'сб': 5, 'вс': 6,
                'Пн': 0, 'Вт': 1, 'Ср': 2, 'Чт': 3, 'Пт': 4, 'Сб': 5, 'Вс': 6,
                'Понедельник': 0, 'Вторник': 1, 'Среда': 2, 'Четверг': 3,
                'Пятница': 4, 'Суббота': 5, 'Воскресенье': 6
            };

            return Object.keys(this.final).sort((a, b) => {
                const indexA = dayOrder[a] !== undefined ? dayOrder[a] : 999;
                const indexB = dayOrder[b] !== undefined ? dayOrder[b] : 999;
                return indexA - indexB;
            });
        }
    },
    async mounted() {
        let userData = null;

        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            userData = window.Telegram.WebApp.initDataUnsafe.user;
            console.log('Данные из window.Telegram: ', userData);
        }

        if (!userData) {
            const url = window.location.href;
            const match = url.match(/[#?]tgWebAppData=([^&]+)/);
            if (match) {
                try {
                    const decoded = decodeURIComponent(match[1]);
                    const params = new URLSearchParams(decoded);
                    const userParam = params.get('user');
                    if (userParam) {
                        userData = JSON.parse(decodeURIComponent(userParam));
                        console.log('Данные из URL: ', userData);
                    }
                } catch (e) {
                    console.log('Ошибка при парсинге данных из URL:', e);
                }
            }
        }

        if (!userData) {
            alert('Ошибка: пользователь не авторизован');
            this.loading = false;
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/employer-data?telegram_id=${userData.id}`);
            const data = await response.json();

            const workersWithAvatars = await Promise.all(
                (data.workers || []).map(async (worker) => {
                    try {
                        const avatarResponse = await fetch(
                            `${API_URL}/api/user-avatar?telegram_id=${worker.telegram_id}`
                        );
                        const avatarData = await avatarResponse.json();
                        return {
                            ...worker,
                            avatarUrl: avatarData.success ? avatarData.avatarUrl : null
                        };
                    } catch {
                        return {
                            ...worker,
                            avatarUrl: null
                        };
                    }
                })
            );

            this.workers = workersWithAvatars;
            this.options = data.options || [];
            this.weekStart = data.week_start;
            this.final = data.final || null;

            console.log('=== ОТЛАДКА ОПЦИЙ ===');
            console.log('Options data:', this.options);

            if (this.options && this.options.length > 0) {
                console.log('Первый вариант:', this.options[0]);
                console.log('Schedule первого варианта:', this.options[0].schedule);
                console.log('Ключи в schedule:', Object.keys(this.options[0].schedule || {}));
                console.log('Тип schedule:', typeof this.options[0].schedule);
            } else {
                console.log('Опций нет или они пустые');
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
        } finally {
            this.loading = false;
        }

        if (this.final) {
            for (const day in this.final) {
                this.showSelect[day] = false;
            }
        }
    },
    methods: {
        openShiftEditor(worker) {
            this.editingWorker = worker;
            this.editingShifts = worker.monthly_shifts || 0;
            this.showShiftEditor = true;
        },
        closeShiftEditor() {
            this.showShiftEditor = false;
            this.editingWorker = null;
        },
        async saveShiftChanges() {
            if (!this.editingWorker) return;

            const originalShifts = this.editingWorker.monthly_shifts;
            this.editingWorker.monthly_shifts = this.editingShifts;

            try {
                const response = await fetch(`${API_URL}/api/update-shifts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegram_id: this.user.id,
                        workers: this.workers.map(w => ({
                            user_id: w.id,
                            monthly_shifts: w.monthly_shifts || 0
                        }))
                    })
                });

                const data = await response.json();
                if (data.success) {
                    this.closeShiftEditor();
                } else {
                    this.editingWorker.monthly_shifts = originalShifts;
                    alert('Ошибка: ' + data.error);
                }
            } catch (error) {
                this.editingWorker.monthly_shifts = originalShifts;
                console.error('Ошибка:', error);
                alert('Не удалось сохранить');
            }
        },
        getWorkersForDay(schedule, dayShort) {
            if (!schedule) return [];

            const dayMap = {
                'Пн': ['Пн', 'пн', 'Понедельник', 'понедельник', 'Monday', 'mon'],
                'Вт': ['Вт', 'вт', 'Вторник', 'вторник', 'Tuesday', 'tue'],
                'Ср': ['Ср', 'ср', 'Среда', 'среда', 'Wednesday', 'wed'],
                'Чт': ['Чт', 'чт', 'Четверг', 'четверг', 'Thursday', 'thu'],
                'Пт': ['Пт', 'пт', 'Пятница', 'пятница', 'Friday', 'fri'],
                'Сб': ['Сб', 'сб', 'Суббота', 'суббота', 'Saturday', 'sat'],
                'Вс': ['Вс', 'вс', 'Воскресенье', 'воскресенье', 'Sunday', 'sun']
            };

            const possibleDayNames = dayMap[dayShort] || [dayShort];
            const scheduleKeys = Object.keys(schedule);

            for (const dayName of possibleDayNames) {
                const exactMatch = scheduleKeys.find(key =>
                    key === dayName ||
                    key.toLowerCase() === dayName.toLowerCase()
                );
                if (exactMatch && Array.isArray(schedule[exactMatch]) && schedule[exactMatch].length > 0) {
                    return schedule[exactMatch];
                }
            }

            return [];
        },

        getDayLabel(dayKey) {
            const dayMap = {
                'пн': 'Пн', 'вт': 'Вт', 'ср': 'Ср', 'чт': 'Чт',
                'пт': 'Пт', 'сб': 'Сб', 'вс': 'Вс',
                'Пн': 'Пн', 'Вт': 'Вт', 'Ср': 'Ср', 'Чт': 'Чт',
                'Пт': 'Пт', 'Сб': 'Сб', 'Вс': 'Вс',
                'Понедельник': 'Пн', 'Вторник': 'Вт', 'Среда': 'Ср',
                'Четверг': 'Чт', 'Пятница': 'Пт', 'Суббота': 'Сб', 'Воскресенье': 'Вс'
            };
            return dayMap[dayKey] || dayKey;
        },
        getDayDate(dayKey) {
            if (!this.weekStart) return '';

            const weekStartDate = new Date(this.weekStart);
            const dayMap = {
                'пн': 0, 'вт': 1, 'ср': 2, 'чт': 3, 'пт': 4, 'сб': 5, 'вс': 6,
                'Пн': 0, 'Вт': 1, 'Ср': 2, 'Чт': 3, 'Пт': 4, 'Сб': 5, 'Вс': 6,
                'Понедельник': 0, 'Вторник': 1, 'Среда': 2, 'Четверг': 3,
                'Пятница': 4, 'Суббота': 5, 'Воскресенье': 6
            };

            const dayIndex = dayMap[dayKey];
            if (dayIndex === undefined) return '';

            const date = new Date(weekStartDate);
            date.setDate(date.getDate() + dayIndex);

            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            return `${day}.${month}`;
        },
        getInitials(name) {
            if (!name) return '?';

            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        },

        getOptionLetter(number) {
            const letters = ['А', 'Б', 'В', 'Г', 'Д'];
            return letters[number - 1] || number;
        },

        async chooseOption(optionNumber) {
            const tg = window.Telegram?.WebApp;
            const user = this.user;

            if (!user) {
                alert('Пользователь не авторизован');
                return;
            }

            const weekStart = this.weekStart;

            if (!weekStart) {
                alert('Не найдена дата недели');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/choose-option`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegram_id: user.id,
                        option_number: optionNumber,
                        week_start: weekStart
                    })
                });

                const result = await response.json();

                if (result.success) {
                    alert('Расписание выбрано!');
                    location.reload();
                } else {
                    alert('Ошибка: ' + result.error);
                }
            } catch (error) {
                console.error('Ошибка отправки:', error);
                alert('Не удалось отправить данные');
            }
        },
        openSelect(day) {
            this.showSelect[day] = true;
        },
        replaceWorker(day, event) {
            const newName = event.target.value;
            if (this.final) {
                this.final[day] = [newName];
            }
            this.showSelect[day] = false;
            this.saveSchedule();
        },
        async saveSchedule() {
            const payload = {
                telegram_id: this.user.id,
                week_start: this.weekStart,
                schedule: this.final,
            };

            try {
                const response = await fetch(`${API_URL}/api/update-schedule`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                const data = await response.json();

                if (data.success) {
                    this.hasChenges = false;
                } else {
                    alert('Ошибка: ' + data.error);
                }
            } catch (error) {
                console.error('Ошибка сохранения:', error);
                alert('Не удалось сохранить');
            }
        }
    }
};
</script>

<style scoped>
.save-btn {
    background: #310597;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    margin-top: 15px;
}

.save-btn:hover {
    background: #455aa0;
}

.edit-btn {
    background: #0a0f4e;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    margin-top: 15px;
}

.edit-btn:hover {
    background: #2d059c;
}

.cancel-btn {
    background: #888;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    margin-top: 15px;
    margin-left: 10px;
}

.cancel-btn:hover {
    background: #666;
}

.workers-avatar-title,
.variatns-shifts {
    color: #111827;
    font-size: 20px;
    width: 380px;
    display: flex;
    margin: 20px auto;
}

.workers-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-start;
    padding: 0;
    margin: 0 auto;
    width: 380px;
    list-style: none;
}

.worker-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 60px;
    padding: 8px 4px;
    background: transparent;
    border: none;
}

.worker-avatar-img {
    border-radius: 50%;
    width: 52px;
    height: 52px;
    object-fit: cover;
    border: 2px solid #7C6BC4;
}

.worker-avatar-placeholder {
    border-radius: 50%;
    width: 52px;
    height: 52px;
    border: 2px solid #7C6BC4;
    background: #fff;
    color: #7C6BC4;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
}

.worker-name {
    font-size: 16px;
    font-weight: 500;
    color: #111827;
    margin: 8px 0 0 0;
    text-align: center;
    white-space: nowrap;
}

.worker-shifts {
    font-size: 13px;
    color: #6b7280;
    margin: 5px 0 0 0;
    text-align: center;
    border: 1px solid #e5e7eb;
    border-radius: 100px;
    padding: 2px 6px;
    background: #f3f4f6;
}

.options {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 10px 10px;
}

.option-card {
    background: white;
    border-radius: 24px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border: 2px solid #e5e7eb;
    transition: all 0.3s ease;
}

.option-card:hover {
    box-shadow: 0 4px 20px rgba(49, 5, 151, 0.15);
    border-color: #7C6BC4;
}

.option-header {
    margin-bottom: 16px;
}

.option-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #111827;
}

.week-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
    margin-bottom: 16px;
}

.day-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

.day-name {
    font-size: 11px;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.workers-avatars {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    min-height: 50px;
}

.worker-avatar-circle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #7c6bc4;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 2px 6px rgba(124, 107, 196, 0.3);
    border: 2px solid white;
    transition: transform 0.2s ease;
    cursor: default;
}

.worker-avatar-circle:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 10px rgba(124, 107, 196, 0.4);
}

.select-option-btn {
    width: 100%;
    padding: 12px 20px;
    background: #7c6bc4;
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(124, 107, 196, 0.3);
}

.select-option-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(124, 107, 196, 0.4);
    background: #6a5ab8;
}

.select-option-btn:active {
    transform: translateY(0);
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
}

.modal-content {
    background: white;
    border-radius: 24px;
    padding: 30px;
    width: 320px;
    max-width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: modalFadeIn 0.3s ease;
}

@keyframes modalFadeIn {
    from {
        transform: scale(0.9);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

.modal-title {
    font-size: 18px;
    font-weight: 700;
    color: #111827;
    margin: 0 0 8px 0;
    text-align: center;
}

.modal-worker-name {
    font-size: 16px;
    color: #6b7280;
    margin: 0 0 16px 0;
    text-align: center;
}

.modal-input {
    width: 100%;
    padding: 12px 16px;
    font-size: 20px;
    font-weight: 600;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    text-align: center;
    outline: none;
    transition: border-color 0.3s ease;
    box-sizing: border-box;
}

.modal-input:focus {
    border-color: #7C6BC4;
}

.modal-buttons {
    display: flex;
    gap: 10px;
    margin-top: 16px;
}

.modal-save-btn {
    flex: 1;
    padding: 12px;
    background: #7C6BC4;
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s ease;
}

.modal-save-btn:hover {
    background: #6a5ab8;
}

.modal-cancel-btn {
    flex: 1;
    padding: 12px;
    background: #f3f4f6;
    color: #6b7280;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s ease;
}

.modal-cancel-btn:hover {
    background: #e5e7eb;
}

.worker-shifts {
    cursor: pointer;
    transition: background 0.2s ease;
}

.worker-shifts:hover {
    background: #e5e7eb;
}

.final-schedule {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 10px 10px;
}

.final-title {
    color: #111827;
    font-size: 20px;
    width: 380px;
    display: flex;
    margin: 20px auto;
}

.final-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 380px;
    margin: 0 auto;
}

.final-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    border-radius: 16px;
    border: 1px solid #9B8FD8;
    padding: 14px 18px;
    transition: all 0.2s ease;
    min-height: 52px;
}

.final-item:hover {
    border-color: #7C6BC4;
    box-shadow: 0 2px 8px rgba(124, 107, 196, 0.1);
}

.final-day {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 80px;
}

.final-day-name {
    font-weight: 600;
    font-size: 16px;
    color: #111827;
}

.final-day-date {
    font-size: 13px;
    color: #6b7280;
}

.final-worker {
    flex: 1;
    text-align: right;
}

.final-worker-name {
    font-size: 17px;
    color: #111827;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
    transition: background 0.2s ease;
}

.final-worker-name:hover {
    background: #f3f4f6;
}

.final-select {
    padding: 6px 12px;
    border: 2px solid #7C6BC4;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    outline: none;
    cursor: pointer;
    min-width: 100px;
}

.final-select:focus {
    border-color: #5a4a9e;
}
</style>