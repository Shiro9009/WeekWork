<template>
    <div class="body">
        <ul>
            <li @click="selector('Mo')" :class="days.Mo == 1 ? 'active' : ''">Пн</li>
            <li @click="selector('Tu')" :class="days.Tu == 1 ? 'active' : ''">Вт</li>
            <li @click="selector('We')" :class="days.We == 1 ? 'active' : ''">Ср</li>
            <li @click="selector('Th')" :class="days.Th == 1 ? 'active' : ''">Чт</li>
            <li @click="selector('Fr')" :class="days.Fr == 1 ? 'active' : ''">Пт</li>
            <li @click="selector('Sa')" :class="days.Sa == 1 ? 'active' : ''">Сб</li>
            <li @click="selector('Su')" :class="days.Su == 1 ? 'active' : ''">Вс</li>
        </ul>
    </div>
    <div class="form">
        <textarea class="Descriprion" placeholder="Опишите возможные перестановки в графике" v-model="desc"></textarea>
    </div>
    <button @click="sendData()">Подтвердить</button>
</template>

<script>
const API_URL = 'https://weekwork-production-381f.up.railway.app';

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
            this.days[day] = this.days[day] === 1 ? 0 : 1
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

li.active {
    transform: scale(1.1);
    background-color: rgb(100, 25, 170);
    color: #fff;
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