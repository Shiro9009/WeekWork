<template>
    <div class="body">
        <section class="shifts">
            <div class="icon-text">
                <img class="icon-img-container" src="/calendar.svg" alt="">
                <p class="text">Смен в этом месяце</p>
            </div>
            <div class="count">{{ monthly_shifts }}</div>
        </section>

        <section class="select-day">
            <div class="title-container">
                <p class="text-shifts">График работы</p>
                <p class="text-week">Неделя 18–24 авг</p>
            </div>
            <ul>
                <li @click="selector('Mo')" :class="{
                    'selected': days.Mo === 1,
                    'priority': days.Mo === 2,
                    'unavailable': days.Mo === 3
                }">Пн</li>
                <li @click="selector('Tu')" :class="{
                    'selected': days.Tu === 1,
                    'priority': days.Tu === 2,
                    'unavailable': days.Tu === 3
                }">Вт</li>
                <li @click="selector('We')" :class="{
                    'selected': days.We === 1,
                    'priority': days.We === 2,
                    'unavailable': days.We === 3
                }">Ср</li>
                <li @click="selector('Th')" :class="{
                    'selected': days.Th === 1,
                    'priority': days.Th === 2,
                    'unavailable': days.Th === 3
                }">Чт</li>
                <li @click="selector('Fr')" :class="{
                    'selected': days.Fr === 1,
                    'priority': days.Fr === 2,
                    'unavailable': days.Fr === 3
                }">Пт</li>
                <li @click="selector('Sa')" :class="{
                    'selected': days.Sa === 1,
                    'priority': days.Sa === 2,
                    'unavailable': days.Sa === 3
                }">Сб</li>
                <li @click="selector('Su')" :class="{
                    'selected': days.Su === 1,
                    'priority': days.Su === 2,
                    'unavailable': days.Su === 3
                }">Вс</li>
            </ul>
            <div class="description-container">
                <div class="def">
                    <div class="def-item"></div>
                    <p>Обычный</p>
                </div>
                <div class="sel">
                    <div class="sel-item"></div>
                    <p>Готов</p>
                </div>
                <div class="pri">
                    <img class="pri-item" src="/star.svg" alt="звезда">
                    <p>Приоритет</p>
                </div>
                <div class="una">
                    <div class="una-item"></div>
                    <p>Не могу</p>
                </div>
            </div>
        </section>
        <section class="nuances">
            <h3 class="nuances-title">Нюансы на неделю</h3>
            <div class="form">
                <textarea class="Descriprion" placeholder="Опишите пожелания или ограничения... "
                    v-model="desc"></textarea>
            </div>
        </section>
        <button @click="sendData()" class="Send-data">Отправить данные</button>
    </div>

</template>

<script>
const API_URL = 'https://weekwork-production-ea3e.up.railway.app';

export default {
    data() {
        return {
            days: {
                Mo: 0,
                Tu: 0,
                We: 0,
                Th: 0,
                Fr: 0,
                Sa: 0,
                Su: 0,
            },
            desc: '',
            monthly_shifts: 0,
        }
    },
    methods: {
        selector(day) {
            const current = this.days[day];
            const next = (current + 1) % 4;

            if (next === 2) {
                const priorityCount = Object.values(this.days).filter(v => v === 2).length;

                if (priorityCount >= 4) {
                    alert('Нельзя поставить больше 4 приоритетных дней. Выберите другие дни как обычные.');
                    return;
                }
            }

            this.days[day] = next;
        },
        async sendData() {
            if (!this.$parent.user) {
                alert('Пользователь не авторизован')
                return
            }

            const payload = {
                telegram_id: this.$parent.user.id,
                first_name: this.$parent.user.first_name || 'Пользователь',
                days: this.days,
                desc: this.desc,
            }

            try {
                const response = await fetch(`${API_URL}/api/availability`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })

                const result = await response.json()

                if (result.success) {
                    alert('Данные сохранены')
                } else {
                    alert('Ошибка: ' + result.error)
                }
            } catch (error) {
                console.error('Ошибка отправки:', error)
                alert('Не удалось отправить данные')
            }
        },

    },
    async mounted() {
        if (this.$parent.user && this.$parent.user.id) {
            try {
                const response = await fetch(`${API_URL}/api/user-shifts?telegram_id=${this.$parent.user.id}`);
                const data = await response.json();
                if (data.monthly_shifts !== undefined) {
                    this.monthly_shifts = data.monthly_shifts;
                }
            } catch (error) {
                console.error('Ошибка загрузки смен: ', error);
            }
        }
    }
}
</script>

<style scoped>
.body {
    height: 100px;
}

.shifts {
    display: flex;
    box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.05);
    background-color: #FFFFFF;
    margin: 20px auto;
    width: 300px;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 14px;
    width: 358px;
    height: 30px;
    justify-content: space-between;
    align-items: center;

}

.icon-img-container {
    background: #f3f4f6;
    width: 20px;
    height: 20px;
    padding: 7px;
    border-radius: 8px;

}

.icon-text {
    display: flex;
    gap: 10px;
    align-items: center;
}

.text {
    color: #6b7280;
}

.count {
    border-radius: 100px;
    padding: 4px 12px;
    background: #9b8fd8;
    color: #fff;
    font-size: 20px;
    font-weight: 600;
}

ul {
    display: flex;
    justify-content: center;
    width: 390px;
    gap: 5px;
    margin: 10px auto;
}

li {
    list-style: none;
    background-color: #fff;
    padding: 10px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    width: 30px;
    color: #6b7280;
    transition: transform 200ms;
    text-align: center;
    cursor: pointer;
}

li.selected {
    background-color: #9b8fd8;
    color: #fff;
    border-color: #9b8fd8;
    transform: scale(1.05);
}

li.priority {
    background-color: #fff;
    color: #9b8fd8;
    border: 2px solid #9b8fd8;
    transform: scale(1.05);
}

li.unavailable {
    background-color: #fff;
    color: #9c5a6c;
    border: 1px solid #9c5a6c;
}


button:active {
    transform: scaleY(1.1);
    background-color: rgb(100, 25, 170);
}

.Descriprion {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px;
    width: 358px;
    height: 100px;
    box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.05);
    background: #fff;
}

.Descriprion::placeholder {
    font-size: 16px;
    color: #9ca3af;
}

.title-container {
    display: flex;
    justify-content: space-between;
    margin: 0 auto;
    width: 390px;
}

.text-shifts {
    font-weight: 600;
}

.text-week {
    color: #7C6BC4;
}

.description-container {
    display: flex;
    width: 390px;
    margin: 0 auto;
    gap: 8px;
    align-items: center;
}

.def,
.sel,
.pri,
.una {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 13px;
    color: #6b7280;
}

.def-item {
    border: 1px solid #e5e7eb;
    border-radius: 3px;
    width: 12px;
    height: 12px;
    background: #fff;
}

.sel-item {
    border: 1px solid #e5e7eb;
    border-radius: 3px;
    width: 12px;
    height: 12px;
    background: #9b8fd8;
}

.pri-item {
    border: 1px solid #e5e7eb;
    border-radius: 3px;
    width: 12px;
    height: 12px;
    background: #fff;
}

.una-item {
    border: 1px solid #8d1416;
    border-radius: 3px;
    width: 12px;
    height: 12px;
    background: #fff;
}

.form {
    margin-top: 10px;
}

.nuances-title {
    display: flex;
    width: 390px;
    margin: 20px auto;
    color: #111827;
    font-size: 17px;
}

button {
    border: none;
    outline: none;
    padding: 10px;
    color: #fff;
    position: relative;
    top: 25vh;
    font-size: 20px;
    border: 1px solid rgb(146, 98, 190);
    transition: transform 200ms;
    cursor: pointer;
    border-radius: 25px;
    width: 358px;
    height: 50px;
    box-shadow: 0 6px 16px -4px rgba(0, 0, 0, 0.08);
    background: #7c6bc4;
}


@media (max-width: 375px) {
    ul {
        display: flex;
        justify-content: center;
        gap: 3px;
        margin-top: 50px;
    }

    li {
        list-style: none;
        background-color: #fff;
        padding: 8px;
        border-radius: 10px;
        border: 2px solid rgb(146, 98, 190);
        width: 30px;
        color: rgb(146, 98, 190);
        transition: transform 200ms;
        text-align: center;
        cursor: pointer;
    }
}
</style>