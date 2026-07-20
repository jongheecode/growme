import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileStack from './ProfileStack';

export type MainTabsParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: '히스토리' }} />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ title: '프로필', headerShown: false }} />
    </Tab.Navigator>
  );
}
