import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ShopScreen from '../screens/ShopScreen';
import ProfileStack from './ProfileStack';
import Icon, { IconName } from '../components/Icon';
import { colors, fonts } from '../theme';

export type MainTabsParamList = {
  Home: undefined;
  History: undefined;
  Shop: undefined;
  Profile: undefined;
};

const TAB_ICONS: Record<keyof MainTabsParamList, IconName> = {
  Home: 'home',
  History: 'history',
  Shop: 'shop',
  Profile: 'profile',
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

function tabIcon(route: keyof MainTabsParamList) {
  return ({ focused }: { focused: boolean }) => (
    <Icon name={TAB_ICONS[route]} color={focused ? colors.green : colors.inkFaint} active={focused} />
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { fontFamily: fonts.heading, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈', tabBarIcon: tabIcon('Home') }} />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: '히스토리', tabBarIcon: tabIcon('History') }}
      />
      <Tab.Screen name="Shop" component={ShopScreen} options={{ title: '상점', tabBarIcon: tabIcon('Shop') }} />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: '프로필', tabBarIcon: tabIcon('Profile') }}
      />
    </Tab.Navigator>
  );
}
