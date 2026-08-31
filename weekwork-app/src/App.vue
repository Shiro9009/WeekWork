<template>
  <div v-if="loading" class="loading"><img class="gif_loading" src="/loading-thinking.gif" alt="загрузка"></div>
  <div v-else>
    <router-view v-if="$route.path === '/profile'" :user="user" />
    <div v-else>
      <div v-if="userRole === 'employer'">
        <Top :user="user" @open-profile="goToProfile" />
        <EmployerView :user="user" />
      </div>
      <div v-else>
        <Top :user="user" @open-profile="goToProfile" />
        <Week />
      </div>
    </div>
  </div>
</template>

<script>
import Week from './components/Week.vue';
import Top from './components/Top.vue';
import EmployerView from './components/EmployerView.vue';

const API_URL = 'https://weekwork-production-ea3e.up.railway.app';

export default {
  components: { Week, Top, EmployerView },
  data() {
    return {
      user: null,
      userRole: null,
      loading: true
    };
  },
  async mounted() {
    console.log('Проверяем window.Telegram: ', window.Telegram);

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
          console.log('Нашли tgWebAppData: ', decoded);
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

    if (userData) {
      this.user = userData;
      console.log('Пользователь загружен');
    } else {
      console.log('Данных нет, показываем заглушку');
      this.user = { first_name: 'ТЕСТ', username: 'test_user' };
    }

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.ready();
    }

    try {
      const response = await fetch(`${API_URL}/api/user-role?telegram_id=${this.user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.role === 'employer') {
          this.userRole = 'employer';
        } else {
          this.userRole = 'worker';
        }
      }
    } catch (e) {
      console.log('Ошибка получения роли:', e);
      this.userRole = 'worker';
    }

    this.loading = false;
  },
  methods: {
    goToProfile() {
      this.$router.push({
        path: '/profile',
        query: { 
          user: JSON.stringify(this.user),
          role: this.userRole,
         }
      });
    }
  }
};
</script>

<style scoped>
.loading {
  text-align: center;
  padding: 40px;
}

.gif_loading {
  width: 50px;
}

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