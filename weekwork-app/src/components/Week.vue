<template>
    <div class="body">
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
    </div>
    <div class="form">
        <textarea class="Descriprion" placeholder="Опишите возможные перестановки в графике" v-model="desc"></textarea>
    </div>
    <button @click="sendData()">Подтвердить</button>
</template>

<script>
const API_URL = 'https://weekwork-production-ea3e.up.railway.app';

export default {
    props: {

    },
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

    }
}
</script>

<style scoped>
.body {
    height: 100px;
}

ul {
    display: flex;
    justify-content: center;
    gap: 5px;
    margin: 50px 10px 0;
}

li {
    list-style: none;
    background-color: #fff;
    padding: 10px;
    border-radius: 10px;
    border: 2px solid rgb(146, 98, 190);
    width: 30px;
    color: rgb(146, 98, 190);
    transition: transform 200ms;
    text-align: center;
    cursor: pointer;
}

li.selected {
    background-color: #724caf;
    color: white;
    border-color: #4e2196;
    transform: scale(1.05);
}

li.priority {
    background-color: #ff00f2;
    color: white;
    border-color: #b600ad;
    transform: scale(1.15);
    box-shadow: 0 0 12px rgba(255, 152, 0, 0.5);
}

li.unavailable {
    background-color: #99003b;
    color: white;
    border-color: #75002d;
}

button {
    border: none;
    outline: none;
    background: #af3afd;
    padding: 10px;
    color: #fff;
    border-radius: 10px;
    position: relative;
    top: 40vh;
    font-size: 20px;
    border: 1px solid rgb(146, 98, 190);
    transition: transform 200ms;
    cursor: pointer;
}

button:active {
    transform: scaleY(1.1);
    background-color: rgb(100, 25, 170);
}

.Descriprion {
    width: 290px;
    height: 100px;
    outline: none;
    padding: 10px;
    font-size: 18px;
    border-radius: 10px;
}

.Descriprion::placeholder {
    font-size: 16px;
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