<template>
  <!-- <h1>
    Моё Telegram min-app
  </h1>

  <div>
    <p v-if="user && user.first_name">Имя: {{ user.first_name }}</p>
    <p v-if="user && user.username">Юзернейм: @{{ user.username }}</p>
    <p v-if="!user">Пользователь не авторизован</p>
  </div>

  <div class="count">
    <p>{{ amount }}</p>
    <button @click="plus()">+</button>
    <button @click="minus()">-</button>
  </div>

  <button class="send" @click="sendData()">Отправить данные боту</button> -->
  <Top :user="user"/>
  <Week/>
  <description/>
</template>

<script>
import Week from './components/Week.vue';
import Top from './components/Top.vue';

export default {
  components: {Week, Top},
  data() {
    return {
      amount: 0,
      user: null,
    }
  },
  methods: {
    plus() {
      this.amount += 1
    },
    minus() {
      this.amount -= 1
    },
    sendData() {
      if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp
        tg.showAlert(`Счётчик: ${this.amount}`)
      }
    }
  },
  async mounted() {
    console.log('Проверяем window.Telegram: ', window.Telegram)

    let userData = null
    
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      userData = window.Telegram.WebApp.initDataUnsafe.user
      console.log('Данные из window.Telegram: ', userData)
    }

    if (!userData) {
      const url = window.location.href;

      const match = url.match(/[#?]tgWebAppData=([^&]+)/)

      if (match) {
        try {
          const decoded = decodeURIComponent(match[1])
          console.log('Нашли tgWebAppData: ', decoded)

          const params = new URLSearchParams(decoded)
          const userParam = params.get('user')

          if (userParam) {
            userData = JSON.parse(decodeURIComponent(userParam))
            console.log('Данные из URL: ', userData)
          }
        } catch (e) {
          console.log('Ошибка при парсинге данных из URL:', e)
        }
      }
    }

    if (userData) {
      this.user = userData
      console.log('Пользователь загружен')
    } else {
      console.log('Данных нет показываем загулшку')
      this.user = {first_name: 'ТЕСТ', username: 'test_user'}
    }

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand()
      window.Telegram.WebApp.ready()
    }
  }
}
</script>

<style scoped>
p {
  font-size: 20px;
}

button {
  width: 300px;
  padding: 10px;
  outline: none;
  border: none;
  margin-top: 20px;
  border-radius: 10px;
  background-color: #530b74;
  border: 2px solid #340749;
  font-size: 25px;
  color: #f3ecef;
}

.count {
  border: 2px solid #140c81;
  padding: 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
</style>