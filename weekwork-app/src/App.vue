<template>
  <div>
    <div v-if="loading" class="loading">
      <img class="gif_loading" src="/loading-thinking.gif" alt="загрузка">
    </div>
    <div v-else-if="userRole === 'not_registered'">
      <div class="not-registered">
        <p>Вы ещё не зарегистрированы.</p>
        <p>Откройте бота @WeekWork_bot и нажмите /start</p>
      </div>
    </div>
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
  </div>
</template>

<script>
import Week from './components/Week.vue';
import Top from './components/Top.vue';
import EmployerView from './components/EmployerView.vue';
import { API_URL } from './config.js';

export default {
  components: { Week, Top, EmployerView },
  data() {
    return {
      user: null,
      userRole: null,
      loading: true,
      isTelegramApp: false
    };
  },
  async mounted() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === '1') {
      localStorage.clear();
      console.log('localStorage очищен по параметру reset=1');
      window.history.replaceState({}, '', window.location.pathname);
    }

    this.isTelegramApp = !!(window.Telegram?.WebApp);

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
      console.log('Данных нет — приложение вне Telegram');
      this.loading = false;
      return;
    }

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.ready();
    }

    try {
      const response = await fetch(`${API_URL}/api/user-role?telegram_id=${this.user.id}`);
      if (response.ok) {
        const data = await response.json();
        this.userRole = data.role === 'employer' ? 'employer' : 'worker';
      } else {
        console.log('Пользователь не найден в БД');
        this.userRole = 'not_registered';
      }
    } catch (e) {
      console.log('Ошибка получения роли:', e);
      this.userRole = 'not_registered';
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

.not-registered {
  text-align: center;
  padding: 40px 20px;
  font-size: 16px;
  color: #6b7280;
}

.not-registered p {
  margin: 8px 0;
}
</style>