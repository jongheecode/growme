import { NavigationContainer } from '@react-navigation/native';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useGoals } from '../context/GoalsContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import OnboardingChatScreen from '../screens/OnboardingChatScreen';

export default function RootNavigator() {
  const { token, isLoading: authLoading } = useAuth();
  const { goals, isLoading: goalsLoading, error: goalsError, isAddingGoal, stopAddGoal, refreshGoals } = useGoals();

  if (authLoading || (token && goalsLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  let content;
  if (!token) {
    content = <AuthStack />;
  } else if (goals.length === 0 && goalsError) {
    content = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>{goalsError}</Text>
        <TouchableOpacity testID="goals-retry" onPress={() => refreshGoals()}>
          <Text>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (goals.length === 0) {
    content = <OnboardingChatScreen canCancel={false} onDone={stopAddGoal} />;
  } else if (isAddingGoal) {
    content = <OnboardingChatScreen canCancel onDone={stopAddGoal} />;
  } else {
    content = <MainTabs />;
  }

  return <NavigationContainer>{content}</NavigationContainer>;
}
