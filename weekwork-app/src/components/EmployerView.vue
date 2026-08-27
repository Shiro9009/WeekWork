<template>
    <div class="employer-page">
        <h1>Управление расписанием</h1>
        <div v-if="loading"><img class="gif_loading" src="/loading-thinking.gif" alt="загрузка"></div>
        <div v-else>
            <div v-if="final">
                <h2>Подчинённые</h2>
                <ul>
                    <li v-for="worker in workers" :key="worker.id">
                        {{ worker.name }}
                    </li>
                </ul>
                <h2>Финальное</h2>
                <div v-for="(names, day) in final" :key="day">
                    <strong>{{ day }}:</strong>
                    <p v-if="!showSelect[day]" @click="openSelect(day)">{{ names.join(', ') }}</p>
                    <select v-else @change="replaceWorker(day, $event)">
                        <option v-for="worker in workers" :key="worker.id" :value="worker.name">
                            {{ worker.name }}
                        </option>
                    </select>
                </div>
                <button v-if="hasChenges" @click="saveSchedule" class="save-btn">Сохранить</button>
            </div>
            <div v-else>
                <div class="workers">
                    <h2>Подчинённые</h2>
                    <ul>
                        <li v-for="worker in workers" :key="worker.id">
                            {{ worker.name }}
                        </li>
                    </ul>
                </div>
                <div class="options" v-if="options && options.length > 0">
                    <h2>Варианты расписания</h2>
                    <div v-for="option in options" :key="option.option_number" class="option-card">
                        <h3>Вариант {{ option.option_number }}</h3>
                        <div v-for="(names, day) in option.schedule" :key="day">
                            <strong>{{ day }}:</strong> {{ names.join(', ') }}
                        </div>
                        <button @click="chooseOption(option.option_number)">Выбрать этот вариант</button>
                    </div>
                </div>
            </div>
            <div class="settings_sceduler">
                <h3>Количество смен</h3>
                <div v-for="worker in workers" :key="worker.id">
                    <p v-if="!isEditing">{{ worker.name }} - осталось: {{ worker.monthly_shifts || 0 }} смен</p>
                    <div v-else>
                        <p>{{ worker.name }}</p>
                        <input type="number" v-model.number="worker.monthly_shifts" min="0" />
                    </div>
                </div>
                <button v-if="!isEditing" @click="isEditing = true" class="edit-btn">Изменить смены</button>
                <div v-else>
                    <button @click="saveShifts" class="save-btn">Сохранить</button>
                    <button @click="isEditing = false" class="cancel-btn">Отмена</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
const API_URL = 'https://weekwork-production-cfaf.up.railway.app';

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
        };
    },
    props: {
        user: {
            type: Object,
            required: true,
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
            this.workers = data.workers || [];
            this.options = data.options || [];
            this.weekStart = data.week_start;
            this.final = data.final || null;
        } catch (error) {
            console.error('Ошибка загрузки:', error);
        } finally {
            this.loading = false;
        }

        for (const day in this.final) {
            this.showSelect[day] = false;
        }
    },
    methods: {
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
                    headers: {
                        'Content-Type': 'application/json'
                    },
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
                    this.final = true;
                } else {
                    alert('Ошибка: ' + result.error);
                }
            } catch (error) {
                console.error('Ошибка отправки:', error);
                alert('Не удалось отправить данные');
            }
        },
        async saveShifts() {
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
                    alert('Смены сохранены');
                    this.isEditing = false;
                } else {
                    alert('Ошибка: ' + data.error);
                }
            } catch (error) {
                console.error('Ошибка:', error);
            }
        },
        openSelect(day) {
            this.showSelect[day] = true;
        },
        replaceWorker(day, event) {
            const newName = event.target.value;
            this.final[day] = [newName];
            this.showSelect[day] = false;
            this.hasChenges = true;
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
                    alert('Расписание сохранено');
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
</style>