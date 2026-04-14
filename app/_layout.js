// app/_layout.tsx
import { Stack } from 'expo-router';
import { useTheme } from '../store/theme-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const { Colors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          // Общие настройки для всех экранов
          headerStyle: {
            backgroundColor: Colors.backgroundMain,
          },
          headerTintColor: Colors.textMain,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 17,
          },
          headerBackTitleVisible: false,
          headerShadowVisible: false,        // убирает линию под header (по желанию)

          // Очень важно для красивого headerRight
          headerRightContainerStyle: {
            paddingRight: 8,
            marginRight: 0,
          },

          // Анимации (можно настроить)
          animation: 'default', // или 'slide_from_right'
        }}
      >
        {/* Главный Drawer оборачивается как один экран */}
        <Stack.Screen
          name="index"                    // будет показывать MainDrawer
          options={{ headerShown: false }}
        />

        {/* Все остальные экраны */}
        <Stack.Screen
          name="Stat"
          options={{ title: 'Статистика' }}
        />

        <Stack.Screen
          name="Places"
          options={{ title: 'Места' }}
        />

        <Stack.Screen
          name="PlaceDetail"
          options={{ title: '' }}
        />

        <Stack.Screen
          name="PlaceEditor"
          options={{
            title: 'Новое место',
            // headerRight будет задаваться внутри самого экрана
          }}
        />

        <Stack.Screen
          name="Observations"
          options={{ title: 'Наблюдения' }}
        />

        <Stack.Screen
          name="ObservationEditor"
          options={{ title: 'Новое наблюдение' }}
        />

        <Stack.Screen
          name="Diaries"
          options={{ title: 'Дневники' }}
        />

        <Stack.Screen
          name="DiaryEditor"
          options={{ title: 'Новый дневник' }}
        />

        <Stack.Screen
          name="Rating"
          options={{ title: 'Рейтинг' }}
        />

        <Stack.Screen
          name="RatingsCompare"
          options={{ title: 'Сравнение рейтингов' }}
        />

        <Stack.Screen
          name="UserStat"
          options={{ title: 'Статистика пользователя' }}
        />

        {/* Добавляй остальные экраны по мере миграции */}
      </Stack>
    </GestureHandlerRootView>
  );
}