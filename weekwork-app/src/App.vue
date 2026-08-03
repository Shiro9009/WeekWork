<template>
  <div>
    <EmployerView v-if="userRole === 'employer'" :user="user" />
    <div v-else>
      <Top :user="user" />
      <Week />
    </div>
  </div>
</template>

<script>
import Week from './components/Week.vue';
import Top from './components/Top.vue';
import EmployerView from './components/EmployerView.vue';

export default {
  components: { Week, Top, EmployerView },
  data() {
    return {
      user: null,
      userRole: 'worker'
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
      const response = await fetch(`/api/employer-data?telegram_id=${this.user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.workers) {
          this.userRole = 'employer';
          return;
        }
      }
    } catch (e) {
      console.log('Проверка роли:', e);
    }

    try {
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('telegram_id', this.user.id)
        .single();
      this.userRole = data?.role || 'worker';
    } catch (e) {
      console.log('Ошибка получения роли:', e);
    }
  }
};
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