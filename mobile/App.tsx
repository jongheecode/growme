import { View } from 'react-native';
import { useFonts, Jua_400Regular } from '@expo-google-fonts/jua';
import { GowunDodum_400Regular } from '@expo-google-fonts/gowun-dodum';
import { AuthProvider } from './src/context/AuthContext';
import { GoalsProvider } from './src/context/GoalsContext';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts({ Jua_400Regular, GowunDodum_400Regular });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <AuthProvider>
      <GoalsProvider>
        <RootNavigator />
      </GoalsProvider>
    </AuthProvider>
  );
}
